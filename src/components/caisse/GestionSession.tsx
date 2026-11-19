// src/components/caisse/GestionSession.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, Stack, Text, TextInput, NumberInput, Button, Group,
  Badge, Paper, Divider, Table, ScrollArea, Textarea, Alert,
  ThemeIcon, Title, Grid, Card, ActionIcon, Tooltip, Checkbox
} from '@mantine/core';
import {
  IconLogin, IconLogout, IconUser, IconCash,
  IconPrinter, IconHistory, IconAlertCircle,
  IconArrowUpRight, IconArrowDownRight, IconRefresh,
  IconFileText
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { sessionCaisseService, SessionCaisse } from '../../services/sessionCaisseService';
import { journalCaisseService } from '../../services/journalCaisseService';
import { useAuth } from '../../contexts/AuthContext';
import { rapportVenteService, RapportVente } from '../../services/rapportVenteService';
import { imprimerRapportVente } from '../../utils/rapportVenteHtml';
import { formatImpressionService } from '../../utils/printFormats';

interface Props {
  onSessionChange?: () => void;
}

const fmt = (n: number) => (n || 0).toLocaleString('fr-FR');
const fmtDate = (d: string) => {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('fr-FR') + ' ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

/* ── Rapport de fin de poste (impression) ─────────────────────────────
   Le rapport est désormais construit par rapportVenteService et rendu par
   rapportVenteHtml : même document que celui de l'écran « Rapports de
   vente », avec la ventilation par mode de paiement et le format papier
   choisi dans les Paramètres. Il reste consultable après coup. */
const imprimerRapport = async (session: SessionCaisse) => {
  try {
    const [rapport, format] = await Promise.all([
      rapportVenteService.construire({ idSession: session.idSession }),
      formatImpressionService.getFormatDefaut(),
    ]);
    imprimerRapportVente(rapport, { format });
  } catch (err: any) {
    notifications.show({
      title: 'Erreur',
      message: err?.message || "Impossible de générer le rapport",
      color: 'red',
    });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════════════════════════════════ */
export const GestionSession: React.FC<Props> = ({ onSessionChange }) => {
  const { user, logout } = useAuth();
  const [sessionActive, setSessionActive] = useState<SessionCaisse | null>(null);
  const [historique, setHistorique] = useState<SessionCaisse[]>([]);
  const [loading, setLoading] = useState(false);

  // Retrait / prélèvement patron
  const [retraitModal, setRetraitModal] = useState(false);
  const [retraitMontant, setRetraitMontant] = useState<number>(0);
  const [retraitMotif, setRetraitMotif] = useState('');
  const [retraitLoading, setRetraitLoading] = useState(false);
  const [soldeCaisse, setSoldeCaisse] = useState<number>(0);

  // Ouverture
  const [ouvertureModal, setOuvertureModal] = useState(false);
  const [nomOperateur, setNomOperateur] = useState('');
  const [soldeInitial, setSoldeInitial] = useState<number>(0);
  const [notesOuverture, setNotesOuverture] = useState('');

  // Fermeture
  const [fermetureModal, setFermetureModal] = useState(false);
  const [passerLaMain, setPasserLaMain] = useState(false);
  const [soldeDeclare, setSoldeDeclare] = useState<number>(0);
  const [notesFermeture, setNotesFermeture] = useState('');
  const [sessionFermee, setSessionFermee] = useState<SessionCaisse | null>(null);
  const [entreesFermee, setEntreesFermee] = useState<any[]>([]);
  const [resumeCloture, setResumeCloture] = useState<RapportVente | null>(null);

  // Historique
  const [historiqueModal, setHistoriqueModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [sessionDetail, setSessionDetail] = useState<SessionCaisse | null>(null);
  const [entreesDetail, setEntreesDetail] = useState<any[]>([]);

  const sessionOperateurDifferent = Boolean(
    sessionActive && user && (
      (sessionActive.idUtilisateur != null && Number(sessionActive.idUtilisateur) !== Number(user.id)) ||
      (sessionActive.idUtilisateur == null && sessionActive.nom_operateur !== user.nom)
    )
  );

  const charger = useCallback(async () => {
    const s = await sessionCaisseService.chargerSessionActive();
    setSessionActive(s);
    const h = await sessionCaisseService.getHistoriqueSessiones(20);
    setHistorique(h);
  }, []);

  useEffect(() => { charger(); }, [charger, user?.id]);

  /* ── Préparer l'ouverture : opérateur + report renseignés automatiquement ── */
  const openOuverture = async () => {
    setNomOperateur(user?.nom || '');
    try {
      const report = await sessionCaisseService.getReportSuggere();
      setSoldeInitial(report);
    } catch { setSoldeInitial(0); }
    setNotesOuverture('');
    setOuvertureModal(true);
  };

  /* ── Ouvrir un poste ─────────────────────────────────────────────── */
  const handleOuvrir = async () => {
    if (!nomOperateur.trim()) {
      notifications.show({ title: 'Erreur', message: 'Saisissez le nom de l\'opérateur', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      await sessionCaisseService.ouvrirSession(nomOperateur || user?.nom || '', soldeInitial, notesOuverture, user?.id ?? null);
      await charger();
      setOuvertureModal(false);
      setNomOperateur(''); setSoldeInitial(0); setNotesOuverture('');
      notifications.show({ title: 'Poste ouvert', message: `Bienvenue ${nomOperateur} !`, color: 'green' });
      onSessionChange?.();
    } catch (err: any) {
      notifications.show({ title: 'Erreur', message: err?.message || 'Impossible d\'ouvrir le poste', color: 'red' });
    } finally { setLoading(false); }
  };

  const openFermeture = async () => {
    if (!sessionActive) return;
    if (sessionOperateurDifferent) {
      notifications.show({ title: 'Session protégée', message: 'Cette session appartient à un autre opérateur.', color: 'red' });
      return;
    }
    setSoldeDeclare(0);
    setPasserLaMain(false);
    setResumeCloture(null);
    setFermetureModal(true);
    try {
      setResumeCloture(await rapportVenteService.construire({ idSession: sessionActive.idSession }));
    } catch {
      // La clôture reste possible ; seul le bilan en direct n'a pas pu être chargé.
    }
  };
  /* ── Fermer le poste ─────────────────────────────────────────────── */
  const handleFermer = async () => {
    if (soldeDeclare < 0) {
      notifications.show({ title: 'Erreur', message: 'Saisissez le montant compté en caisse', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      const s = await sessionCaisseService.fermerSession(soldeDeclare, notesFermeture);
      setFermetureModal(false);
      setSoldeDeclare(0); setNotesFermeture('');
      // Impression du rapport de clôture
      setTimeout(() => imprimerRapport(s), 400);

      if (passerLaMain) {
        // Relève : on pose le drapeau PUIS on déconnecte, SANS rafraîchir la vue
        // locale (pas de charger()). Sinon sessionActive passerait à null ici et
        // l'ouverture-auto consommerait le drapeau pour le SORTANT. On laisse donc
        // le nouvel opérateur (après reconnexion) déclencher l'ouverture.
        try { localStorage.setItem('gc_releve_pending', '1'); } catch {}
        notifications.show({
          title: 'Relève',
          message: `Poste de ${s.nom_operateur} clôturé. Déconnexion pour laisser la main au suivant…`,
          color: 'teal',
        });
        onSessionChange?.();
        setTimeout(() => logout(), 1500);
        return;
      }

      // Clôture simple : on rafraîchit la vue.
      const entrees = await sessionCaisseService.getEntreesSession(s.idSession);
      setSessionFermee(s);
      setEntreesFermee(entrees);
      await charger();
      onSessionChange?.();
      notifications.show({ title: 'Poste fermé', message: `Bilan de ${s.nom_operateur} enregistré`, color: 'teal' });
    } catch (err: any) {
      notifications.show({ title: 'Erreur', message: err?.message || 'Impossible de fermer le poste', color: 'red' });
    } finally { setLoading(false); }
  };

  /* ── Retrait / prélèvement patron ───────────────────────────────── */
  const openRetrait = async () => {
    if (sessionOperateurDifferent) {
      notifications.show({ title: 'Session protégée', message: 'Cette session appartient à un autre opérateur.', color: 'red' });
      return;
    }
    setRetraitMontant(0);
    setRetraitMotif('');
    setRetraitModal(true);
    try { setSoldeCaisse(await journalCaisseService.getSoldeActuel()); }
    catch { setSoldeCaisse(0); }
  };

  const handleRetrait = async () => {
    if (retraitMontant <= 0) {
      notifications.show({ title: 'Erreur', message: 'Saisissez le montant à retirer', color: 'red' });
      return;
    }
    setRetraitLoading(true);
    try {
      await journalCaisseService.retraitPatron({ montant: retraitMontant, motif: retraitMotif || undefined });
      notifications.show({
        title: 'Retrait enregistré',
        message: `${fmt(retraitMontant)} F retirés de la caisse.`,
        color: 'teal',
      });
      setRetraitModal(false);
      await charger();
      onSessionChange?.();
    } catch (err: any) {
      notifications.show({ title: 'Erreur', message: err?.message || 'Retrait impossible', color: 'red' });
    } finally { setRetraitLoading(false); }
  };

  // Ouverture AUTOMATIQUE du poste après une relève : dès que le nouvel
  // opérateur se connecte et qu'aucun poste n'est ouvert, on ouvre directement
  // son poste (opérateur = utilisateur connecté, fond = report). Pas de modale
  // ni de clic. En cas d'échec, on retombe sur l'ouverture manuelle.
  useEffect(() => {
    // Ne jamais attribuer une relève tant que le compte connecté n'est pas connu.
    if (loading || !user?.id || !user.nom) return;
    let pending = false;
    try { pending = localStorage.getItem('gc_releve_pending') === '1'; } catch {}
    const mismatch = Boolean(sessionActive && (
      (sessionActive.idUtilisateur != null && Number(sessionActive.idUtilisateur) !== Number(user.id)) ||
      (sessionActive.idUtilisateur == null && sessionActive.nom_operateur !== user.nom)
    ));
    // Répare également les relevés vides créés par une ancienne version qui
    // consommait le drapeau avant que le nouvel utilisateur soit disponible.
    if (!pending && !mismatch) return;

    (async () => {
      if (sessionActive) {
        if (!mismatch) return;

        const corrigee = await sessionCaisseService.reattribuerOuvertureAutomatique(
          sessionActive.idSession, user.nom, user.id
        );
        if (corrigee) {
          try {
            localStorage.removeItem('gc_releve_pending');
            localStorage.setItem('gc_releve_completed', '1');
          } catch {}
          await charger();
          onSessionChange?.();
          notifications.show({ title: 'Relève corrigée', message: `Poste attribué à ${user.nom}.`, color: 'green' });
        } else if (pending) {
          notifications.show({
            title: 'Session d’un autre opérateur',
            message: `Le poste ouvert appartient à ${sessionActive.nom_operateur}. Il reste protégé.`,
            color: 'orange',
          });
        }
        return;
      }

      try {
        const report = await sessionCaisseService.getReportSuggere();
        await sessionCaisseService.ouvrirSession(user.nom, Number(report) || 0, 'Ouverture automatique après relève', user.id);
        try {
          localStorage.removeItem('gc_releve_pending');
          localStorage.setItem('gc_releve_completed', '1');
        } catch {}
        await charger();
        onSessionChange?.();
        notifications.show({ title: 'Nouveau poste ouvert', message: `Gestion démarrée automatiquement (report ${fmt(Number(report) || 0)} F).`, color: 'green' });
      } catch {
        openOuverture();
      }
    })();
    // openOuverture is intentionally excluded: it only runs as a fallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionActive, loading, user?.id, user?.nom]);

  /* ── Voir détail session historique ─────────────────────────────── */
  const voirDetail = async (s: SessionCaisse) => {
    const entrees = await sessionCaisseService.getEntreesSession(s.idSession);
    setSessionDetail(s);
    setEntreesDetail(entrees);
    setDetailModal(true);
  };

  /* ── Bannière session active ─────────────────────────────────────── */
  const BanniereActive = () => (
    <Paper p="sm" radius="md" withBorder className="tk-page-tools tk-page-tools--fiche">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm">
          <ThemeIcon color="green" variant="filled" radius="xl" size="lg">
            <IconUser size={18} />
          </ThemeIcon>
          <div>
            <Text c="white" fw={700} size="sm">{sessionActive!.nom_operateur}</Text>
            <Text c="rgba(255,255,255,0.6)" size="xs">
              {sessionActive!.code_session} · Ouvert depuis {fmtDate(sessionActive!.date_ouverture)}
            </Text>
          </div>
        </Group>
        <Group gap="xs">
          <Badge color="green" variant="filled" size="sm">Poste ouvert</Badge>
          <Tooltip label="Clôturer le poste (option relève : passer la main)">
            <Button
              size="xs"
              color="orange"
              variant="light"
              leftSection={<IconLogout size={14} />}
              onClick={openFermeture}
              disabled={sessionOperateurDifferent}
            >
              Clôturer
            </Button>
          </Tooltip>
          <Tooltip label="Retrait / prélèvement du patron (sortie de caisse)">
            <Button
              size="xs"
              color="grape"
              variant="light"
              leftSection={<IconArrowDownRight size={14} />}
              onClick={openRetrait}
              disabled={sessionOperateurDifferent}
            >
              Retrait patron
            </Button>
          </Tooltip>
          <Tooltip label="Historique des postes">
            <ActionIcon variant="subtle" color="gray" onClick={() => setHistoriqueModal(true)}>
              <IconHistory size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  );

  const BanniereInactive = () => (
    <Paper p="sm" radius="md" withBorder className="tk-page-tools tk-page-tools--fiche">
      <Group justify="space-between">
        <Group gap="sm">
          <ThemeIcon color="orange" variant="filled" radius="xl" size="lg">
            <IconAlertCircle size={18} />
          </ThemeIcon>
          <div>
            <Text c="white" fw={700} size="sm">Aucun poste ouvert</Text>
            <Text c="rgba(255,255,255,0.6)" size="xs">Ouvrez un poste pour commencer la prise en charge</Text>
          </div>
        </Group>
        <Group gap="xs">
          <Button
            size="xs"
            color="green"
            leftSection={<IconLogin size={14} />}
            onClick={openOuverture}
          >
            Ouvrir un poste
          </Button>
          <Tooltip label="Retrait / prélèvement du patron (sortie de caisse)">
            <Button
              size="xs"
              color="grape"
              variant="light"
              leftSection={<IconArrowDownRight size={14} />}
              onClick={openRetrait}
              disabled={sessionOperateurDifferent}
            >
              Retrait patron
            </Button>
          </Tooltip>
          <Tooltip label="Historique des postes">
            <ActionIcon variant="subtle" color="gray" onClick={() => setHistoriqueModal(true)}>
              <IconHistory size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  );

  return (
    <>
      {sessionActive ? <BanniereActive /> : <BanniereInactive />}
      {sessionOperateurDifferent && (
        <Alert color="orange" variant="light" icon={<IconAlertCircle size={16} />}>
          Ce poste est ouvert par <b>{sessionActive?.nom_operateur}</b>, tandis que vous êtes connecté en tant que <b>{user?.nom}</b>.
          Les opérations de caisse sont verrouillées pour préserver la traçabilité.
        </Alert>
      )}

      {/* ── Modal retrait / prélèvement patron ───────────────────────── */}
      <Modal
        opened={retraitModal}
        onClose={() => setRetraitModal(false)}
        title={<Group gap="xs"><IconArrowDownRight size={18} /><Text fw={700}>Retrait du patron</Text></Group>}
        centered size="sm"
      >
        <Stack gap="md">
          <Alert color="grape" variant="light" icon={<IconCash size={16} />}>
            Sortie d'argent de la caisse (tout ou partie). L'opération est tracée
            dans le journal et <b>diminue le solde de caisse</b>.
          </Alert>
          <Card withBorder p="xs" bg="gray.0">
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Solde de caisse actuel</Text>
              <Text fw={700}>{fmt(soldeCaisse)} F</Text>
            </Group>
          </Card>
          <NumberInput
            label="Montant à retirer"
            value={retraitMontant}
            onChange={(v) => setRetraitMontant(Number(v) || 0)}
            min={0}
            thousandSeparator=" "
            leftSection={<IconCash size={16} />}
          />
          <Button
            variant="subtle" size="xs"
            onClick={() => setRetraitMontant(soldeCaisse > 0 ? soldeCaisse : 0)}
          >
            Tout retirer ({fmt(soldeCaisse)} F)
          </Button>
          <TextInput
            label="Motif (optionnel)"
            placeholder="Ex. dépôt banque, versement propriétaire…"
            value={retraitMotif}
            onChange={(e) => setRetraitMotif(e.target.value)}
          />
          <Group justify="flex-end">
            <Button variant="outline" color="gray" onClick={() => setRetraitModal(false)}>Annuler</Button>
            <Button color="grape" loading={retraitLoading} leftSection={<IconArrowDownRight size={16} />} onClick={handleRetrait}>
              Confirmer le retrait
            </Button>
          </Group>
        </Stack>
      </Modal>


      {/* ── Modal ouverture de poste ─────────────────────────────────── */}
      <Modal
        opened={ouvertureModal}
        onClose={() => setOuvertureModal(false)}
        title={<Group gap="xs"><IconLogin size={18} /><Text fw={700}>Ouvrir un poste</Text></Group>}
        centered size="sm"
      >
        <Stack gap="md">
          <Alert color="blue" variant="light" icon={<IconUser size={16} />}>
            Saisissez votre nom et le montant du fond de caisse que vous avez reçu du collègue précédent.
          </Alert>
          <TextInput
            label="Nom de l'opérateur"
            description="Renseigné automatiquement depuis l'utilisateur connecté"
            placeholder="Prénom et nom"
            value={nomOperateur}
            onChange={e => setNomOperateur(e.target.value)}
            readOnly={!!user?.nom}
            required
          />
          <NumberInput
            label="Report — Fond de caisse reçu (FCFA)"
            description="Pré-rempli avec le solde de clôture du poste précédent"
            placeholder="0"
            value={soldeInitial}
            onChange={v => setSoldeInitial(Number(v) || 0)}
            min={0}
            thousandSeparator=" "
            leftSection={<IconCash size={14} />}
          />
          <Textarea
            label="Notes (optionnel)"
            placeholder="Consignes reçues, observations..."
            value={notesOuverture}
            onChange={e => setNotesOuverture(e.target.value)}
            rows={2}
          />
          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setOuvertureModal(false)}>Annuler</Button>
            <Button
              color="green"
              leftSection={<IconLogin size={16} />}
              onClick={handleOuvrir}
              loading={loading}
            >
              Ouvrir le poste
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Modal fermeture de poste ─────────────────────────────────── */}
      <Modal
        opened={fermetureModal}
        onClose={() => setFermetureModal(false)}
        title={<Group gap="xs"><IconLogout size={18} /><Text fw={700}>Clôturer le poste</Text></Group>}
        centered size="md"
      >
        <Stack gap="md">
          {sessionActive && (
            <>
            <Paper p="md" radius="md" withBorder>
              <Group gap="sm" mb="xs">
                <IconUser size={16} />
                <Text fw={700}>{sessionActive.nom_operateur}</Text>
                <Badge color="green" size="xs">En cours</Badge>
              </Group>
              <Text size="xs" c="dimmed">Début de poste : {fmtDate(sessionActive.date_ouverture)}</Text>
              <Text size="xs" c="dimmed">Fond de caisse initial : {fmt(sessionActive.solde_initial)} F</Text>
            </Paper>
            {resumeCloture && (
              <Paper p="sm" radius="md" withBorder bg="blue.0">
                <Text fw={700} size="sm" mb={4}>Bilan provisoire avant clôture</Text>
                <Grid>
                  <Grid.Col span={6}><Text size="xs" c="dimmed">Entrées</Text><Text fw={600} c="green">+{fmt(resumeCloture.totalEntrees)} F</Text></Grid.Col>
                  <Grid.Col span={6}><Text size="xs" c="dimmed">Sorties</Text><Text fw={600} c="red">-{fmt(resumeCloture.totalSorties)} F</Text></Grid.Col>
                  <Grid.Col span={6}><Text size="xs" c="dimmed">Espèces attendues</Text><Text fw={700}>{fmt(resumeCloture.especesAttendues)} F</Text></Grid.Col>
                  <Grid.Col span={6}><Text size="xs" c="dimmed">Solde théorique</Text><Text fw={700}>{fmt(resumeCloture.soldeCalcule)} F</Text></Grid.Col>
                </Grid>
                <Text size="xs" c="dimmed" mt={4}>Ventes : {fmt(resumeCloture.totalVentesComptoir)} F · Charges : {fmt(resumeCloture.totalCharges)} F</Text>
              </Paper>
            )}
            </>
          )}

          <Alert color="orange" variant="light" icon={<IconCash size={16} />}>
            Comptez physiquement le contenu de la caisse et saisissez le montant ci-dessous.
            Le système calculera automatiquement l'écart.
          </Alert>

          <NumberInput
            label="Montant compté en caisse (FCFA)"
            placeholder="0"
            value={soldeDeclare}
            onChange={v => setSoldeDeclare(Number(v) || 0)}
            min={0}
            thousandSeparator=" "
            leftSection={<IconCash size={14} />}
            required
          />
          <Textarea
            label="Notes / consignes pour le suivant (optionnel)"
            placeholder="Points importants à transmettre..."
            value={notesFermeture}
            onChange={e => setNotesFermeture(e.target.value)}
            rows={3}
          />

          <Checkbox
            checked={passerLaMain}
            onChange={(e) => setPasserLaMain(e.currentTarget.checked)}
            label="Passer la main à un autre opérateur (relève)"
            description="Après clôture, vous serez déconnecté. Le nouvel opérateur se connecte et son poste s'ouvre automatiquement (fond reporté)."
          />

          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setFermetureModal(false)}>Annuler</Button>
            <Button
              color={passerLaMain ? 'teal' : 'orange'}
              leftSection={passerLaMain ? <IconRefresh size={16} /> : <IconLogout size={16} />}
              onClick={handleFermer}
              loading={loading}
            >
              {passerLaMain ? 'Clôturer et passer la main' : 'Clôturer et imprimer le rapport'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Modal historique ─────────────────────────────────────────── */}
      <Modal
        opened={historiqueModal}
        onClose={() => setHistoriqueModal(false)}
        title={<Group gap="xs"><IconHistory size={18} /><Text fw={700}>Historique des postes</Text></Group>}
        centered size="xl"
      >
        <Group justify="flex-end" mb="sm">
          <ActionIcon variant="subtle" onClick={charger}><IconRefresh size={16} /></ActionIcon>
        </Group>
        <ScrollArea h={420}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Code</Table.Th>
                <Table.Th>Opérateur</Table.Th>
                <Table.Th>Ouverture</Table.Th>
                <Table.Th>Fermeture</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Entrées</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Sorties</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Écart</Table.Th>
                <Table.Th>Statut</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {historique.map(s => {
                const ecart = s.ecart || 0;
                const ecartColor = ecart === 0 ? 'green' : ecart > 0 ? 'blue' : 'red';
                return (
                  <Table.Tr key={s.idSession}>
                    <Table.Td><Text size="xs" fw={500}>{s.code_session}</Text></Table.Td>
                    <Table.Td><Text size="xs">{s.nom_operateur}</Text></Table.Td>
                    <Table.Td><Text size="xs">{fmtDate(s.date_ouverture)}</Text></Table.Td>
                    <Table.Td><Text size="xs">{s.date_fermeture ? fmtDate(s.date_fermeture) : '—'}</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="xs" c="green">+{fmt(s.total_entrees)} F</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="xs" c="red">−{fmt(s.total_sorties)} F</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="xs" c={ecartColor} fw={600}>
                        {ecart === 0 ? '—' : (ecart > 0 ? '+' : '') + fmt(ecart) + ' F'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={s.statut === 'OUVERTE' ? 'green' : 'gray'} size="xs">
                        {s.statut === 'OUVERTE' ? 'En cours' : 'Fermé'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Tooltip label="Voir le détail">
                          <ActionIcon size="sm" variant="subtle" onClick={() => voirDetail(s)}>
                            <IconFileText size={14} />
                          </ActionIcon>
                        </Tooltip>
                        {s.statut === 'FERMEE' && (
                          <Tooltip label="Ré-imprimer le rapport">
                            <ActionIcon size="sm" variant="subtle" color="blue"
                              onClick={async () => {
                                const entrees = await sessionCaisseService.getEntreesSession(s.idSession);
                                imprimerRapport(s);
                              }}>
                              <IconPrinter size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Modal>

      {/* ── Modal détail session ─────────────────────────────────────── */}
      <Modal
        opened={detailModal}
        onClose={() => setDetailModal(false)}
        title={<Group gap="xs"><IconFileText size={18} />
          <Text fw={700}>Poste : {sessionDetail?.code_session}</Text></Group>}
        centered size="lg"
      >
        {sessionDetail && (
          <Stack gap="md">
            <Grid>
              <Grid.Col span={6}>
                <Card withBorder p="sm" radius="md">
                  <Text size="xs" c="dimmed">Opérateur</Text>
                  <Text fw={700}>{sessionDetail.nom_operateur}</Text>
                  <Text size="xs" c="dimmed" mt={4}>Ouverture</Text>
                  <Text size="sm">{fmtDate(sessionDetail.date_ouverture)}</Text>
                  {sessionDetail.date_fermeture && <>
                    <Text size="xs" c="dimmed" mt={4}>Fermeture</Text>
                    <Text size="sm">{fmtDate(sessionDetail.date_fermeture)}</Text>
                  </>}
                </Card>
              </Grid.Col>
              <Grid.Col span={6}>
                <Card withBorder p="sm" radius="md">
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">Fond initial</Text>
                    <Text fw={600}>{fmt(sessionDetail.solde_initial)} F</Text>
                  </Group>
                  <Group justify="space-between" mt={4}>
                    <Text size="xs" c="dimmed" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <IconArrowUpRight size={12} style={{ color: 'green' }} /> Entrées
                    </Text>
                    <Text c="green" fw={600}>+{fmt(sessionDetail.total_entrees)} F</Text>
                  </Group>
                  <Group justify="space-between" mt={4}>
                    <Text size="xs" c="dimmed" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <IconArrowDownRight size={12} style={{ color: 'red' }} /> Sorties
                    </Text>
                    <Text c="red" fw={600}>−{fmt(sessionDetail.total_sorties)} F</Text>
                  </Group>
                  <Divider my={6} />
                  <Group justify="space-between">
                    <Text size="xs" fw={600}>Solde calculé</Text>
                    <Text fw={700}>{fmt(sessionDetail.solde_calcule || 0)} F</Text>
                  </Group>
                  {sessionDetail.statut === 'FERMEE' && <>
                    <Group justify="space-between" mt={4}>
                      <Text size="xs" fw={600}>Solde déclaré</Text>
                      <Text fw={700}>{fmt(sessionDetail.solde_declare || 0)} F</Text>
                    </Group>
                    <Group justify="space-between" mt={6} p="xs" style={{
                      background: (sessionDetail.ecart || 0) === 0 ? '#d3f9d8'
                        : (sessionDetail.ecart || 0) > 0 ? '#d0ebff' : '#ffe3e3',
                      borderRadius: 6
                    }}>
                      <Text size="xs" fw={700}>Écart</Text>
                      <Text fw={700} c={(sessionDetail.ecart || 0) === 0 ? 'green'
                        : (sessionDetail.ecart || 0) > 0 ? 'blue' : 'red'}>
                        {(sessionDetail.ecart || 0) === 0 ? 'Caisse juste ✓'
                          : (sessionDetail.ecart || 0) > 0
                            ? `Excédent +${fmt(sessionDetail.ecart)} F`
                            : `Manquant ${fmt(sessionDetail.ecart)} F`}
                      </Text>
                    </Group>
                  </>}
                </Card>
              </Grid.Col>
            </Grid>

            <Title order={6}>Opérations du poste ({entreesDetail.length})</Title>
            <ScrollArea h={220}>
              <Table striped fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Heure</Table.Th>
                    <Table.Th>Désignation</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Montant</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {entreesDetail.map(e => (
                    <Table.Tr key={e.idJournal}>
                      <Table.Td><Text size="xs">{fmtDate(e.date_journal)}</Text></Table.Td>
                      <Table.Td><Text size="xs">{e.designation}</Text></Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="xs" c={e.type_mouvement === 'ENTREE' ? 'green' : 'red'} fw={600}>
                          {e.type_mouvement === 'ENTREE' ? '+' : '−'}{fmt(e.montant)} F
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            <Group justify="flex-end">
              {sessionDetail.statut === 'FERMEE' && (
                <Button
                  size="sm"
                  leftSection={<IconPrinter size={14} />}
                  variant="outline"
                  onClick={() => imprimerRapport(sessionDetail)}
                >
                  Imprimer le rapport
                </Button>
              )}
              <Button size="sm" variant="subtle" onClick={() => setDetailModal(false)}>Fermer</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
};

export default GestionSession;
