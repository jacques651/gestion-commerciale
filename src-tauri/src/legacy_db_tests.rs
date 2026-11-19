use super::*;
use std::fs::File;
use std::sync::OnceLock;

fn test_root() -> &'static PathBuf {
    static ROOT: OnceLock<PathBuf> = OnceLock::new();
    ROOT.get_or_init(|| {
        let root = std::env::temp_dir().join(format!(
            "gc-legacy-tests-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        println!("RAPPORTS_MIGRATION={}", root.display());
        root
    })
}

fn fixture(name: &str) -> Migration {
    let root = test_root().join(name);
    fs::create_dir_all(root.join("current")).unwrap();
    Migration {
        current: root.join("current").join(DB_NAME),
        paths: vec![root.join("legacy.db")],
        now: 1_794_916_800,
    }
}

fn account(path: &Path, name: &str) -> Connection {
    let db = Connection::open(path).unwrap();
    db.execute_batch("CREATE TABLE utilisateurs (id INTEGER PRIMARY KEY, nom TEXT);")
        .unwrap();
    db.execute("INSERT INTO utilisateurs (nom) VALUES (?)", [name])
        .unwrap();
    db
}

fn restored_name(path: &Path) -> String {
    let db = readonly(path).unwrap();
    integrity(&db).unwrap();
    db.query_row("SELECT nom FROM utilisateurs LIMIT 1", [], |r| r.get(0))
        .unwrap()
}

fn run_choice(m: &Migration, choice: Choice) {
    m.run(|_| Ok(choice), |_| Ok(())).unwrap();
}

fn evidence(m: &Migration, label: &str) {
    let decision = m.directory().join(".migration-decision.json");
    if decision.exists() {
        fs::copy(
            &decision,
            m.directory().join(format!("decision-{label}.json")),
        )
        .unwrap();
    }
    println!(
        "SCENARIO={label}; LOG={}; DECISION={}",
        m.directory().join(".migration-log.txt").display(),
        if decision.exists() {
            decision.display().to_string()
        } else {
            "aucune decision ecrite".into()
        }
    );
}

#[test]
fn e1_keep_missing_destination() {
    let m = fixture("E1-conserver");
    drop(account(&m.paths[0], "Compte ancien"));
    let source_bytes = fs::read(&m.paths[0]).unwrap();
    m.run(
        |c| {
            assert_eq!(c.len(), 1);
            Ok(Choice::Keep)
        },
        |_| panic!("Pas de consultation"),
    )
    .unwrap();
    assert_eq!(restored_name(&m.current), "Compte ancien");
    assert_eq!(fs::read(&m.paths[0]).unwrap(), source_bytes);
    assert_eq!(m.load().unwrap().unwrap().decision, DecisionKind::Keep);
    assert_eq!(
        fs::read_dir(m.directory().join("backups")).unwrap().count(),
        1
    );
    evidence(&m, "E1");
}

#[test]
fn e2_empty_remembers_source() {
    let m = fixture("E2-vide");
    drop(account(&m.paths[0], "Ancien"));
    run_choice(&m, Choice::Empty);
    assert!(!m.current.exists()); // Le plugin SQL, seul, creera ensuite la base vide.
    m.run(|_| panic!("Source deja refusee"), |_| Ok(()))
        .unwrap();
    assert_eq!(m.load().unwrap().unwrap().decision, DecisionKind::Empty);
    evidence(&m, "E2");
}

#[test]
fn e3_three_closures_and_pause() {
    let mut m = fixture("E3-fermetures");
    drop(account(&m.paths[0], "Ancien"));
    assert!(!m.current.exists());
    for n in 1..=3 {
        run_choice(&m, Choice::Closed);
        let d = m.load().unwrap().unwrap();
        assert_eq!(d.no_choice_count, n);
        assert!(d.source_path.is_none());
        assert_eq!(d.decision, DecisionKind::Deferred);
        evidence(&m, &format!("E3-fermeture-{n}"));
        if n == 1 {
            // Simuler l'ouverture SQL suivante, sans creer de compte : la base
            // absente devient un schema vide, qui reste eligible a la recuperation.
            Connection::open(&m.current)
                .unwrap()
                .execute_batch("CREATE TABLE utilisateurs (id INTEGER);")
                .unwrap();
        }
    }
    assert_eq!(
        m.load().unwrap().unwrap().skip_until,
        Some(m.now + PAUSE_SECONDS)
    );
    m.now += 1;
    m.run(
        |_| panic!("Quatrieme lancement pendant la pause"),
        |_| Ok(()),
    )
    .unwrap();
    evidence(&m, "E3-lancement-4");
    m.now += PAUSE_SECONDS;
    run_choice(&m, Choice::Closed);
    let d = m.load().unwrap().unwrap();
    assert_eq!(d.no_choice_count, 1);
    assert!(d.skip_until.is_none());
    evidence(&m, "E3-apres-pause");
}

#[test]
fn e4_current_account_is_protected() {
    let m = fixture("E4-compte-existant");
    drop(account(&m.current, "Compte actuel"));
    drop(account(&m.paths[0], "Ancien"));
    let original = fs::read(&m.current).unwrap();
    m.run(
        |_| panic!("Aucun dialogue avec un compte existant"),
        |_| Ok(()),
    )
    .unwrap();
    assert_eq!(fs::read(&m.current).unwrap(), original);
    assert!(!m.directory().join(".migration-decision.json").exists());
    evidence(&m, "E4");
}

#[test]
fn e5_wal_is_included_in_single_db() {
    let m = fixture("E5-WAL");
    let source = Connection::open(&m.paths[0]).unwrap();
    source
        .execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; \
        CREATE TABLE utilisateurs (id INTEGER PRIMARY KEY, nom TEXT); \
        INSERT INTO utilisateurs (nom) VALUES ('Compte uniquement dans WAL');",
        )
        .unwrap();
    assert!(
        fs::metadata(format!("{}-wal", m.paths[0].display()))
            .unwrap()
            .len()
            > 0
    );
    run_choice(&m, Choice::Keep);
    assert_eq!(restored_name(&m.current), "Compte uniquement dans WAL");
    assert!(!PathBuf::from(format!("{}-wal", m.current.display())).exists());
    assert_eq!(
        source
            .query_row("SELECT nom FROM utilisateurs", [], |r| r
                .get::<_, String>(0))
            .unwrap(),
        "Compte uniquement dans WAL"
    );
    evidence(&m, "E5");
}

