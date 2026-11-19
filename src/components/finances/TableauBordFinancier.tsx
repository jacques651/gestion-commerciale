// src/components/finances/TableauBordFinancier.tsx
// Tableau de bord financier complet — toutes sources de revenus

import { useEffect, useState, useCallback } from 'react';
import {
  Stack, Title, Text, Group, SimpleGrid, Card, Badge, Loader, Center,
  Select, Button, Divider, Table, ScrollArea, Box, Paper, ActionIcon,
  Tooltip, SegmentedControl, Modal, NumberFormatter, TextInput
} from '@mantine/core';
import {
  IconCash, IconShoppingCart, IconReceipt, IconBuildingStore,
  IconTrendingUp, IconPrinter, IconDownload, IconRefresh,
  IconChevronRight, IconCalendar, IconPackage, IconChartBar,
  IconArrowUpRight, IconArrowDownRight, IconMinus
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { useTransactionContext, useTransactionSnapshot } from '../../hooks/useTransactionSnapshot';
import { totalsByOrigin } from '../../services/transactionConsolidation';
import TransactionsSummary from '../ventes/TransactionsSummary';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiData {
  totalVentesComptoir: number;
  nbVentesComptoir: number;
  totalReglementsFactures: number;
  nbReglements: number;
  totalDecomptes: number;
  nbDecomptes: number;
  beneficeDecomptes: number;
  totalVentesPonctuels: number;
  nbVentesPonctuels: number;
  beneficeVentesPonctuels: number;
  totalOccasionVentes: number;
  totalOccasionAchats: number;
  nbOccasion: number;
  totalAchats: number; // coût d'achat du stock
  beneficeVentes: number; // CA ventes - coût d'achat estimé
  beneficeTotal: number;
  chargesFonctionnement: number;
  soldeJournal: number;
}

interface TopProduit {
  designation: string;
  categorie: string;
  qteVendue: number;
  caVente: number;
  coutAchat: number;
  benefice: number;
}

interface EvolMensuelle {
  mois: string;
  totalVentes: number;
  totalDecomptes: number;
  benefice: number;
}

interface DetailModal {
  type: 'ventes' | 'reglements' | 'decomptes' | 'achats';
  lignes: any[];
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

const fmt = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} FCFA`;
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

function getPeriodDates(period: string): { dateDebut: string; dateFin: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (period) {
    case 'today':
      return { dateDebut: toStr(now), dateFin: toStr(now) };
    case 'week': {
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      return { dateDebut: toStr(monday), dateFin: toStr(now) };
    }
    case 'month':
      return {
        dateDebut: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`,
        dateFin: toStr(now)
      };
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      return { dateDebut: toStr(start), dateFin: toStr(now) };
    }
    case 'year':
      return { dateDebut: `${now.getFullYear()}-01-01`, dateFin: toStr(now) };
    default:
      return { dateDebut: `${now.getFullYear()}-01-01`, dateFin: toStr(now) };
  }
}

// ─── Composant KPI Card ───────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  sub?: string;
  color: string;
  icon: React.ReactNode;
  onClick?: () => void;
  highlight?: boolean;
}

