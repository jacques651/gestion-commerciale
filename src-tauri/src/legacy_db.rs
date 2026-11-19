//! Recuperation au demarrage : aucune migration de schema, aucune ecriture source.
use rusqlite::{
    backup::{Backup, StepResult},
    Connection, OpenFlags,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const DB_NAME: &str = "gestion-commerciale.db";
const PAUSE_SECONDS: u64 = 7 * 24 * 60 * 60;
type Result<T> = std::result::Result<T, String>;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Candidate {
    path: PathBuf,
    size: u64,
    modified_at: u64,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
enum DecisionKind {
    Keep,
    Empty,
    Deferred,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Decision {
    last_checked_at: String,
    candidates: Vec<Candidate>,
    decision: DecisionKind,
    source_path: Option<PathBuf>,
    /// Horodatage Unix UTC en secondes.
    skip_until: Option<u64>,
    no_choice_count: u32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum Choice {
    Keep,
    Empty,
    View,
    Closed,
}

struct Migration {
    current: PathBuf,
    paths: Vec<PathBuf>,
    now: u64,
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

// Calendrier gregorien depuis les jours Unix, sans dependance supplementaire.
fn stamp(seconds: u64, filename: bool) -> String {
    let days = (seconds / 86400) as i64 + 719468;
    let era = days / 146097;
    let doe = days - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let mut year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    year += if month <= 2 { 1 } else { 0 };
    let (hour, minute, second) = (
        (seconds % 86400) / 3600,
        (seconds % 3600) / 60,
        seconds % 60,
    );
    if filename {
        format!("{year:04}{month:02}{day:02}-{hour:02}{minute:02}{second:02}")
    } else {
        format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z")
    }
}

fn path_key(path: &Path) -> String {
    fs::canonicalize(path)
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .replace('/', "\\")
        .to_lowercase()
}

fn readonly(path: &Path) -> Result<Connection> {
    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("Lecture SQLite {} : {e}", path.display()))?;
    connection
        .busy_timeout(Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    Ok(connection)
}

/// Toute ligne protege la base, en particulier dans `utilisateurs` (nom reel).
/// Une base illisible provoque une erreur, jamais le droit de l'ecraser.
fn initialized(path: &Path) -> Result<bool> {
    if !path.exists() || fs::metadata(path).map_err(|e| e.to_string())?.len() == 0 {
        return Ok(false);
    }
    let connection = readonly(path)?;
    let mut statement = connection
        .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' \
         ORDER BY CASE WHEN name IN ('utilisateurs','users','parametres') THEN 0 ELSE 1 END",
        )
        .map_err(|e| e.to_string())?;
    let tables = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    for table in tables {
        let table = table.map_err(|e| e.to_string())?.replace('"', "\"\"");
        let exists: bool = connection
            .query_row(
                &format!("SELECT EXISTS(SELECT 1 FROM \"{table}\" LIMIT 1)"),
                [],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists {
            return Ok(true);
        }
    }
    Ok(false)
}

fn integrity(connection: &Connection) -> Result<()> {
    let mut statement = connection
        .prepare("PRAGMA integrity_check")
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    for row in rows {
        let result = row.map_err(|e| e.to_string())?;
        if result != "ok" {
            return Err(format!("Integrite SQLite : {result}"));
        }
    }
    Ok(())
}

/// create_new protege toute destination existante. L'API lit aussi le WAL source.
fn snapshot(source: &Path, destination: &Path) -> Result<()> {
    let source_connection = readonly(source)?;
    drop(
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(destination)
            .map_err(|e| format!("Reservation {} : {e}", destination.display()))?,
    );
    let result = (|| {
        let mut destination_connection =
            Connection::open(destination).map_err(|e| e.to_string())?;
        {
            let backup = Backup::new(&source_connection, &mut destination_connection)
                .map_err(|e| e.to_string())?;
            let deadline = Instant::now() + Duration::from_secs(30);
            loop {
                match backup.step(256).map_err(|e| e.to_string())? {
                    StepResult::Done => break,
                    StepResult::Busy | StepResult::Locked => {
                        std::thread::sleep(Duration::from_millis(50))
                    }
                    _ => {}
                }
                if Instant::now() >= deadline {
                    return Err("Copie SQLite : delai depasse".into());
                }
            }
        }
        destination_connection
            .execute_batch("PRAGMA journal_mode = DELETE;")
            .map_err(|e| e.to_string())?;
        integrity(&destination_connection)?;
        drop(destination_connection);
        OpenOptions::new()
            .write(true)
            .open(destination)
            .and_then(|f| f.sync_all())
            .map_err(|e| e.to_string())?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(destination);
    }
    result
}

impl Migration {
    fn directory(&self) -> &Path {
        self.current.parent().expect("Chemin de base absolu")
    }

    fn log(&self, message: &str) {
        let result = (|| -> std::io::Result<()> {
            fs::create_dir_all(self.directory())?;
            let mut file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(self.directory().join(".migration-log.txt"))?;
            writeln!(
                file,
                "{} | {}",
                stamp(self.now, false),
                message.replace(['\r', '\n'], " ")
            )
        })();
        if let Err(error) = result {
            eprintln!("Journal indisponible : {error}; {message}");
        }
    }

    fn load(&self) -> Result<Option<Decision>> {
        match fs::read(self.directory().join(".migration-decision.json")) {
            Ok(bytes) => serde_json::from_slice(&bytes)
                .map(Some)
                .map_err(|e| e.to_string()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(error.to_string()),
        }
    }

    fn save(&self, decision: &Decision) -> Result<()> {
        fs::create_dir_all(self.directory()).map_err(|e| e.to_string())?;
        let path = self.directory().join(".migration-decision.json");
        let temporary = self
            .directory()
            .join(format!(".migration-decision.{}.tmp", std::process::id()));
        let bytes = serde_json::to_vec_pretty(decision).map_err(|e| e.to_string())?;
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|e| e.to_string())?;
        let result = (|| {
            file.write_all(&bytes)
                .and_then(|_| file.sync_all())
                .map_err(|e| e.to_string())?;
            drop(file);
            fs::rename(&temporary, &path).map_err(|e| e.to_string())
        })();
        if result.is_err() {
            let _ = fs::remove_file(temporary);
        }
        result
    }

    fn candidates(&self) -> Vec<Candidate> {
        let mut seen = HashSet::from([path_key(&self.current)]);
        let mut candidates = Vec::new();
        for path in &self.paths {
            self.log(&format!("Candidat teste : {}", path.display()));
            if !seen.insert(path_key(path)) {
                self.log("Chemin identique ou deja teste : ignore");
                continue;
            }
            let metadata = match fs::metadata(path) {
                Ok(m) if m.is_file() && m.len() > 0 => m,
                Ok(_) => {
                    self.log("Candidat sans contenu : ignore");
                    continue;
                }
                Err(e) => {
                    self.log(&format!("Candidat indisponible : {e}"));
                    continue;
                }
            };
            if let Err(error) = readonly(path).and_then(|c| {
                c.query_row("SELECT count(*) FROM sqlite_master", [], |row| {
                    row.get::<_, i64>(0)
                })
                .map(|_| ())
                .map_err(|e| e.to_string())
            }) {
                self.log(&format!("Candidat invalide : {error}"));
                continue;
            }
            let modified = |p: &Path| {
                fs::metadata(p)
                    .and_then(|m| m.modified())
                    .ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|t| t.as_secs())
                    .unwrap_or(0)
            };
            let wal = PathBuf::from(format!("{}-wal", path.display()));
            candidates.push(Candidate {
                // Garder un chemin lisible par explorer.exe ; canonicalize sous
                // Windows ajoute un prefixe \\?\ que l'Explorateur ne gere pas.
                // La deduplication utilise toujours la cible canonique (path_key).
                path: if path.is_absolute() {
                    path.clone()
                } else {
                    std::env::current_dir().unwrap_or_default().join(path)
                },
                size: metadata.len(),
                modified_at: modified(path).max(modified(&wal)),
            });
        }
        candidates.sort_by(|a, b| {
            b.modified_at
                .cmp(&a.modified_at)
                .then_with(|| a.path.cmp(&b.path))
        });
        candidates
    }

    fn restore(&self, source: &Path) -> Result<()> {
        if initialized(&self.current)? {
            return Err("Base actuelle initialisee : remplacement refuse".into());
        }
        fs::create_dir_all(self.directory()).map_err(|e| e.to_string())?;
        let staging = self.directory().join(format!(
            ".migration-restore-{}-{}.tmp",
            std::process::id(),
            self.now
        ));
        snapshot(source, &staging)?;
        let result = (|| {
            if initialized(&self.current)? {
                return Err(
                    "Base initialisee pendant la verification : remplacement refuse".into(),
                );
            }
            for suffix in ["-wal", "-shm", "-journal"] {
                if PathBuf::from(format!("{}{suffix}", self.current.display())).exists() {
                    return Err("Base actuelle ouverte ou journal present : fermer les autres instances avant de restaurer".into());
                }
            }
            let backups = self.directory().join("backups");
            fs::create_dir_all(&backups).map_err(|e| e.to_string())?;
            let stem = format!("{DB_NAME}.bak-{}", stamp(self.now, true));
            let mut backup = backups.join(&stem);
            let mut index = 1;
            while backup.exists() {
                backup = backups.join(format!("{stem}-{index}"));
                index += 1;
            }
            if self.current.exists() {
                if fs::metadata(&self.current)
                    .map_err(|e| e.to_string())?
                    .len()
                    > 0
                {
                    snapshot(&self.current, &backup)?;
                } else {
                    drop(
                        OpenOptions::new()
                            .create_new(true)
                            .write(true)
                            .open(&backup)
                            .map_err(|e| e.to_string())?,
                    );
                }
                self.log(&format!(
                    "Base precedente sauvegardee : {}",
                    backup.display()
                ));
            } else {
                snapshot(&staging, &backup)?;
                self.log(&format!(
                    "Instantane de recuperation sauvegarde : {}",
                    backup.display()
                ));
            }
            fs::rename(&staging, &self.current)
                .map_err(|e| format!("Installation de la copie : {e}"))?;
            self.log(&format!(
                "Copie WAL coherente et integrity_check OK : {} -> {}",
                source.display(),
                self.current.display()
            ));
            Ok(())
        })();
        if result.is_err() {
            let _ = fs::remove_file(staging);
        }
        result
    }

    /// Dialogues injectables : les tests travaillent exclusivement en dossiers temporaires.
    fn run(
        &self,
        mut ask: impl FnMut(&[Candidate]) -> Result<Choice>,
        mut view: impl FnMut(&[Candidate]) -> Result<()>,
    ) -> Result<()> {
        let size = fs::metadata(&self.current).map(|m| m.len()).unwrap_or(0);
        self.log(&format!(
            "Demarrage ; base actuelle={} ; taille={size}",
            self.current.display()
        ));
        let previous = match self.load() {
            Ok(decision) => decision,
            Err(error) => {
                self.log(&format!("Decision illisible : {error}"));
                None
            }
        };
        self.log(&format!("Decision lue : {previous:?}"));
        if initialized(&self.current)? {
            self.log("Base deja initialisee (compte ou donnees presents) : demarrage normal, aucune boite");
            return Ok(());
        }
        if previous
            .as_ref()
            .and_then(|d| d.skip_until)
            .is_some_and(|until| until > self.now)
        {
            self.log("Pause de 7 jours active : demarrage normal, aucune boite");
            return Ok(());
        }
        let mut candidates = self.candidates();
        if let Some(previous) = &previous {
            if matches!(previous.decision, DecisionKind::Keep | DecisionKind::Empty) {
                let decided: HashSet<_> = previous
                    .candidates
                    .iter()
                    .map(|c| path_key(&c.path))
                    .collect();
                candidates.retain(|c| {
                    !decided.contains(&path_key(&c.path))
                        && previous
                            .source_path
                            .as_ref()
                            .is_none_or(|p| path_key(p) != path_key(&c.path))
                });
            }
        }
        if candidates.is_empty() {
            self.log("Aucun nouveau candidat valide : demarrage normal");
            return Ok(());
        }
        let selected = &candidates[0];
        self.log(&format!(
            "Candidat retenu (plus recent) : {}",
            selected.path.display()
        ));
        let choice = loop {
            let choice = match ask(&candidates) {
                Ok(choice) => choice,
                Err(error) => {
                    self.log(&format!("Echec du dialogue : {error} ; demarrage normal"));
                    return Ok(());
                }
            };
            if choice != Choice::View {
                break choice;
            }
            if let Err(error) = view(&candidates) {
                self.log(&format!("Ouverture Explorateur impossible : {error}"));
            }
        };
        let mut decision = Decision {
            last_checked_at: stamp(self.now, false),
            candidates: candidates.clone(),
            decision: DecisionKind::Deferred,
            source_path: None,
            skip_until: None,
            no_choice_count: 0,
        };
        match choice {
            Choice::Keep => {
                self.restore(&selected.path)?;
                decision.decision = DecisionKind::Keep;
                decision.source_path = Some(selected.path.clone());
            }
            Choice::Empty => {
                decision.decision = DecisionKind::Empty;
                decision.source_path = Some(selected.path.clone());
                self.log(
                    "Demarrer a vide : aucune copie, choix memorise pour les sources presentees",
                );
            }
            Choice::Closed => {
                let consecutive = previous
                    .as_ref()
                    .filter(|d| d.decision == DecisionKind::Deferred && d.skip_until.is_none())
                    .map(|d| d.no_choice_count)
                    .unwrap_or(0);
                decision.no_choice_count = consecutive.saturating_add(1);
                if decision.no_choice_count >= 3 {
                    decision.skip_until = Some(self.now + PAUSE_SECONDS);
                }
                self.log(&format!("Fermeture sans choix numero={} ; aucune source decidee ; skipUntil={:?} ; demarrage normal", consecutive.saturating_add(1), decision.skip_until));
            }
            Choice::View => unreachable!(),
        }
        if matches!(decision.decision, DecisionKind::Keep | DecisionKind::Empty) {
            if let Some(previous) =
                previous.filter(|d| matches!(d.decision, DecisionKind::Keep | DecisionKind::Empty))
            {
                let mut known: HashSet<_> = decision
                    .candidates
                    .iter()
                    .map(|c| path_key(&c.path))
                    .collect();
                decision.candidates.extend(
                    previous
                        .candidates
                        .into_iter()
                        .filter(|c| known.insert(path_key(&c.path))),
                );
            }
        }
        self.save(&decision)?; // Toujours avant SQL et React.
        self.log(&format!("Decision ecrite atomiquement : {decision:?}"));
        Ok(())
    }
}

fn configuration(app: &AppHandle) -> Result<Migration> {
    let directory = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let current = directory.join(DB_NAME);
    let mut paths = vec![current.clone()];
    if let Ok(home) = app.path().home_dir() {
        paths.push(home.join("GestionCommerciale").join("data").join(DB_NAME));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(directory) = exe.parent() {
            paths.push(directory.join("data").join(DB_NAME));
            paths.push(directory.join(DB_NAME));
        }
    }
    // Chemins supplementaires separes par `;` sous Windows.
    if let Some(extra) = std::env::var_os("GC_LEGACY_DB_PATHS") {
        paths.extend(std::env::split_paths(&extra));
    }
    Ok(Migration {
        current,
        paths,
        now: now(),
    })
}

pub fn log_startup_error(app: &AppHandle, message: &str) {
    match configuration(app) {
        Ok(m) => m.log(message),
        Err(e) => eprintln!("{message}; {e}"),
    }
}

pub fn check_and_restore_legacy(app: &AppHandle) {
    match configuration(app) {
        Ok(migration) => {
            if let Err(error) = migration.run(native_dialog, show_files) {
                migration.log(&format!(
                    "Erreur de recuperation : {error} ; demarrage normal sans autre copie"
                ));
            }
        }
        Err(error) => eprintln!("Detection de l'ancienne base indisponible : {error}"),
    }
}

fn show_files(candidates: &[Candidate]) -> Result<()> {
    #[cfg(windows)]
    for candidate in candidates {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("explorer.exe")
            .arg(format!("/select,{}", candidate.path.display()))
            .creation_flags(0x08000000) // Aucune console auxiliaire.
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        let _ = candidates;
        return Err("Selection du fichier disponible sous Windows".into());
    }
    #[allow(unreachable_code)]
    Ok(())
}

fn dialog_text(candidates: &[Candidate]) -> String {
    let details = candidates
        .iter()
        .map(|c| {
            format!(
                "{}\nDate UTC : {} ; taille du fichier : {} octets",
                c.path.display(),
                stamp(c.modified_at, false),
                c.size
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n");
    format!("Une ancienne base de données a été trouvée. Voulez-vous conserver ses données ?\n\n{details}\n\nLa copie inclut le journal SQLite WAL. En présence de plusieurs bases, la plus récente est proposée.")
}

/// TaskDialog est aussi le backend du plugin dialog. L'acces direct preserve ici
/// la distinction fermeture / troisieme bouton et les erreurs HRESULT.
#[cfg(windows)]
fn native_dialog(candidates: &[Candidate]) -> Result<Choice> {
    windows_dialog(candidates, "Récupération des données — Gestion Commerciale")
}

#[cfg(windows)]
fn windows_dialog(candidates: &[Candidate], dialog_title: &str) -> Result<Choice> {
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM, WPARAM},
        UI::{
            Controls::{
                TaskDialogIndirect, TASKDIALOGCONFIG, TASKDIALOG_BUTTON,
                TDF_ALLOW_DIALOG_CANCELLATION, TDF_SIZE_TO_CONTENT, TDN_CREATED,
            },
            WindowsAndMessaging::{
                BringWindowToTop, SetForegroundWindow, SetWindowPos, HWND_TOPMOST, SWP_NOMOVE,
                SWP_NOSIZE, SWP_SHOWWINDOW,
            },
        },
    };
    unsafe extern "system" fn foreground(
        hwnd: HWND,
        message: u32,
        _: WPARAM,
        _: LPARAM,
        _: isize,
    ) -> i32 {
        if message == TDN_CREATED as u32 {
            unsafe {
                SetWindowPos(
                    hwnd,
                    HWND_TOPMOST,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW,
                );
                SetForegroundWindow(hwnd);
                BringWindowToTop(hwnd);
            }
        }
        0
    }
    let wide = |text: &str| text.encode_utf16().chain(Some(0)).collect::<Vec<u16>>();
    let title = wide(dialog_title);
    let message = wide(&dialog_text(candidates));
    let keep = wide(if candidates.len() > 1 {
        "Conserver la plus récente"
    } else {
        "Conserver"
    });
    let empty = wide("Démarrer à vide");
    let view = wide(if candidates.len() > 1 {
        "Voir les fichiers"
    } else {
        "Voir le fichier"
    });
    let buttons = [
        TASKDIALOG_BUTTON {
            nButtonID: 1001,
            pszButtonText: keep.as_ptr(),
        },
        TASKDIALOG_BUTTON {
            nButtonID: 1002,
            pszButtonText: empty.as_ptr(),
        },
        TASKDIALOG_BUTTON {
            nButtonID: 1003,
            pszButtonText: view.as_ptr(),
        },
    ];
    let config = TASKDIALOGCONFIG {
        cbSize: std::mem::size_of::<TASKDIALOGCONFIG>() as u32,
        dwFlags: TDF_ALLOW_DIALOG_CANCELLATION | TDF_SIZE_TO_CONTENT,
        pszWindowTitle: title.as_ptr(),
        pszContent: message.as_ptr(),
        cButtons: buttons.len() as u32,
        pButtons: buttons.as_ptr(),
        pfCallback: Some(foreground),
        ..unsafe { std::mem::zeroed() }
    };
    let mut selected = 0;
    let status = unsafe {
        TaskDialogIndirect(
            &config,
            &mut selected,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    if status < 0 {
        return Err(format!(
            "Dialogue Windows indisponible (HRESULT {status:#x})"
        ));
    }
    Ok(match selected {
        1001 => Choice::Keep,
        1002 => Choice::Empty,
        1003 => Choice::View,
        _ => Choice::Closed,
    })
}

#[cfg(not(windows))]
fn native_dialog(_candidates: &[Candidate]) -> Result<Choice> {
    Err("Recuperation native configuree pour Windows ; demarrage normal".into())
}

#[cfg(test)]
#[path = "legacy_db_tests.rs"]
mod tests;