#[test]
fn e6_multiple_candidates_choose_latest() {
    let mut m = fixture("E6-plusieurs");
    let newer = m.directory().parent().unwrap().join("recent.db");
    drop(account(&m.paths[0], "Ancien"));
    drop(account(&newer, "Plus recent"));
    let old_time = File::options().write(true).open(&m.paths[0]).unwrap();
    old_time
        .set_modified(UNIX_EPOCH + Duration::from_secs(100))
        .unwrap();
    m.paths.extend([newer.clone(), newer]); // Le doublon doit disparaitre.
    m.run(
        |c| {
            assert_eq!(c.len(), 2);
            assert!(dialog_text(c).contains("recent.db"));
            Ok(Choice::Keep)
        },
        |_| Ok(()),
    )
    .unwrap();
    assert_eq!(restored_name(&m.current), "Plus recent");
    evidence(&m, "E6");
}

#[test]
fn e7_dialog_failure_does_not_block() {
    let m = fixture("E7-erreur-dialogue");
    drop(account(&m.paths[0], "Ancien"));
    m.run(|_| Err("Erreur de dialogue simulee".into()), |_| Ok(()))
        .unwrap();
    assert!(!m.current.exists());
    assert!(!m.directory().join(".migration-decision.json").exists());
    assert!(fs::read_to_string(m.directory().join(".migration-log.txt"))
        .unwrap()
        .contains("Echec du dialogue"));
    evidence(&m, "E7");
}

#[test]
fn view_does_not_memorize_a_choice() {
    let m = fixture("consultation");
    drop(account(&m.paths[0], "Ancien"));
    let (mut asks, mut views) = (0, 0);
    m.run(
        |_| {
            asks += 1;
            Ok(if asks == 1 {
                Choice::View
            } else {
                Choice::Closed
            })
        },
        |_| {
            views += 1;
            assert!(!m.directory().join(".migration-decision.json").exists());
            Ok(())
        },
    )
    .unwrap();
    assert_eq!((asks, views), (2, 1));
    assert!(m.load().unwrap().unwrap().source_path.is_none());
}

#[test]
fn nonempty_business_data_and_corrupt_current_are_never_overwritten() {
    let m = fixture("protection-donnees");
    drop(account(&m.paths[0], "Ancien"));
    let current = Connection::open(&m.current).unwrap();
    current
        .execute_batch("CREATE TABLE ventes (id INTEGER); INSERT INTO ventes VALUES (1);")
        .unwrap();
    drop(current);
    assert!(m.restore(&m.paths[0]).is_err());
    let invalid = fixture("protection-corruption");
    fs::write(&invalid.current, b"Ceci ne doit jamais etre ecrase").unwrap();
    assert!(initialized(&invalid.current).is_err());
    assert_eq!(
        fs::read(&invalid.current).unwrap(),
        b"Ceci ne doit jamais etre ecrase"
    );
}