function KpiCard({ label, value, sub, color, icon, onClick, highlight }: KpiCardProps) {
  return (
    <Card
      shadow="sm"
      padding="md"
      radius="lg"
      withBorder
      style={{
        cursor: onClick ? 'pointer' : 'default',
        borderLeft: `4px solid ${color}`,
        transition: 'box-shadow 0.15s',
        background: highlight ? '#f0fff4' : undefined,
      }}
      onClick={onClick}
    >
      <Group justify="space-between" align="flex-start">
        <Box>
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" mb={4}>{label}</Text>
          <Text size="xl" fw={700} style={{ color }}>
            {fmt(value)}
          </Text>
          {sub && <Text size="xs" c="dimmed" mt={2}>{sub}</Text>}
        </Box>
        <Box style={{
          background: `${color}22`,
          borderRadius: 8,
          padding: 8,
          color
        }}>
          {icon}
        </Box>
      </Group>
      {onClick && (
        <Group gap={4} mt="xs">
          <Text size="xs" c="blue">Voir le détail</Text>
          <IconChevronRight size={12} color="var(--mantine-color-blue-6)" />
        </Group>
      )}
    </Card>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function TableauBordFinancier() {
  const todayStr = new Date().toISOString().split('T')[0];

  const [period, setPeriod] = useState('month');
  // Dates effectives utilisées pour les requêtes
  const [effectiveDates, setEffectiveDates] = useState(() => getPeriodDates('month'));
  const txContext = useTransactionContext();
  const [transactionRevision, setTransactionRevision] = useState(0);
  const transactionSnapshot = useTransactionSnapshot(txContext, effectiveDates, transactionRevision);
  const consolidated = totalsByOrigin(transactionSnapshot.rows);
  // Champs de saisie des dates personnalisées
  const [customD1, setCustomD1] = useState(todayStr);
  const [customD2, setCustomD2] = useState(todayStr);
  const [customError, setCustomError] = useState('');

  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [topProduits, setTopProduits] = useState<TopProduit[]>([]);
  const [evol, setEvol] = useState<EvolMensuelle[]>([]);
  const [detail, setDetail] = useState<DetailModal | null>(null);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  // Changer de période rapide
  const handlePresetChange = (p: string) => {
    setPeriod(p);
    setCustomError('');
    setEffectiveDates(getPeriodDates(p));
  };

  // Appliquer une plage de dates personnalisée
  const handleApplyCustom = () => {
    if (!customD1 || !customD2) {
      setCustomError('Sélectionnez les deux dates.');
      return;
    }
    if (customD1 > customD2) {
      setCustomError('La date de début doit être avant la date de fin.');
      return;
    }
    setCustomError('');
    setPeriod('custom');
    setEffectiveDates({ dateDebut: customD1, dateFin: customD2 });
  };

  // ── Chargement des données ─────────────────────────────────────────────────
  const charger = useCallback(async () => {
    setTransactionRevision(value => value + 1);
    setLoading(true);
    try {
      const db = await getDb();
      const { dateDebut: dd, dateFin: df } = effectiveDates;
      setDateDebut(dd);
      setDateFin(df);

      const d1 = dd + ' 00:00:00';
      const d2 = df + ' 23:59:59';

      // 1. Ventes comptoir
      const ventesRes = await db.select<any[]>(
        `SELECT COALESCE(SUM(montant_ttc),0) as total, COUNT(*) as nb
         FROM ventes WHERE date_vente BETWEEN ? AND ?`, [d1, d2]
      );
      const totalVentesComptoir = ventesRes[0]?.total || 0;
      const nbVentesComptoir = ventesRes[0]?.nb || 0;

      // 2. Réglements de factures
      const regRes = await db.select<any[]>(
        `SELECT COALESCE(SUM(montant),0) as total, COUNT(*) as nb
         FROM reglements WHERE date_reglement BETWEEN ? AND ? AND COALESCE(statut, 'VALIDE') <> 'ANNULE'`, [d1, d2]
      );
      const totalReglementsFactures = regRes[0]?.total || 0;
      const nbReglements = regRes[0]?.nb || 0;

      // 3. Décomptes revendeurs
      const decRes = await db.select<any[]>(
        `SELECT COALESCE(SUM(montant_vente),0) as total,
                COALESCE(SUM(montant_benefice),0) as benefice,
                COUNT(*) as nb
         FROM decomptes
         WHERE date_decompte BETWEEN ? AND ? AND statut NOT IN ('ANNULE','annule')`,
        [d1, d2]
      );
      const totalDecomptes = decRes[0]?.total || 0;
      const beneficeDecomptes = decRes[0]?.benefice || 0;
      const nbDecomptes = decRes[0]?.nb || 0;

      // 3bis. Ventes des revendeurs ponctuels (événements VENTE)
      const vpRes = await db.select<any[]>(
        `SELECT COALESCE(SUM(e.montant),0) as ca,
                COALESCE(SUM(e.quantite * p.prix_achat_base),0) as cout,
                COUNT(*) as nb
         FROM mouvement_evenements e
         JOIN mouvements_revendeurs m ON e.idMouvement = m.idMouvement
         JOIN products p ON m.idProduit = p.idProduit
         WHERE e.type_evenement = 'VENTE' AND e.date_evenement BETWEEN ? AND ?`,
        [d1, d2]
      );
      const totalVentesPonctuels = vpRes[0]?.ca || 0;
      const beneficeVentesPonctuels = (vpRes[0]?.ca || 0) - (vpRes[0]?.cout || 0);
      const nbVentesPonctuels = vpRes[0]?.nb || 0;

      // 3ter. Téléphones d'occasion (attestations : achat = dépense, vente = recette)
      const occRes = await db.select<any[]>(
        `SELECT sens, COALESCE(SUM(montant),0) as total, COUNT(*) as nb
         FROM attestations
         WHERE COALESCE(est_annule,0) = 0 AND date_attestation BETWEEN ? AND ?
         GROUP BY sens`, [d1, d2]
      );
      let totalOccasionVentes = 0, totalOccasionAchats = 0, nbOccasion = 0;
      for (const r of occRes) {
        nbOccasion += r.nb || 0;
        if ((r.sens || 'ACHAT') === 'VENTE') totalOccasionVentes += r.total || 0;
        else totalOccasionAchats += r.total || 0;
      }

      // 4. Bénéfice ventes comptoir (CA - coût d'achat estimé)
      const benefVRes = await db.select<any[]>(
        `SELECT COALESCE(SUM(vd.quantite * (vd.prix_unitaire_ttc - p.prix_achat_base)),0) as benefice,
                COALESCE(SUM(vd.quantite * p.prix_achat_base),0) as couts
         FROM vente_details vd
         JOIN products p ON vd.idProduit = p.idProduit
         JOIN ventes v ON vd.idVente = v.idVente
         WHERE v.date_vente BETWEEN ? AND ?`, [d1, d2]
      );
      const beneficeVentes = benefVRes[0]?.benefice || 0;
      const totalAchats = benefVRes[0]?.couts || 0;

      // 5. Charges de fonctionnement
      const chargesRes = await db.select<any[]>(
        `SELECT COALESCE(SUM(montant),0) as total
         FROM charges_fonctionnement WHERE date_charge BETWEEN ? AND ?`, [d1, d2]
      );
      const chargesFonctionnement = chargesRes[0]?.total || 0;

      // 6. Solde journal de caisse actuel
      const soldeRes = await db.select<any[]>(
        `SELECT COALESCE(SUM(CASE WHEN type_mouvement='ENTREE' THEN montant ELSE -montant END),0) as solde
         FROM journal_caisse`
      );
      const soldeJournal = soldeRes[0]?.solde || 0;

      // 7. Bénéfice total
      const beneficeTotal = beneficeVentes + beneficeDecomptes + beneficeVentesPonctuels + (totalOccasionVentes - totalOccasionAchats) - chargesFonctionnement;

      setKpi({
        totalVentesComptoir, nbVentesComptoir,
        totalReglementsFactures, nbReglements,
        totalDecomptes, nbDecomptes, beneficeDecomptes,
        totalVentesPonctuels, nbVentesPonctuels, beneficeVentesPonctuels,
        totalOccasionVentes, totalOccasionAchats, nbOccasion,
        totalAchats, beneficeVentes,
        beneficeTotal, chargesFonctionnement, soldeJournal
      });

      // 8. Top produits vendus
      const topRes = await db.select<any[]>(
        `SELECT p.designation, p.categorie,
                COALESCE(SUM(vd.quantite),0) as qteVendue,
                COALESCE(SUM(vd.quantite * vd.prix_unitaire_ttc),0) as caVente,
                COALESCE(SUM(vd.quantite * p.prix_achat_base),0) as coutAchat,
                COALESCE(SUM(vd.quantite * (vd.prix_unitaire_ttc - p.prix_achat_base)),0) as benefice
         FROM vente_details vd
         JOIN products p ON vd.idProduit = p.idProduit
         JOIN ventes v ON vd.idVente = v.idVente
         WHERE v.date_vente BETWEEN ? AND ?
         GROUP BY p.idProduit
         ORDER BY caVente DESC
         LIMIT 15`, [d1, d2]
      );
      setTopProduits(topRes);

      // 9. Évolution 6 derniers mois
      const evolRes = await db.select<any[]>(
        `SELECT strftime('%Y-%m', date_vente) as mois,
                COALESCE(SUM(montant_ttc),0) as totalVentes
         FROM ventes
         WHERE date_vente >= date('now', '-6 months')
         GROUP BY mois ORDER BY mois`
      );
      const evolDec = await db.select<any[]>(
        `SELECT strftime('%Y-%m', date_decompte) as mois,
                COALESCE(SUM(montant_vente),0) as totalDecomptes,
                COALESCE(SUM(montant_benefice),0) as benefice
         FROM decomptes
         WHERE date_decompte >= date('now', '-6 months')
           AND statut NOT IN ('ANNULE','annule')
         GROUP BY mois ORDER BY mois`
      );
      // Fusionner les deux
      const evolMap: Record<string, EvolMensuelle> = {};
      for (const r of evolRes) {
        evolMap[r.mois] = { mois: r.mois, totalVentes: r.totalVentes, totalDecomptes: 0, benefice: 0 };
      }
      for (const r of evolDec) {
        if (evolMap[r.mois]) {
          evolMap[r.mois].totalDecomptes = r.totalDecomptes;
          evolMap[r.mois].benefice = r.benefice;
        } else {
          evolMap[r.mois] = { mois: r.mois, totalVentes: 0, totalDecomptes: r.totalDecomptes, benefice: r.benefice };
        }
      }
      setEvol(Object.values(evolMap).sort((a, b) => a.mois.localeCompare(b.mois)));

    } catch (err) {
      console.error('Erreur tableau de bord financier:', err);
    } finally {
      setLoading(false);
    }
  }, [effectiveDates]);

  useEffect(() => { charger(); }, [charger]);

  // ── Ouverture détail modal ────────────────────────────────────────────────
  const ouvrirDetail = async (type: DetailModal['type']) => {
    try {
      const db = await getDb();
      const d1 = dateDebut + ' 00:00:00';
      const d2 = dateFin + ' 23:59:59';
      let lignes: any[] = [];

      if (type === 'ventes') {
        lignes = await db.select<any[]>(
          `SELECT code_vente, date_vente, nom_prenom, montant_ttc, type_vente
           FROM ventes WHERE date_vente BETWEEN ? AND ?
           ORDER BY date_vente DESC`, [d1, d2]
        );
      } else if (type === 'reglements') {
        lignes = await db.select<any[]>(
          `SELECT r.code_reglement, r.date_reglement, r.montant, r.mode_reglement,
                  f.code_facture
           FROM reglements r
           LEFT JOIN factures f ON r.idFacture = f.idFacture
           WHERE r.date_reglement BETWEEN ? AND ? AND COALESCE(r.statut, 'VALIDE') <> 'ANNULE'
           ORDER BY r.date_reglement DESC`, [d1, d2]
        );
      } else if (type === 'decomptes') {
        lignes = await db.select<any[]>(
          `SELECT d.code_decompte, d.date_decompte, c.NomComplet,
                  d.montant_vente, d.montant_benefice, d.statut
           FROM decomptes d
           LEFT JOIN clients c ON d.idClient = c.idClient
           WHERE d.date_decompte BETWEEN ? AND ?
             AND d.statut NOT IN ('ANNULE','annule')
           ORDER BY d.date_decompte DESC`, [d1, d2]
        );
      }
      setDetail({ type, lignes });
    } catch (err) {
      console.error('Erreur détail:', err);
    }
  };

  // ── Impression du rapport ─────────────────────────────────────────────────
  const imprimerRapport = () => {
    if (!kpi) return;

    const periodLabels: Record<string, string> = {
      today: "Aujourd'hui", week: 'Cette semaine',
      month: 'Ce mois', quarter: 'Ce trimestre', year: 'Cette année'
    };

    const html = `<!DOCTYPE html><html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>État Financier — Gestion Pro</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20mm; font-size: 11pt; }
    h1 { color: #0a1628; border-bottom: 2px solid #0a1628; padding-bottom: 8px; }
    h2 { color: #1a2d5a; margin-top: 20px; font-size: 13pt; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
    .kpi { border: 1px solid #dee2e6; border-left: 4px solid; border-radius: 6px; padding: 10px 14px; }
    .kpi-label { font-size: 9pt; color: #6c757d; text-transform: uppercase; }
    .kpi-value { font-size: 16pt; font-weight: bold; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #0a1628; color: white; padding: 6px 10px; text-align: left; font-size: 10pt; }
    td { padding: 5px 10px; border-bottom: 1px solid #f1f3f5; font-size: 10pt; }
    tr:nth-child(even) td { background: #f8f9fa; }
    .total-row td { font-weight: bold; background: #e8f4fd !important; }
    .right { text-align: right; }
    .green { color: #2f9e44; } .red { color: #c92a2a; }
    .footer { margin-top: 30px; font-size: 9pt; color: #868e96; text-align: center; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <h1>📊 État Financier — ${periodLabels[period] || period}</h1>
  <p style="color:#868e96">Période : ${dateDebut} → ${dateFin} — Généré le ${new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</p>

  <h2>Résumé des performances</h2>
  <div class="kpi-grid">
    <div class="kpi" style="border-left-color:#2f9e44">
      <div class="kpi-label">Ventes Comptoir</div>
      <div class="kpi-value" style="color:#2f9e44">${fmt(kpi.totalVentesComptoir)}</div>
      <div class="kpi-label">${kpi.nbVentesComptoir} transaction(s)</div>
    </div>
    <div class="kpi" style="border-left-color:#1971c2">
      <div class="kpi-label">Réglements Factures</div>
      <div class="kpi-value" style="color:#1971c2">${fmt(kpi.totalReglementsFactures)}</div>
      <div class="kpi-label">${kpi.nbReglements} règlement(s)</div>
    </div>
    <div class="kpi" style="border-left-color:#7950f2">
      <div class="kpi-label">Décomptes Revendeurs</div>
      <div class="kpi-value" style="color:#7950f2">${fmt(kpi.totalDecomptes)}</div>
      <div class="kpi-label">${kpi.nbDecomptes} décompte(s)</div>
    </div>
    <div class="kpi" style="border-left-color:#e67700">
      <div class="kpi-label">Coût d'achat (stock vendu)</div>
      <div class="kpi-value" style="color:#e67700">${fmt(kpi.totalAchats)}</div>
    </div>
    <div class="kpi" style="border-left-color:#c92a2a">
      <div class="kpi-label">Charges de fonctionnement</div>
      <div class="kpi-value" style="color:#c92a2a">${fmt(kpi.chargesFonctionnement)}</div>
    </div>
    <div class="kpi" style="border-left-color:#0ca678; background:#f0fff4">
      <div class="kpi-label">Bénéfice Total Estimé</div>
      <div class="kpi-value" style="color:#0ca678">${fmt(kpi.beneficeTotal)}</div>
    </div>
  </div>

  <h2>Détail par source de revenus</h2>
  <table>
    <thead>
      <tr><th>Source</th><th class="right">Chiffre d'affaires</th><th class="right">Bénéfice</th><th class="right">Transactions</th></tr>
    </thead>
    <tbody>
      <tr><td>Ventes comptoir</td><td class="right">${fmt(kpi.totalVentesComptoir)}</td><td class="right green">${fmt(kpi.beneficeVentes)}</td><td class="right">${kpi.nbVentesComptoir}</td></tr>
      <tr><td>Réglements factures</td><td class="right">${fmt(kpi.totalReglementsFactures)}</td><td class="right">—</td><td class="right">${kpi.nbReglements}</td></tr>
      <tr><td>Décomptes revendeurs</td><td class="right">${fmt(kpi.totalDecomptes)}</td><td class="right green">${fmt(kpi.beneficeDecomptes)}</td><td class="right">${kpi.nbDecomptes}</td></tr>
      <tr class="total-row"><td>TOTAL</td><td class="right">${fmt(kpi.totalVentesComptoir + kpi.totalReglementsFactures + kpi.totalDecomptes)}</td><td class="right green">${fmt(kpi.beneficeVentes + kpi.beneficeDecomptes)}</td><td class="right">${kpi.nbVentesComptoir + kpi.nbReglements + kpi.nbDecomptes}</td></tr>
    </tbody>
  </table>

  ${topProduits.length > 0 ? `
  <h2>Top produits vendus</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Désignation</th><th class="right">Qté vendue</th><th class="right">CA Vente</th><th class="right">Coût achat</th><th class="right">Bénéfice</th></tr>
    </thead>
    <tbody>
      ${topProduits.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.designation}</td>
        <td class="right">${p.qteVendue.toLocaleString('fr-FR')}</td>
        <td class="right">${fmt(p.caVente)}</td>
        <td class="right">${fmt(p.coutAchat)}</td>
        <td class="right green">${fmt(p.benefice)}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  <div class="footer">
    Rapport généré automatiquement par Gestion Commerciale Pro — ${new Date().toLocaleString('fr-FR')}
  </div>
</body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Center h={400}>
        <Stack align="center">
          <Loader size="xl" variant="dots" />
          <Text c="dimmed">Chargement du tableau de bord...</Text>
        </Stack>
      </Center>
    );
  }

  const periodLabel: Record<string, string> = {
    today: "Aujourd'hui", week: 'Cette semaine',
    month: 'Ce mois', quarter: 'Ce trimestre', year: 'Cette année',
    custom: 'Période personnalisée'
  };

  const totalCA = consolidated.total.facture + (kpi?.totalDecomptes || 0) + (kpi?.totalVentesPonctuels || 0) + (kpi?.totalOccasionVentes || 0);

  return (
    <Stack gap="md" p="md">

      {/* ── En-tête ── */}
      <Paper className="tk-page-tools" p="md" radius="lg">
        <Stack gap="sm">
          {/* Ligne 1 : titre + boutons */}
          <Group justify="space-between" wrap="wrap" gap="sm">
            <div>
              <Title order={3} c="white">
                <IconChartBar size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Tableau de bord financier
              </Title>
              <Text size="sm" c="rgba(255,255,255,0.6)">
                {periodLabel[period] || period} — {dateDebut} → {dateFin}
              </Text>
            </div>
            <Group gap="sm">
              <Tooltip label="Actualiser">
                <ActionIcon variant="subtle" onClick={charger} loading={loading} size="lg" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
              <Button
                size="xs"
                variant="white"
                color="dark"
                leftSection={<IconPrinter size={14} />}
                onClick={imprimerRapport}
              >
                Imprimer l'état
              </Button>
            </Group>
          </Group>

          {/* Ligne 2 : filtres période */}
          <Group gap="sm" wrap="wrap" align="flex-end">
            {/* Raccourcis rapides */}
            <SegmentedControl
              value={period === 'custom' ? '' : period}
              onChange={handlePresetChange}
              size="xs"
              data={[
                { label: "Auj.", value: 'today' },
                { label: 'Sem.', value: 'week' },
                { label: 'Mois', value: 'month' },
                { label: 'Trim.', value: 'quarter' },
                { label: 'An', value: 'year' },
              ]}
            />

            {/* Séparateur visuel */}
            <Text size="xs" c="rgba(255,255,255,0.5)" style={{ alignSelf: 'center' }}>ou</Text>

            {/* Filtre par plage de dates */}
            <Group gap="xs" align="flex-end">
              <div>
                <Text size="xs" c="rgba(255,255,255,0.6)" mb={2}>Du</Text>
                <TextInput size="xs" aria-label="Date de début financière"
                  type="date"
                  value={customD1}
                  onInput={e => { setCustomD1(e.currentTarget.value); setCustomError(''); }}
                  max={todayStr}
                />
              </div>
              <div>
                <Text size="xs" c="rgba(255,255,255,0.6)" mb={2}>Au</Text>
                <TextInput size="xs" aria-label="Date de fin financière"
                  type="date"
                  value={customD2}
                  onInput={e => { setCustomD2(e.currentTarget.value); setCustomError(''); }}
                  min={customD1}
                  max={todayStr}
                />
              </div>
              <Button
                size="xs"
                leftSection={<IconCalendar size={14} />}
                onClick={handleApplyCustom}
              >
                Appliquer
              </Button>
            </Group>

            {customError && (
              <Text size="xs" c="red">{customError}</Text>
            )}
          </Group>
        </Stack>
      </Paper>

      <TransactionsSummary rows={transactionSnapshot.rows} loading={transactionSnapshot.loading} error={transactionSnapshot.error} charts />
      <Text size="xs" c="dimmed">Les règlements sont des encaissements, distincts du CA. Les coûts des prestations ne sont pas renseignés : leur bénéfice n’est pas calculé. Le solde du journal inclut déjà leurs écritures.</Text>
      {/* ── KPI principaux ── */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }} spacing="sm">
        <KpiCard
          label="Ventes comptoir"
          value={consolidated.vente.facture}
          sub={`${kpi?.nbVentesComptoir || 0} transaction(s)`}
          color="#2f9e44"
          icon={<IconShoppingCart size={22} />}
          onClick={() => ouvrirDetail('ventes')}
        />
        <KpiCard
          label="Réglements factures"
          value={kpi?.totalReglementsFactures || 0}
          sub={`${kpi?.nbReglements || 0} règlement(s)`}
          color="#1971c2"
          icon={<IconReceipt size={22} />}
          onClick={() => ouvrirDetail('reglements')}
        />
        <KpiCard
          label="Décomptes revendeurs"
          value={kpi?.totalDecomptes || 0}
          sub={`${kpi?.nbDecomptes || 0} décompte(s)`}
          color="#7950f2"
          icon={<IconBuildingStore size={22} />}
          onClick={() => ouvrirDetail('decomptes')}
        />
        <KpiCard
          label="Ventes revendeurs ponctuels"
          value={kpi?.totalVentesPonctuels || 0}
          sub={`${kpi?.nbVentesPonctuels || 0} vente(s)`}
          color="#e8590c"
          icon={<IconPackage size={22} />}
        />
        <KpiCard
          label="Occasion — ventes"
          value={kpi?.totalOccasionVentes || 0}
          sub={`Achats: ${fmt(kpi?.totalOccasionAchats || 0)} · ${kpi?.nbOccasion || 0} acte(s)`}
          color="#9c36b5"
          icon={<IconPackage size={22} />}
        />
        <KpiCard
          label="CA Total"
          value={totalCA}
          sub="Toutes sources"
          color="#0a1628"
          icon={<IconTrendingUp size={22} />}
        />
        <KpiCard
          label="Bénéfice ventes (estimé)"
          value={kpi?.beneficeVentes || 0}
          sub={`Coût achat : ${fmt(kpi?.totalAchats || 0)}`}
          color="#0ca678"
          icon={<IconArrowUpRight size={22} />}
          highlight
        />
        <KpiCard
          label="Bénéfice décomptes"
          value={kpi?.beneficeDecomptes || 0}
          color="#2f9e44"
          icon={<IconArrowUpRight size={22} />}
          highlight
        />
        <KpiCard
          label="Bénéfice total estimé"
          value={kpi?.beneficeTotal || 0}
          sub={`Charges déduit: ${fmt(kpi?.chargesFonctionnement || 0)}`}
          color={kpi && kpi.beneficeTotal >= 0 ? '#0ca678' : '#c92a2a'}
          icon={kpi && kpi.beneficeTotal >= 0 ? <IconArrowUpRight size={22} /> : <IconArrowDownRight size={22} />}
          highlight
        />
      </SimpleGrid>

      {/* ── Tableau récap par source ── */}
      <Paper shadow="sm" p="md" radius="lg" withBorder>
        <Title order={5} mb="sm">Récapitulatif par source de revenus</Title>
        <Text size="xs" c="dimmed" mb="sm">Les règlements de factures décrivent des encaissements et ne sont pas ajoutés au CA. Le bénéfice des prestations reste non calculé.</Text>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Source</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Chiffre d'affaires</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Bénéfice estimé</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Marge</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Transactions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>
                <Group gap="xs">
                  <Box style={{ width: 10, height: 10, borderRadius: 2, background: '#2f9e44' }} />
                  Ventes comptoir
                </Group>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>{fmt(consolidated.vente.facture)}</Table.Td>
              <Table.Td style={{ textAlign: 'right', color: '#2f9e44' }}>{fmt(kpi?.beneficeVentes || 0)}</Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                {kpi?.totalVentesComptoir
                  ? `${((kpi.beneficeVentes / kpi.totalVentesComptoir) * 100).toFixed(1)}%`
                  : '—'}
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>{kpi?.nbVentesComptoir || 0}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Group gap="xs">
                  <Box style={{ width: 10, height: 10, borderRadius: 2, background: '#1971c2' }} />
                  Règlements factures (encaissements, hors CA)
                </Group>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>{fmt(kpi?.totalReglementsFactures || 0)}</Table.Td>
              <Table.Td style={{ textAlign: 'right', color: '#868e96' }}>—</Table.Td>
              <Table.Td style={{ textAlign: 'right', color: '#868e96' }}>—</Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>{kpi?.nbReglements || 0}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Group gap="xs">
                  <Box style={{ width: 10, height: 10, borderRadius: 2, background: '#7950f2' }} />
                  Décomptes revendeurs
                </Group>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>{fmt(kpi?.totalDecomptes || 0)}</Table.Td>
              <Table.Td style={{ textAlign: 'right', color: '#2f9e44' }}>{fmt(kpi?.beneficeDecomptes || 0)}</Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                {kpi?.totalDecomptes
                  ? `${((kpi.beneficeDecomptes / kpi.totalDecomptes) * 100).toFixed(1)}%`
                  : '—'}
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>{kpi?.nbDecomptes || 0}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Group gap="xs">
                  <Box style={{ width: 10, height: 10, borderRadius: 2, background: '#e8590c' }} />
                  Ventes revendeurs ponctuels
                </Group>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>{fmt(kpi?.totalVentesPonctuels || 0)}</Table.Td>
              <Table.Td style={{ textAlign: 'right', color: '#2f9e44' }}>{fmt(kpi?.beneficeVentesPonctuels || 0)}</Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                {kpi?.totalVentesPonctuels
                  ? `${((kpi.beneficeVentesPonctuels / kpi.totalVentesPonctuels) * 100).toFixed(1)}%`
                  : '—'}
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>{kpi?.nbVentesPonctuels || 0}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Group gap="xs">
                  <Box style={{ width: 10, height: 10, borderRadius: 2, background: '#9c36b5' }} />
                  Téléphones d'occasion (ventes)
                </Group>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>{fmt(kpi?.totalOccasionVentes || 0)}</Table.Td>
              <Table.Td style={{ textAlign: 'right', color: '#2f9e44' }}>{fmt((kpi?.totalOccasionVentes || 0) - (kpi?.totalOccasionAchats || 0))}</Table.Td>
              <Table.Td style={{ textAlign: 'right', color: '#868e96' }}>Achats: {fmt(kpi?.totalOccasionAchats || 0)}</Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>{kpi?.nbOccasion || 0}</Table.Td>
            </Table.Tr>
            <Table.Tr><Table.Td><Badge color="teal" variant="light">Prestations</Badge></Table.Td>
              <Table.Td ta="right">{fmt(consolidated.prestation.facture)}</Table.Td><Table.Td ta="right">·</Table.Td>
              <Table.Td ta="right">Non calculée</Table.Td><Table.Td ta="right">{consolidated.prestation.nombre}</Table.Td>
            </Table.Tr>
            <Table.Tr style={{ background: '#e8f4fd', fontWeight: 700 }}>
              <Table.Td>TOTAL</Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>{fmt(totalCA)}</Table.Td>
              <Table.Td style={{ textAlign: 'right', color: '#0ca678' }}>
                {fmt((kpi?.beneficeVentes || 0) + (kpi?.beneficeDecomptes || 0) + (kpi?.beneficeVentesPonctuels || 0) + ((kpi?.totalOccasionVentes || 0) - (kpi?.totalOccasionAchats || 0)))}
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                {consolidated.prestation.facture > 0 ? 'Non calculée (prestations)' : totalCA > 0
                  ? `${(((kpi?.beneficeVentes || 0) + (kpi?.beneficeDecomptes || 0)) / totalCA * 100).toFixed(1)}%`
                  : '—'}
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                {(kpi?.nbVentesComptoir || 0) + (kpi?.nbReglements || 0) + (kpi?.nbDecomptes || 0) + (kpi?.nbVentesPonctuels || 0)}
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Paper>

      {/* ── Top produits ── */}
      {topProduits.length > 0 && (
        <Paper shadow="sm" p="md" radius="lg" withBorder>
          <Title order={5} mb="sm">
            <IconPackage size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Top produits vendus — {periodLabel[period] || period}
          </Title>
          <ScrollArea>
            <Table striped highlightOnHover style={{ minWidth: 700 }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Produit</Table.Th>
                  <Table.Th>Catégorie</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Qté vendue</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>CA Vente</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Coût achat</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Bénéfice</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Marge</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {topProduits.map((p, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>
                      <Badge size="xs" color={i < 3 ? 'yellow' : 'gray'} variant="filled">
                        {i + 1}
                      </Badge>
                    </Table.Td>
                    <Table.Td fw={500}>{p.designation}</Table.Td>
                    <Table.Td c="dimmed">{p.categorie || '—'}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {p.qteVendue.toLocaleString('fr-FR')}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{fmt(p.caVente)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right', color: '#c92a2a' }}>{fmt(p.coutAchat)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right', color: p.benefice >= 0 ? '#2f9e44' : '#c92a2a' }}>
                      {fmt(p.benefice)}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Badge
                        color={p.caVente > 0 && (p.benefice / p.caVente) >= 0.2 ? 'green' : p.benefice >= 0 ? 'yellow' : 'red'}
                        variant="light"
                        size="sm"
                      >
                        {p.caVente > 0 ? `${((p.benefice / p.caVente) * 100).toFixed(1)}%` : '—'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      {/* ── Évolution mensuelle ── */}
      {evol.length > 0 && (
        <Paper shadow="sm" p="md" radius="lg" withBorder>
          <Title order={5} mb="sm">Évolution des 6 derniers mois</Title>
          <ScrollArea>
            <Table striped highlightOnHover style={{ minWidth: 500 }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Mois</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Ventes comptoir</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Décomptes</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Total CA</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Bénéfice décomptes</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {evol.map((e, i) => {
                  const [y, m] = e.mois.split('-');
                  const moisLabel = new Date(parseInt(y), parseInt(m) - 1, 1)
                    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                  return (
                    <Table.Tr key={i}>
                      <Table.Td fw={500} tt="capitalize">{moisLabel}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{fmt(e.totalVentes)}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{fmt(e.totalDecomptes)}</Table.Td>
                      <Table.Td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {fmt(e.totalVentes + e.totalDecomptes)}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', color: '#2f9e44' }}>
                        {fmt(e.benefice)}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      {/* ── Solde caisse ── */}
      <Paper shadow="xs" p="md" radius="md" withBorder
        style={{ borderLeft: '4px solid #e67700', background: '#fff8f0' }}>
        <Group>
          <IconCash size={28} color="#e67700" />
          <div>
            <Text size="xs" c="dimmed" tt="uppercase">Solde actuel de la caisse</Text>
            <Text size="xl" fw={700} style={{ color: '#e67700' }}>
              {fmt(kpi?.soldeJournal || 0)}
            </Text>
          </div>
        </Group>
      </Paper>

      {/* ── Modal détail ── */}
      <Modal
        opened={!!detail}
        onClose={() => setDetail(null)}
        title={
          detail?.type === 'ventes' ? 'Détail des ventes comptoir' :
          detail?.type === 'reglements' ? 'Détail des réglements' :
          'Détail des décomptes'
        }
        size="lg"
      >
        {detail && (
          <ScrollArea mah={450}>

            <Table striped highlightOnHover>
              <Table.Thead>
                {detail.type === 'ventes' && (
                  <Table.Tr>
                    <Table.Th>Code</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Client</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Montant</Table.Th>
                  </Table.Tr>
                )}
                {detail.type === 'reglements' && (
                  <Table.Tr>
                    <Table.Th>Code</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Facture</Table.Th>
                    <Table.Th>Mode</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Montant</Table.Th>
                  </Table.Tr>
                )}
                {detail.type === 'decomptes' && (
                  <Table.Tr>
                    <Table.Th>Code</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Revendeur</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Vente</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Benefice</Table.Th>
                  </Table.Tr>
                )}
              </Table.Thead>
              <Table.Tbody>
                {detail.lignes.map((l, i) => (
                  <Table.Tr key={i}>
                    {detail.type === 'ventes' && <>
                      <Table.Td><Badge size="xs" variant="outline">{l.code_vente}</Badge></Table.Td>
                      <Table.Td>{new Date(l.date_vente).toLocaleDateString('fr-FR')}</Table.Td>
                      <Table.Td>{l.nom_prenom || '—'}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{fmt(l.montant_ttc)}</Table.Td>
                    </>}
                    {detail.type === 'reglements' && <>
                      <Table.Td><Badge size="xs" variant="outline">{l.code_reglement}</Badge></Table.Td>
                      <Table.Td>{new Date(l.date_reglement).toLocaleDateString('fr-FR')}</Table.Td>
                      <Table.Td>{l.code_facture || '—'}</Table.Td>
                      <Table.Td>{l.mode_reglement || '—'}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{fmt(l.montant)}</Table.Td>
                    </>}
                    {detail.type === 'decomptes' && <>
                      <Table.Td><Badge size="xs" variant="outline">{l.code_decompte}</Badge></Table.Td>
                      <Table.Td>{new Date(l.date_decompte).toLocaleDateString('fr-FR')}</Table.Td>
                      <Table.Td>{l.NomComplet || '—'}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{fmt(l.montant_vente)}</Table.Td>
                      <Table.Td style={{ textAlign: 'right', color: '#2f9e44' }}>{fmt(l.montant_benefice)}</Table.Td>
                    </>}
                  </Table.Tr>
                ))}
                {detail.lignes.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={5} style={{ textAlign: 'center', color: '#868e96', padding: 20 }}>
                      Aucune donnee pour cette periode
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Modal>

    </Stack>
  );
}
