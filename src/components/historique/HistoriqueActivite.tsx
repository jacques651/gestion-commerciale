// src/components/historique/HistoriqueActivite.tsx
// Journal d'activité : chronologie unifiée (lecture seule) de toutes les actions de l'application.
// Agrège les données existantes (ventes, commandes, factures, décomptes, règlements, charges,
// mouvements des revendeurs ponctuels, attestations) triées par date décroissante, avec filtres
// (recherche, type, sens entrée/sortie d'argent, opérateur, période) et impression type rapport.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Paper, Title, Text, Group, Badge, TextInput, MultiSelect, Select, Table,
  ScrollArea, Pagination, Loader, Center, ThemeIcon, ActionIcon, Tooltip, SimpleGrid, Button, Alert,
} from '@mantine/core';
import { IconHistory, IconSearch, IconRefresh, IconPrinter, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { getDb } from '../../database/db';
import TkFilters from '../TkFilters';
import { transactionService } from '../../services/transactionFacade';
import { useTransactionContext } from '../../hooks/useTransactionSnapshot';
import { OriginBadge } from '../ventes/TransactionsSummary';

type Sens = 'ENTREE' | 'SORTIE' | 'NEUTRE';

interface ActItem {
  key: string;
  date: string;
  type: string;
  color: string;
  code: string;
  description: string;
  montant: number | null;
  annule: boolean;
  sens: Sens;
  operateur: string;
  origin?: 'vente' | 'prestation';
}

const TYPES: { value: string; color: string }[] = [
  { value: 'Vente', color: 'teal' },
  { value: 'Prestation', color: 'teal' },
  { value: 'Commande', color: 'orange' },
  { value: 'Facture', color: 'cyan' },
  { value: 'Facture revendeur', color: 'indigo' },
  { value: 'Décompte', color: 'violet' },
  { value: 'Règlement', color: 'green' },
  { value: 'Charge', color: 'red' },
  { value: 'Appro ponctuel', color: 'blue' },
  { value: 'Vente ponctuel', color: 'teal' },
  { value: 'Retour ponctuel', color: 'grape' },
  { value: 'Attestation', color: 'pink' },
];
const colorOf = (t: string) => TYPES.find((x) => x.value === t)?.color || 'gray';

// Sens « argent » par défaut selon le type d'opération (garde-fou).
const SENS_PAR_TYPE: Record<string, Sens> = {
  'Vente': 'ENTREE',
  'Vente ponctuel': 'ENTREE',
  'Règlement': 'ENTREE',
  'Décompte': 'ENTREE',
  'Charge': 'SORTIE',
  'Commande': 'NEUTRE',
  'Facture': 'NEUTRE',
  'Facture revendeur': 'NEUTRE',
  'Appro ponctuel': 'NEUTRE',
  'Retour ponctuel': 'NEUTRE',
  'Attestation': 'NEUTRE',
};

const SENS_OPTIONS = [
  { value: 'ENTREE', label: "Entrée d'argent" },
  { value: 'SORTIE', label: "Sortie d'argent" },
  { value: 'NEUTRE', label: 'Neutre' },
];
const labelSens = (s: Sens) => (s === 'ENTREE' ? 'Entrée' : s === 'SORTIE' ? 'Sortie' : 'Neutre');

const fmtDateTime = (d?: string) => {
  if (!d) return '-';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '-' : dt.toLocaleString('fr-FR');
};
const fmtMontant = (v: number | null) => (v == null ? '' : `${Math.round(v).toLocaleString('fr-FR')} F`);

const HistoriqueActivite: React.FC = () => {
  const [items, setItems] = useState<ActItem[]>([]);
  const txContext = useTransactionContext();
  const [prestationError, setPrestationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typesFiltre, setTypesFiltre] = useState<string[]>([]);
  const [sensFiltre, setSensFiltre] = useState<string | null>(null);
  const [operateurFiltre, setOperateurFiltre] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 25;

  const load = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const safe = async (sql: string, params: any[] = []): Promise<any[]> => {
        try { return await db.select<any[]>(sql, params); } catch { return []; }
      };
      const out: ActItem[] = [];
      const push = (rows: any[], map: (r: any) => ActItem) => rows.forEach((r) => out.push(map(r)));

      // Correspondance idUtilisateur -> nom (trace l'opérateur là où c'est disponible).
      const users = await safe(`SELECT id, nom FROM utilisateurs`);
      const userNom = new Map<number, string>();
      users.forEach((u) => userNom.set(Number(u.id), u.nom));

      // Opérateur des opérations, retrouvé via l'écriture de caisse associée
      // (le journal de caisse trace désormais idUtilisateur). Chaque écriture
      // porte idReference = id de la vente / du décompte d'origine.
      const venteOp = new Map<number, string>();   // idVente -> opérateur
      const decompteOp = new Map<number, string>(); // idDecompte -> opérateur
      const journalColumns = await safe('PRAGMA table_info(journal_caisse)');
      const declaredOrigin = journalColumns.some(column => column.name === 'origin') ? 'origin' : 'NULL AS origin';
      (await safe(`
        SELECT categorie, idReference as id, idUtilisateur as uid, ${declaredOrigin}
        FROM journal_caisse
        WHERE idReference IS NOT NULL AND idUtilisateur IS NOT NULL
      `)).forEach((r) => {
        if (r.origin === 'prestation') return;
        const nom = userNom.get(Number(r.uid)) || '';
        if (!nom) return;
        if (r.categorie === 'VENTE_COMPTOIR') venteOp.set(Number(r.id), nom);
        else if (r.categorie === 'DECOMPTE_REVENDEUR') decompteOp.set(Number(r.id), nom);
      });

      // Ventes comptoir
      push(await safe(`
        SELECT v.idVente as id, v.date_vente as date, v.code_vente as code, v.montant_ttc as montant,
               COALESCE(cl.NomComplet, v.nom_prenom) as who, COALESCE(v.est_annule,0) as annule
        FROM ventes v LEFT JOIN clients cl ON cl.idClient = v.idClient
        ORDER BY v.date_vente DESC LIMIT 400`),
        (r) => ({ key: 'v' + r.id, date: r.date, type: 'Vente', color: colorOf('Vente'),
          code: r.code || '', description: r.who ? `Vente à ${r.who}` : 'Vente comptoir', montant: r.montant,
          annule: !!r.annule, sens: 'ENTREE', operateur: venteOp.get(Number(r.id)) || '' }));

      // Commandes
      push(await safe(`
        SELECT c.idCommande as id, c.date_commande as date, c.code_commande as code, c.montant_ttc as montant,
               cl.NomComplet as who, c.statut, COALESCE(c.est_annule,0) as annule
        FROM commandes c LEFT JOIN clients cl ON cl.idClient = c.idClient
        ORDER BY c.date_commande DESC LIMIT 400`),
        (r) => ({ key: 'c' + r.id, date: r.date, type: 'Commande', color: colorOf('Commande'),
          code: r.code || '', description: `Commande${r.who ? ' - ' + r.who : ''}${r.statut ? ' (' + r.statut + ')' : ''}`,
          montant: r.montant, annule: !!r.annule || r.statut === 'ANNULEE', sens: 'NEUTRE', operateur: '' }));

      // Factures standard
      push(await safe(`
        SELECT f.idFacture as id, f.date_facture as date, f.code_facture as code, f.montant_ttc as montant,
               cl.NomComplet as who, COALESCE(f.est_annule,0) as annule
        FROM factures f LEFT JOIN clients cl ON cl.idClient = f.idClient
        ORDER BY f.date_facture DESC LIMIT 400`),
        (r) => ({ key: 'f' + r.id, date: r.date, type: 'Facture', color: colorOf('Facture'),
          code: r.code || '', description: `Facture${r.who ? ' - ' + r.who : ''}`, montant: r.montant,
          annule: !!r.annule, sens: 'NEUTRE', operateur: '' }));

      // Factures revendeur
      push(await safe(`
        SELECT fr.idFactureRevendeur as id, fr.date_facture as date, fr.code_facture as code, fr.montant_ttc as montant,
               cl.NomComplet as who, COALESCE(fr.est_annule,0) as annule
        FROM factures_revendeur fr LEFT JOIN clients cl ON cl.idClient = fr.idRevendeur
        ORDER BY fr.date_facture DESC LIMIT 400`),
        (r) => ({ key: 'fr' + r.id, date: r.date, type: 'Facture revendeur', color: colorOf('Facture revendeur'),
          code: r.code || '', description: `Facture revendeur${r.who ? ' - ' + r.who : ''}`, montant: r.montant,
          annule: !!r.annule, sens: 'NEUTRE', operateur: '' }));

      // Décomptes
      push(await safe(`
        SELECT d.idDecompte as id, d.date_decompte as date, d.code_decompte as code,
               COALESCE(d.montant_net, d.montant_vente) as montant, cl.NomComplet as who,
               COALESCE(d.est_annule,0) as annule
        FROM decomptes d LEFT JOIN clients cl ON cl.idClient = d.idClient
        ORDER BY d.date_decompte DESC LIMIT 400`),
        (r) => ({ key: 'd' + r.id, date: r.date, type: 'Décompte', color: colorOf('Décompte'),
          code: r.code || '', description: `Décompte${r.who ? ' - ' + r.who : ''}`, montant: r.montant,
          annule: !!r.annule, sens: 'ENTREE', operateur: decompteOp.get(Number(r.id)) || '' }));

      // Règlements
      push(await safe(`
        SELECT r.idReglement as id, r.date_reglement as date, r.code_reglement as code, r.montant as montant,
               r.mode_reglement as mode
        FROM reglements r ORDER BY r.date_reglement DESC LIMIT 400`),
        (r) => ({ key: 'r' + r.id, date: r.date, type: 'Règlement', color: colorOf('Règlement'),
          code: r.code || '', description: `Règlement${r.mode ? ' (' + r.mode + ')' : ''}`, montant: r.montant,
          annule: false, sens: 'ENTREE', operateur: '' }));

      // Charges
      push(await safe(`
        SELECT ch.idCharge as id, ch.date_charge as date, ch.code_charge as code, ch.montant as montant,
               ch.designation, ch.beneficiaire, COALESCE(ch.est_annule,0) as annule
        FROM charges_fonctionnement ch ORDER BY ch.date_charge DESC LIMIT 400`),
        (r) => ({ key: 'ch' + r.id, date: r.date, type: 'Charge', color: colorOf('Charge'),
          code: r.code || '', description: `${r.designation || 'Charge'}${r.beneficiaire ? ' - ' + r.beneficiaire : ''}`,
          montant: r.montant, annule: !!r.annule, sens: 'SORTIE', operateur: '' }));

      // Appro revendeurs ponctuels
      push(await safe(`
        SELECT m.idMouvement as id, m.date_sortie as date, m.code_mouvement as code, m.montant_total as montant,
               rp.nom_complet as who, p.designation as produit
        FROM mouvements_revendeurs m
        LEFT JOIN revendeurs_ponctuels rp ON rp.idRevendeurPonctuel = m.idRevendeurPonctuel
        LEFT JOIN products p ON p.idProduit = m.idProduit
        ORDER BY m.date_sortie DESC LIMIT 400`),
        (r) => ({ key: 'mr' + r.id, date: r.date, type: 'Appro ponctuel', color: colorOf('Appro ponctuel'),
          code: r.code || '', description: `${r.produit || 'Article'}${r.who ? ' → ' + r.who : ''}`, montant: r.montant,
          annule: false, sens: 'NEUTRE', operateur: '' }));

      // Ventes / retours des revendeurs ponctuels
      push(await safe(`
        SELECT e.idEvenement as id, e.date_evenement as date, e.type_evenement as t, e.quantite as qte, e.montant as montant,
               p.designation as produit, rp.nom_complet as who
        FROM mouvement_evenements e
        LEFT JOIN mouvements_revendeurs m ON m.idMouvement = e.idMouvement
        LEFT JOIN products p ON p.idProduit = m.idProduit
        LEFT JOIN revendeurs_ponctuels rp ON rp.idRevendeurPonctuel = m.idRevendeurPonctuel
        WHERE e.type_evenement IN ('VENTE','RETOUR')
        ORDER BY e.date_evenement DESC LIMIT 400`),
        (r) => ({ key: 'e' + r.id, date: r.date,
          type: r.t === 'VENTE' ? 'Vente ponctuel' : 'Retour ponctuel',
          color: colorOf(r.t === 'VENTE' ? 'Vente ponctuel' : 'Retour ponctuel'),
          code: '', description: `${r.t === 'VENTE' ? 'Vente' : 'Retour'} ${r.qte || ''} × ${r.produit || 'article'}${r.who ? ' (' + r.who + ')' : ''}`,
          montant: r.montant, annule: false, sens: r.t === 'VENTE' ? 'ENTREE' : 'NEUTRE', operateur: '' }));

      // Attestations d'achat-vente
      push(await safe(`
        SELECT a.idAttestation as id, a.date_attestation as date, a.code_attestation as code, a.montant as montant,
               a.cedant_nom as who, a.sens as sens, COALESCE(a.est_annule,0) as annule
        FROM attestations a ORDER BY a.date_attestation DESC LIMIT 400`),
        (r) => ({ key: 'a' + r.id, date: r.date, type: 'Attestation', color: colorOf('Attestation'),
          code: r.code || '', description: `Occasion ${(r.sens || 'ACHAT') === 'VENTE' ? 'vente' : 'achat'}${r.who ? ' - ' + r.who : ''}`,
          montant: r.montant, annule: !!r.annule,
          sens: (r.sens || 'ACHAT') === 'VENTE' ? 'ENTREE' : 'SORTIE', operateur: '' }));

      setPrestationError(null);
      if (txContext) {
        try {
          const operations = await transactionService.readPrestationActivity(txContext);
          operations.forEach(operation => out.push({ key: `prestation-op:${operation.idOperation}`, date: operation.date_operation,
            type: 'Prestation', origin: 'prestation', color: colorOf('Prestation'), code: operation.code,
            description: operation.description + (operation.motif && !operation.description.includes(operation.motif) ? ` · Motif : ${operation.motif}` : ''),
            montant: null, annule: false, sens: 'NEUTRE', operateur: operation.acteur }));
        } catch (reason: unknown) { setPrestationError(reason instanceof Error ? reason.message : 'Historique des prestations indisponible.'); }
      }
      // Garde-fou : sens cohérent si un type a été oublié.
      out.forEach((it) => { if (!it.sens) it.sens = SENS_PAR_TYPE[it.type] || 'NEUTRE'; });

      out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setItems(out);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [txContext]);

  // Opérateurs présents (pour le filtre déroulant).
  const operateurs = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => { if (it.operateur) set.add(it.operateur); });
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items.filter((it) => {
      const jour = (it.date || '').slice(0, 10);
      if (dateDebut && jour < dateDebut) return false;
      if (dateFin && jour > dateFin) return false;
      if (typesFiltre.length > 0 && !typesFiltre.includes(it.type)) return false;
      if (sensFiltre && it.sens !== sensFiltre) return false;
      if (operateurFiltre && it.operateur !== operateurFiltre) return false;
      if (t && !(`${it.code} ${it.description} ${it.type} ${it.operateur}`.toLowerCase().includes(t))) return false;
      return true;
    });
  }, [items, search, typesFiltre, sensFiltre, operateurFiltre, dateDebut, dateFin]);

  useEffect(() => { setPage(1); }, [search, typesFiltre, sensFiltre, operateurFiltre, dateDebut, dateFin]);

  // Totaux « argent » sur la sélection (les lignes annulées sont exclues des totaux).
  const totaux = useMemo(() => {
    let entrees = 0, sorties = 0;
    for (const it of filtered) {
      if (it.annule || it.montant == null) continue;
      if (it.sens === 'ENTREE') entrees += it.montant;
      else if (it.sens === 'SORTIE') sorties += it.montant;
    }
    return { entrees, sorties, net: entrees - sorties };
  }, [filtered]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage);

  const imprimer = () => {
    const now = new Date().toLocaleString('fr-FR');
    const periode = (dateDebut || dateFin)
      ? `Du ${dateDebut || '…'} au ${dateFin || '…'}`
      : 'Toutes dates';
    const criteres: string[] = [];
    if (typesFiltre.length) criteres.push(`Types : ${typesFiltre.join(', ')}`);
    if (sensFiltre) criteres.push(`Sens : ${labelSens(sensFiltre as Sens)}`);
    if (operateurFiltre) criteres.push(`Opérateur : ${operateurFiltre}`);
    if (search.trim()) criteres.push(`Recherche : « ${search.trim()} »`);

    const rows = filtered.map((it) => `
      <tr class="${it.annule ? 'annule' : ''}">
        <td>${fmtDateTime(it.date)}</td>
        <td>${it.type}</td>
        <td class="sens ${it.sens.toLowerCase()}">${labelSens(it.sens)}</td>
        <td>${it.operateur || '—'}</td>
        <td>${it.code || '—'}</td>
        <td>${it.description || ''}${it.annule ? ' <b>(ANNULÉ)</b>' : ''}</td>
        <td class="num">${it.montant == null ? '' : Math.round(it.montant).toLocaleString('fr-FR') + ' F'}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
      <title>Historique d'activité</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 24px; font-size: 12px; }
        .head { border-bottom: 3px solid #0f3460; padding-bottom: 10px; margin-bottom: 14px; }
        .head h1 { margin: 0; font-size: 20px; color: #0f3460; }
        .head .sub { color: #555; font-size: 12px; margin-top: 4px; }
        .meta { display: flex; flex-wrap: wrap; gap: 6px 24px; margin: 10px 0 4px; font-size: 12px; color: #333; }
        .criteres { margin: 6px 0 14px; font-size: 11px; color: #444; }
        .cards { display: flex; gap: 12px; margin: 12px 0 16px; }
        .card { flex: 1; border: 1px solid #dde; border-radius: 8px; padding: 10px 12px; }
        .card .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #777; }
        .card .val { font-size: 16px; font-weight: 700; margin-top: 2px; }
        .val.in { color: #1b7a43; } .val.out { color: #b4232c; } .val.net { color: #0f3460; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        th { background: #0f3460; color: #fff; text-align: left; padding: 7px 8px; font-size: 11px; }
        td { padding: 6px 8px; border-bottom: 1px solid #eef; }
        td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
        td.sens.entree { color: #1b7a43; font-weight: 600; }
        td.sens.sortie { color: #b4232c; font-weight: 600; }
        td.sens.neutre { color: #888; }
        tr.annule td { color: #999; text-decoration: line-through; }
        tfoot td { font-weight: 700; border-top: 2px solid #0f3460; }
        .foot { margin-top: 18px; font-size: 10px; color: #888; text-align: center; }
        @media print { body { margin: 10px; } th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head><body>
      <div class="head">
        <h1>Historique d'activité</h1>
        <div class="sub">Rapport de gestion — chronologie des opérations</div>
      </div>
      <div class="meta">
        <span><b>Période :</b> ${periode}</span>
        <span><b>Édité le :</b> ${now}</span>
        <span><b>Nombre d'opérations :</b> ${filtered.length}</span>
      </div>
      ${criteres.length ? `<div class="criteres"><b>Filtres :</b> ${criteres.join(' • ')}</div>` : ''}
      <div class="cards">
        <div class="card"><div class="lbl">Total entrées</div><div class="val in">${Math.round(totaux.entrees).toLocaleString('fr-FR')} F</div></div>
        <div class="card"><div class="lbl">Total sorties</div><div class="val out">${Math.round(totaux.sorties).toLocaleString('fr-FR')} F</div></div>
        <div class="card"><div class="lbl">Solde net</div><div class="val net">${Math.round(totaux.net).toLocaleString('fr-FR')} F</div></div>
      </div>
      <table>
        <thead><tr>
          <th>Date</th><th>Type</th><th>Sens</th><th>Opérateur</th><th>Code</th><th>Description</th><th style="text-align:right">Montant</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#999;padding:20px">Aucune opération</td></tr>'}</tbody>
        <tfoot><tr>
          <td colspan="6">TOTAL (${filtered.length} opération(s)) — Entrées ${Math.round(totaux.entrees).toLocaleString('fr-FR')} F / Sorties ${Math.round(totaux.sorties).toLocaleString('fr-FR')} F</td>
          <td class="num">Net ${Math.round(totaux.net).toLocaleString('fr-FR')} F</td>
        </tr></tfoot>
      </table>
      <div class="foot">Document généré automatiquement — Gestion Commerciale</div>
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
      </body></html>`;

    const w = window.open('', '_blank', 'width=1000,height=700');
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <Box p="md">
      <Stack gap="md">
        <Paper className="tk-page-tools" p="md" radius="lg">
          <Group justify="space-between" wrap="wrap">
            <Group gap="sm">
              <ThemeIcon size={42} radius="md" variant="light" color="yellow"><IconHistory size={24} /></ThemeIcon>
              <div>
                <Text size="xs" c="rgba(255,255,255,0.5)" tt="uppercase" style={{ letterSpacing: 1 }}>Journal d'activité</Text>
                <Title order={2} c="white" style={{ fontSize: 22 }}>Historique général</Title>
              </div>
            </Group>
            <Group gap="xs">
              <Button variant="white" size="xs" leftSection={<IconPrinter size={16} />} onClick={imprimer} disabled={loading || filtered.length === 0}>
                Imprimer le rapport
              </Button>
              <Tooltip label="Actualiser">
                <ActionIcon variant="subtle" size="lg" onClick={load} style={{ color: 'rgba(255,255,255,0.6)' }}><IconRefresh size={18} /></ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Paper>

        {prestationError && <Alert color="red" title="Historique des prestations indisponible">{prestationError}</Alert>}
        <TkFilters>
        <Paper withBorder p="md" radius="lg" shadow="sm">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
            <TextInput placeholder="Rechercher (code, description, type, opérateur)…" leftSection={<IconSearch size={14} />}
              value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
            <MultiSelect placeholder="Types d'opération" data={TYPES.map((t) => t.value)} value={typesFiltre}
              onChange={setTypesFiltre} clearable searchable />
            <Select placeholder="Sens (entrée / sortie d'argent)" data={SENS_OPTIONS} value={sensFiltre}
              onChange={setSensFiltre} clearable />
            <Select placeholder="Opérateur" data={operateurs} value={operateurFiltre}
              onChange={setOperateurFiltre} clearable searchable
              nothingFoundMessage="Aucun opérateur tracé" />
            <TextInput type="date" label="Du" value={dateDebut} onChange={(e) => setDateDebut(e.currentTarget.value)} size="xs" />
            <TextInput type="date" label="Au" value={dateFin} onChange={(e) => setDateFin(e.currentTarget.value)} size="xs" />
          </SimpleGrid>
          <Group justify="space-between" mt="xs">
            <Text size="xs" c="dimmed">{filtered.length} action(s)</Text>
            <Group gap="lg">
              <Text size="xs" c="teal.7"><IconArrowUp size={12} style={{ verticalAlign: -1 }} /> Entrées : <b>{fmtMontant(totaux.entrees)}</b></Text>
              <Text size="xs" c="red.7"><IconArrowDown size={12} style={{ verticalAlign: -1 }} /> Sorties : <b>{fmtMontant(totaux.sorties)}</b></Text>
              <Text size="xs" c="blue.8">Net : <b>{fmtMontant(totaux.net)}</b></Text>
            </Group>
          </Group>
        </Paper>
        </TkFilters>

        <Paper withBorder radius="lg" shadow="sm" p={0}>
          {loading ? (
            <Center py="xl"><Loader /></Center>
          ) : (
            <ScrollArea>
              <Table striped highlightOnHover verticalSpacing="xs" fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Origine</Table.Th>
                    <Table.Th>Sens</Table.Th>
                    <Table.Th>Opérateur</Table.Th>
                    <Table.Th>Code</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th ta="right">Montant</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {pageItems.length === 0 ? (
                    <Table.Tr><Table.Td colSpan={8}><Text ta="center" c="dimmed" py="md">Aucune action</Text></Table.Td></Table.Tr>
                  ) : pageItems.map((it) => (
                    <Table.Tr key={it.key} style={it.annule ? { opacity: 0.55, textDecoration: 'line-through' } : undefined}>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(it.date)}</Table.Td>
                      <Table.Td><Badge color={it.color} variant="light" size="sm">{it.type}</Badge>{it.annule && <Badge color="orange" variant="filled" size="xs" ml={4}>Annulé</Badge>}</Table.Td>
                      <Table.Td><OriginBadge origin={it.origin ?? (it.type === 'Vente' ? 'vente' : null)} /></Table.Td>
                      <Table.Td>
                        {it.sens === 'NEUTRE'
                          ? <Text span size="xs" c="dimmed">—</Text>
                          : <Badge color={it.sens === 'ENTREE' ? 'teal' : 'red'} variant="light" size="sm"
                              leftSection={it.sens === 'ENTREE' ? <IconArrowUp size={11} /> : <IconArrowDown size={11} />}>
                              {labelSens(it.sens)}
                            </Badge>}
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>{it.operateur || <Text span size="xs" c="dimmed">—</Text>}</Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>{it.code || '-'}</Table.Td>
                      <Table.Td>{it.description}</Table.Td>
                      <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>{fmtMontant(it.montant)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
          {totalPages > 1 && (
            <Group justify="center" p="md">
              <Pagination total={totalPages} value={page} onChange={setPage} />
            </Group>
          )}
        </Paper>
      </Stack>
    </Box>
  );
};

export default HistoriqueActivite;