#[test]
fn backups_never_overwrite_and_empty_schema_can_be_restored() {
    let m = fixture("sauvegardes-uniques");
    drop(account(&m.paths[0], "Ancien"));
    for _ in 0..2 {
        if m.current.exists() {
            fs::remove_file(&m.current).unwrap();
        }
        let c = Connection::open(&m.current).unwrap();
        c.execute_batch("CREATE TABLE users (id INTEGER);").unwrap();
        drop(c);
        assert!(!initialized(&m.current).unwrap());
        m.restore(&m.paths[0]).unwrap();
    }
    assert_eq!(
        fs::read_dir(m.directory().join("backups")).unwrap().count(),
        2
    );
}

#[test]
fn invalid_and_case_duplicate_candidates_are_filtered() {
    let mut m = fixture("filtrage");
    drop(account(&m.paths[0], "Ancien"));
    let bad = m.directory().parent().unwrap().join("invalid.db");
    fs::write(&bad, b"pas SQLite").unwrap();
    m.paths.extend([
        PathBuf::from(m.paths[0].to_string_lossy().to_uppercase()),
        m.current.clone(),
        bad,
    ]);
    assert_eq!(m.candidates().len(), 1);
}

#[test]
fn refusals_remain_memorized_when_a_new_source_appears() {
    let mut m = fixture("refus-par-source");
    drop(account(&m.paths[0], "Ancien"));
    run_choice(&m, Choice::Empty);
    let other = m.directory().parent().unwrap().join("other.db");
    drop(account(&other, "Autre"));
    m.paths.push(other);
    m.run(
        |c| {
            assert_eq!(c.len(), 1);
            Ok(Choice::Empty)
        },
        |_| Ok(()),
    )
    .unwrap();
    m.run(
        |_| panic!("Les deux sources sont deja refusees"),
        |_| Ok(()),
    )
    .unwrap();
    assert_eq!(m.load().unwrap().unwrap().candidates.len(), 2);
}

#[test]
fn timestamps_are_utc() {
    assert_eq!(stamp(0, false), "1970-01-01T00:00:00Z");
    assert_eq!(stamp(1_704_067_200, true), "20240101-000000");
}

/// Controle reel du backend Windows, uniquement sur une boite de test sans copie.
/// Les commandes ciblees utilisent un titre unique et ne touchent aucune autre fenetre.
#[cfg(windows)]
#[test]
fn windows_native_dialog_foreground_buttons_and_close() {
    use windows_sys::Win32::UI::{
        Controls::TDM_CLICK_BUTTON,
        WindowsAndMessaging::{
            FindWindowW, GetForegroundWindow, GetWindowLongPtrW, IsWindowVisible, PostMessageW,
            GWL_EXSTYLE, WM_CLOSE, WS_EX_TOPMOST,
        },
    };
    let m = fixture("dialogue-Windows");
    drop(account(&m.paths[0], "Compte de test"));
    let candidates = m.candidates();
    for (button, expected) in [
        (1001, Choice::Keep),
        (1002, Choice::Empty),
        (1003, Choice::View),
        (0, Choice::Closed),
    ] {
        let title = format!("Test récupération SQLite {} — {button}", std::process::id());
        let title_wide = title.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
        let controller = std::thread::spawn(move || {
            let deadline = Instant::now() + Duration::from_secs(10);
            loop {
                let hwnd = unsafe { FindWindowW(std::ptr::null(), title_wide.as_ptr()) };
                if !hwnd.is_null() {
                    // Attendre la notification de creation et l'activation du dialogue.
                    std::thread::sleep(Duration::from_millis(150));
                    let foreground = unsafe { GetForegroundWindow() == hwnd };
                    let above_windows = unsafe {
                        IsWindowVisible(hwnd) != 0
                            && (GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32 & WS_EX_TOPMOST) != 0
                    };
                    let posted = unsafe {
                        if button == 0 {
                            PostMessageW(hwnd, WM_CLOSE, 0, 0)
                        } else {
                            PostMessageW(hwnd, TDM_CLICK_BUTTON as u32, button, 0)
                        }
                    };
                    return (foreground, above_windows, posted != 0);
                }
                if Instant::now() >= deadline {
                    return (false, false, false);
                }
                std::thread::sleep(Duration::from_millis(20));
            }
        });
        let result = windows_dialog(&candidates, &title);
        let (foreground, above_windows, posted) = controller.join().unwrap();
        assert!(posted, "Dialogue natif introuvable : {result:?}");
        assert!(
            above_windows,
            "Le dialogue doit etre visible au-dessus des autres fenetres"
        );
        assert_eq!(result.unwrap(), expected);
        m.log(&format!("Test dialogue Windows : bouton={button}, visible au-dessus={above_windows}, focus accorde par Windows={foreground}, resultat={expected:?}"));
    }
    evidence(&m, "dialogue-Windows");
}
