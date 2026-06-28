// src/components/caisse/JournalCaisse.tsx
import React, { useState, useEffect } from 'react';
import {
  Stack, Card, Title, Text, Group, Button, Table, 
  Pagination, Modal, Divider, ThemeIcon,
  SimpleGrid, Select, TextInput, Badge, Flex, Paper,
  Loader, Center, NumberInput, ScrollArea, Tabs, 
  Alert, Grid, Textarea
} from '@mantine/core';
import {
  IconCash, IconSearch, IconRefresh, IconPrinter,
  IconPlus, IconCalendar, IconMoneybag,
  IconArrowUpRight, IconArrowDownRight,
  IconFileText, IconAlertCircle, IconDownload
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { journalCaisseService } from '../../services/journalCaisseService';
import { getDb } from '../../database/db';

interface JournalEntry {
  idJournal: number;
  code_journal: string;
  date_journal: string;
  type_mouvement: 'ENTREE' | 'SORTIE';
  categorie: string;
  designation: string;
  montant: number;
  solde_apres: number;
  reference: string;
  idReference: number;
  notes: string;
  created_at: string;
}

interface ChargeFonctionnement {
  idCharge: number;
  code_charge: string;
  date_charge: string;
  designation: string;
  montant: number;
  beneficiaire: string;
  categorie_charge: string;
  reference_paiement: string;
  idJournal: number;
  notes: string;
  created_at: string;
}

interface RecapJournalier {
  date_recap: string;
  solde_initial: number;
  total_entrees: number;
  total_sorties: number;
  solde_final: number;
  total_ventes_comptoir: number;
  total_reglements_factures: number;
  total_decomptes_revendeurs: number;
  total_charges: number;
}

const categoriesCharges = [
  { value: 'EAU', label: 'Eau' },
  { value: 'ELECTRICITE', label: 'Électricité' },
  { value: 'LOYER', label: 'Loyer' },
  { value: 'SALAIRE', label: 'Salaire' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'AUTRE', label: 'Autres charges' }
];

const categorieLabels: Record<string, string> = {
  'VENTE_COMPTOIR': 'Vente comptoir',
  'REGLEMENT_FACTURE': 'Règlement facture',
  'DECOMPTE_REVENDEUR': 'Décompte revendeur',
  'CHARGE_FONCTIONNEMENT': 'Charge fonctionnement',
  'AUTRE_ENTREE': 'Autre entrée',
  'AUTRE_SORTIE': 'Autre sortie'
};

const categorieColors: Record<string, string> = {
  'VENTE_COMPTOIR': 'teal',
  'REGLEMENT_FACTURE': 'green',
  'DECOMPTE_REVENDEUR': 'orange',
  'CHARGE_FONCTIONNEMENT': 'red',
  'AUTRE_ENTREE': 'blue',
  'AUTRE_SORTIE': 'gray'
};

// ✅ Fonction de formatage de date personnalisée (sans date-fns)
const formatDateCustom = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '-';
  }
};

const formatDateSimple = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch {
    return '-';
  }
};

export const JournalCaisse: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [charges, setCharges] = useState<ChargeFonctionnement[]>([]);
  const [recap, setRecap] = useState<RecapJournalier | null>(null);
  const [soldeActuel, setSoldeActuel] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<string | null>('journal');
  const [currentPage, setCurrentPage] = useState(1);
  const [chargeModalOpened, setChargeModalOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [chargeForm, setChargeForm] = useState({
    designation: '',
    montant: 0,
    beneficiaire: '',
    categorie_charge: 'AUTRE',
    reference_paiement: '',
    notes: ''
  });

  const itemsPerPage = 15;

  const chargerDonnees = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      
      // Vérifier si la table journal_caisse existe
      const tableExists = await db.select<any[]>(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='journal_caisse'
      `);
      
      if (tableExists.length === 0) {
        console.warn('⚠️ Table journal_caisse non trouvée');
        setJournalEntries([]);
        setCharges([]);
        setSoldeActuel(0);
        setLoading(false);
        return;
      }
      
      // Récupérer le solde actuel (tous les mouvements)
      const soldeResult = await db.select<any[]>(`
        SELECT 
          COALESCE(SUM(CASE WHEN type_mouvement = 'ENTREE' THEN montant ELSE 0 END), 0) as total_entrees,
          COALESCE(SUM(CASE WHEN type_mouvement = 'SORTIE' THEN montant ELSE 0 END), 0) as total_sorties
        FROM journal_caisse
      `);
      
      const solde = (soldeResult[0]?.total_entrees || 0) - (soldeResult[0]?.total_sorties || 0);
      setSoldeActuel(solde);
      console.log('💰 Solde actuel:', solde);
      
      // Récupérer les mouvements du jour
      const startDate = selectedDate + ' 00:00:00';
      const endDate = selectedDate + ' 23:59:59';
      
      const entries = await db.select<any[]>(`
        SELECT *
        FROM journal_caisse
        WHERE date_journal >= ? AND date_journal <= ?
        ORDER BY date_journal ASC
      `, [startDate, endDate]);
      
      console.log(`📊 ${entries.length} mouvements trouvés pour le ${selectedDate}`);
      setJournalEntries(entries);
      
      // Récupérer les charges du jour
      const chargesTableExists = await db.select<any[]>(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='charges_fonctionnement'
      `);
      
      if (chargesTableExists.length > 0) {
        const chargesData = await db.select<any[]>(`
          SELECT *
          FROM charges_fonctionnement
          WHERE date_charge >= ? AND date_charge <= ?
          ORDER BY date_charge ASC
        `, [startDate, endDate]);
        
        console.log(`📊 ${chargesData.length} charges trouvées pour le ${selectedDate}`);
        setCharges(chargesData);
      } else {
        setCharges([]);
      }
      
      // Calculer le récapitulatif
      const totalEntrees = entries.filter(e => e.type_mouvement === 'ENTREE').reduce((sum, e) => sum + e.montant, 0);
      const totalSorties = entries.filter(e => e.type_mouvement === 'SORTIE').reduce((sum, e) => sum + e.montant, 0);
      
      const recapData: RecapJournalier = {
        date_recap: selectedDate,
        solde_initial: solde - totalEntrees + totalSorties,
        total_entrees: totalEntrees,
        total_sorties: totalSorties,
        solde_final: solde,
        total_ventes_comptoir: entries.filter(e => e.categorie === 'VENTE_COMPTOIR').reduce((sum, e) => sum + e.montant, 0),
        total_reglements_factures: entries.filter(e => e.categorie === 'REGLEMENT_FACTURE').reduce((sum, e) => sum + e.montant, 0),
        total_decomptes_revendeurs: entries.filter(e => e.categorie === 'DECOMPTE_REVENDEUR').reduce((sum, e) => sum + e.montant, 0),
        total_charges: entries.filter(e => e.categorie === 'CHARGE_FONCTIONNEMENT').reduce((sum, e) => sum + e.montant, 0)
      };
      setRecap(recapData);
      
    } catch (error) {
      console.error('❌ Erreur chargement:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les données',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerDonnees();
  }, [selectedDate]);

  const handleAjouterCharge = async () => {
    if (!chargeForm.designation || chargeForm.montant <= 0 || !chargeForm.beneficiaire) {
      notifications.show({
        title: 'Erreur',
        message: 'Veuillez remplir tous les champs obligatoires',
        color: 'red'
      });
      return;
    }

    setSaving(true);
    
    try {
      await journalCaisseService.ajouterCharge({
        designation: chargeForm.designation,
        montant: chargeForm.montant,
        beneficiaire: chargeForm.beneficiaire,
        categorie_charge: chargeForm.categorie_charge,
        reference_paiement: chargeForm.reference_paiement,
        notes: chargeForm.notes
      });

      notifications.show({
        title: '✅ Succès',
        message: `Charge "${chargeForm.designation}" ajoutée avec succès`,
        color: 'green'
      });

      setChargeModalOpened(false);
      setChargeForm({
        designation: '',
        montant: 0,
        beneficiaire: '',
        categorie_charge: 'AUTRE',
        reference_paiement: '',
        notes: ''
      });
      chargerDonnees();
      
    } catch (error: any) {
      notifications.show({
        title: '❌ Erreur',
        message: error.message || 'Erreur lors de l\'ajout',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // HANDLE PRINT - Version sans date-fns
  // =====================================================
  const handlePrint = () => {
    try {
      const dateObj = new Date(selectedDate);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      const dateStr = `${day}/${month}/${year}`;
      
      const title = activeTab === 'journal' ? 'JOURNAL DE CAISSE' : 'CHARGES DE FONCTIONNEMENT';
      
      let totalEntrees = 0;
      let totalSorties = 0;
      
      if (activeTab === 'journal') {
        journalEntries.forEach((entry: JournalEntry) => {
          if (entry.type_mouvement === 'ENTREE') {
            totalEntrees += entry.montant;
          } else {
            totalSorties += entry.montant;
          }
        });
      }
      
      const soldeFinal = totalEntrees - totalSorties;
      const totalCharges = charges.reduce((sum, c) => sum + c.montant, 0);
      
      let tableRows = '';
      
      if (activeTab === 'journal') {
        journalEntries.forEach((entry: JournalEntry, idx: number) => {
          const isEntree = entry.type_mouvement === 'ENTREE';
          tableRows += `
            <tr>
              <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e8ecf1; color: #4a4a6a;">${idx + 1}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e8ecf1; color: #4a4a6a; font-size: 11px;">${formatDateCustom(entry.date_journal)}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e8ecf1;">
                <div style="font-weight: 500; color: #1a1a2e;">${entry.designation || '-'}</div>
                ${entry.reference ? `<div style="font-size: 10px; color: #8a8aa0; margin-top: 2px;">Réf: ${entry.reference}</div>` : ''}
              </td>
              <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e8ecf1;">
                <span style="display: inline-block; padding: 3px 14px; border-radius: 20px; font-size: 10px; font-weight: 600; background: ${isEntree ? '#e6f7e6' : '#fde8e8'}; color: ${isEntree ? '#1a8a1a' : '#c0392b'};">
                  ${isEntree ? 'ENTRÉE' : 'SORTIE'}
                </span>
              </td>
              <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e8ecf1; font-weight: 600; color: ${isEntree ? '#1a8a1a' : '#c0392b'};">
                ${isEntree ? '+' : '−'} ${formatMontant(entry.montant)}
              </td>
              <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e8ecf1; font-weight: 700; color: #1b365d; font-size: 12px;">
                ${formatMontant(entry.solde_apres)}
              </td>
            </tr>
          `;
        });
      } else {
        charges.forEach((charge: ChargeFonctionnement, idx: number) => {
          const catInfo = categoriesCharges.find(c => c.value === charge.categorie_charge);
          tableRows += `
            <tr>
              <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e8ecf1; color: #4a4a6a;">${idx + 1}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e8ecf1; color: #4a4a6a; font-size: 11px;">${formatDateCustom(charge.date_charge)}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e8ecf1; font-weight: 500; color: #1a1a2e;">${charge.designation || '-'}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e8ecf1; color: #4a4a6a;">${charge.beneficiaire || '-'}</td>
              <td style="padding: 10px 12px; border-bottom: 1px solid #e8ecf1;">
                <span style="display: inline-block; padding: 2px 12px; border-radius: 20px; font-size: 10px; background: #f0ecf9; color: #6c5ce7;">${catInfo?.label || charge.categorie_charge || '-'}</span>
              </td>
              <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e8ecf1; font-weight: 600; color: #c0392b;">
                − ${formatMontant(charge.montant)}
              </td>
            </tr>
          `;
        });
      }

      const totalGeneral = activeTab === 'journal' ? soldeFinal : totalCharges;
      const totalEnLettres = convertirEnLettres(totalGeneral);

      const now = new Date();
      const nowDay = String(now.getDate()).padStart(2, '0');
      const nowMonth = String(now.getMonth() + 1).padStart(2, '0');
      const nowYear = now.getFullYear();
      const nowHours = String(now.getHours()).padStart(2, '0');
      const nowMinutes = String(now.getMinutes()).padStart(2, '0');
      const dateImpression = `${nowDay}/${nowMonth}/${nowYear} à ${nowHours}:${nowMinutes}`;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title} - ${dateStr}</title>
            <meta charset="UTF-8">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
                padding: 35px 40px;
                background: #ffffff;
                color: #1a1a2e;
                font-size: 12px;
                line-height: 1.5;
              }
              .header {
                text-align: center;
                padding-bottom: 18px;
                margin-bottom: 22px;
                border-bottom: 2px solid #1b365d;
                position: relative;
              }
              .header .brand {
                font-size: 26px;
                font-weight: 700;
                color: #1b365d;
                letter-spacing: 4px;
                font-family: 'Georgia', serif;
              }
              .header .brand span { color: #d4af37; }
              .header .title {
                font-size: 18px;
                font-weight: 700;
                color: #0d1b3e;
                margin-top: 10px;
                letter-spacing: 2px;
                text-transform: uppercase;
              }
              .header .period {
                font-size: 12px;
                color: #6c6c8a;
                margin-top: 3px;
              }
              .meta {
                display: flex;
                justify-content: space-between;
                background: #f7f8fc;
                padding: 10px 16px;
                border-radius: 8px;
                margin-bottom: 18px;
                border-left: 3px solid #1b365d;
              }
              .meta .item {
                font-size: 11px;
                color: #4a4a6a;
              }
              .meta .item strong {
                color: #1b365d;
                font-weight: 600;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                font-size: 11px;
              }
              table thead th {
                background: #1b365d;
                color: #ffffff;
                padding: 10px 12px;
                text-align: left;
                font-weight: 600;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.8px;
              }
              table tbody tr:hover { background: #f7f8fc; }
              table tbody td { padding: 9px 12px; border-bottom: 1px solid #eef0f4; }
              .totals {
                margin-top: 16px;
                padding: 14px 20px;
                background: #f7f8fc;
                border-radius: 8px;
                border: 1px solid #e8ecf1;
              }
              .totals .line {
                display: flex;
                justify-content: flex-end;
                padding: 4px 0;
              }
              .totals .line .label {
                font-weight: 500;
                width: 200px;
                text-align: right;
                padding-right: 30px;
                color: #4a4a6a;
              }
              .totals .line .value {
                font-weight: 600;
                width: 150px;
                text-align: right;
              }
              .totals .grand {
                border-top: 2px solid #1b365d;
                padding-top: 10px;
                margin-top: 6px;
              }
              .totals .grand .label {
                font-weight: 700;
                font-size: 14px;
                color: #1b365d;
                width: 200px;
                text-align: right;
                padding-right: 30px;
              }
              .totals .grand .value {
                font-weight: 700;
                font-size: 15px;
                color: #1b365d;
                width: 150px;
                text-align: right;
              }
              .words {
                margin-top: 18px;
                padding: 14px 20px;
                background: #f0f4fa;
                border-radius: 8px;
                border-left: 4px solid #d4af37;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-wrap: wrap;
                gap: 8px;
              }
              .words .label {
                font-size: 12px;
                color: #4a4a6a;
                font-weight: 600;
                letter-spacing: 0.5px;
              }
              .words .value {
                font-size: 14px;
                font-weight: 700;
                color: #1b365d;
              }
              .signatures {
                display: flex;
                justify-content: space-between;
                margin-top: 35px;
                padding-top: 20px;
                border-top: 1px solid #e8ecf1;
              }
              .signatures .block {
                text-align: center;
                width: 42%;
              }
              .signatures .block .label {
                font-size: 10px;
                color: #6c6c8a;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 30px;
              }
              .signatures .block .line {
                border-top: 1px solid #1a1a2e;
                width: 70%;
                margin: 0 auto;
              }
              .signatures .block .sub {
                font-size: 9px;
                color: #a0a0c0;
                margin-top: 6px;
              }
              .footer {
                margin-top: 25px;
                text-align: center;
                font-size: 9px;
                color: #a0a0c0;
                border-top: 1px solid #eef0f4;
                padding-top: 12px;
                letter-spacing: 0.5px;
              }
              @media print {
                body { padding: 20px 25px; }
                table thead th { background: #1b365d !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="brand">GESTION <span>PRO</span></div>
              <div class="title">${title}</div>
              <div class="period">Période du ${dateStr}</div>
            </div>

            <div class="meta">
              <span class="item"><strong>📄 Document</strong> ${activeTab === 'journal' ? 'Journal de Caisse' : 'Charges de fonctionnement'}</span>
              <span class="item"><strong>📅 Date</strong> ${dateStr}</span>
              <span class="item"><strong>📊 Lignes</strong> ${activeTab === 'journal' ? journalEntries.length : charges.length}</span>
              <span class="item"><strong>💰 Solde</strong> ${formatMontant(soldeActuel)} FCFA</span>
            </div>

            <table>
              <thead>
                <tr>
                  ${activeTab === 'journal' ? `
                    <th style="width: 6%; text-align: center;">N°</th>
                    <th style="width: 16%;">Date</th>
                    <th style="width: 30%;">Désignation</th>
                    <th style="width: 14%; text-align: center;">Type</th>
                    <th style="width: 17%; text-align: right;">Montant</th>
                    <th style="width: 17%; text-align: right;">Solde</th>
                  ` : `
                    <th style="width: 6%; text-align: center;">N°</th>
                    <th style="width: 16%;">Date</th>
                    <th style="width: 26%;">Désignation</th>
                    <th style="width: 20%;">Bénéficiaire</th>
                    <th style="width: 16%;">Catégorie</th>
                    <th style="width: 16%; text-align: right;">Montant</th>
                  `}
                </tr>
              </thead>
              <tbody>
                ${tableRows || `
                  <tr>
                    <td colspan="6" style="text-align: center; padding: 40px 20px; color: #a0a0c0;">
                      <div style="font-size: 14px;">📭</div>
                      <div style="margin-top: 8px;">Aucune donnée disponible pour cette période</div>
                    </td>
                  </tr>
                `}
              </tbody>
            </table>

            ${((activeTab === 'journal' && journalEntries.length > 0) || (activeTab === 'charges' && charges.length > 0)) ? `
            <div class="totals">
              ${activeTab === 'journal' ? `
                <div class="line">
                  <span class="label">SOUS-TOTAL ENTREES</span>
                  <span class="value" style="color: #1a8a1a;">+ ${formatMontant(totalEntrees)}</span>
                </div>
                <div class="line">
                  <span class="label">SOUS-TOTAL SORTIES</span>
                  <span class="value" style="color: #c0392b;">− ${formatMontant(totalSorties)}</span>
                </div>
                <div class="line grand">
                  <span class="label">TOTAL GÉNÉRAL</span>
                  <span class="value">${formatMontant(soldeFinal)} FCFA</span>
                </div>
              ` : `
                <div class="line grand">
                  <span class="label">TOTAL GÉNÉRAL CHARGES</span>
                  <span class="value" style="color: #c0392b;">${formatMontant(totalCharges)} FCFA</span>
                </div>
              `}
            </div>

            <div class="words">
              <span class="label">❖ ARRÊTÉ LE PRÉSENT COMPTE À LA SOMME DE</span>
              <span class="value">${totalEnLettres} (${formatMontant(totalGeneral)}) Francs CFA</span>
            </div>
            ` : ''}

            <div class="signatures">
              <div class="block">
                <div class="label">Le Gérant(e)</div>
                <div class="line"></div>
                <div class="sub">Nom, prénom et signature</div>
              </div>
              <div class="block">
                <div class="label">Le Responsable</div>
                <div class="line"></div>
                <div class="sub">Nom, prénom et signature</div>
              </div>
            </div>

            <div class="footer">
              Document généré le ${dateImpression} — © ${new Date().getFullYear()} Gestion Pro
            </div>
          </body>
        </html>
      `;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();
        
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            const win = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
            if (win) {
              win.document.write(html);
              win.document.close();
              win.focus();
              win.print();
            }
          }
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 2000);
        }, 500);
      }
      
    } catch (error) {
      console.error('Erreur impression:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de l\'impression',
        color: 'red'
      });
    }
  };

  // =====================================================
  // HANDLE EXPORT CSV - Version sans date-fns
  // =====================================================
  const handleExportCSV = () => {
    try {
      const data = activeTab === 'journal' ? journalEntries : charges;
      
      if (data.length === 0) {
        notifications.show({
          title: 'Information',
          message: 'Aucune donnée à exporter',
          color: 'blue'
        });
        return;
      }
      
      let csvContent = '';
      
      if (activeTab === 'journal') {
        csvContent = 'N°;Date;Désignation;Type;Catégorie;Montant;Solde;Référence\n';
        journalEntries.forEach((entry: JournalEntry, idx: number) => {
          csvContent += `${idx + 1};${formatDateCustom(entry.date_journal)};${entry.designation || ''};${entry.type_mouvement || ''};${categorieLabels[entry.categorie] || entry.categorie || ''};${entry.montant || 0};${entry.solde_apres || 0};${entry.reference || ''}\n`;
        });
      } else {
        csvContent = 'N°;Date;Désignation;Bénéficiaire;Catégorie;Montant;Référence\n';
        charges.forEach((charge: ChargeFonctionnement, idx: number) => {
          const catInfo = categoriesCharges.find(c => c.value === charge.categorie_charge);
          csvContent += `${idx + 1};${formatDateCustom(charge.date_charge)};${charge.designation || ''};${charge.beneficiaire || ''};${catInfo?.label || charge.categorie_charge || ''};${charge.montant || 0};${charge.reference_paiement || ''}\n`;
        });
      }
      
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const dateObj = new Date(selectedDate);
      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      const fileName = `${activeTab === 'journal' ? 'journal_caisse' : 'charges'}_${dateStr}.csv`;
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      notifications.show({
        title: '✅ Succès',
        message: `Export CSV effectué (${data.length} lignes)`,
        color: 'green'
      });
      
    } catch (error) {
      console.error('Erreur export:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de l\'export CSV',
        color: 'red'
      });
    }
  };

  // =====================================================
  // FONCTIONS UTILITAIRES
  // =====================================================
  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  const convertirEnLettres = (montant: number): string => {
    if (montant === 0) return 'ZÉRO';
    const nombre = Math.round(Math.abs(montant));
    const unite = ['', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF'];
    const dizaine = ['', 'DIX', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE-DIX', 'QUATRE-VINGT', 'QUATRE-VINGT-DIX'];
    
    if (nombre < 100) {
      if (nombre < 10) return unite[nombre];
      if (nombre < 20) {
        const specials = ['DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE', 'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF'];
        return specials[nombre - 10];
      }
      const d = Math.floor(nombre / 10);
      const u = nombre % 10;
      if (u === 0) return dizaine[d];
      if (d === 7 || d === 9) return dizaine[d] + '-' + unite[u];
      return dizaine[d] + '-' + unite[u];
    }
    
    if (nombre < 1000) {
      const c = Math.floor(nombre / 100);
      const r = nombre % 100;
      let result = c === 1 ? 'CENT' : unite[c] + ' CENT';
      if (r > 0) result += ' ' + convertirEnLettres(r);
      return result;
    }
    
    if (nombre < 1000000) {
      const m = Math.floor(nombre / 1000);
      const r = nombre % 1000;
      let result = m === 1 ? 'MILLE' : convertirEnLettres(m) + ' MILLE';
      if (r > 0) result += ' ' + convertirEnLettres(r);
      return result;
    }
    
    return String(nombre);
  };

  // ✅ NOUVELLE FONCTION : Affiche le libellé ENTRÉE ou SORTIE
  const getTypeLabel = (type: string) => {
    return type === 'ENTREE' ? 
      <Badge color="green" size="sm">ENTRÉE</Badge> : 
      <Badge color="red" size="sm">SORTIE</Badge>;
  };

  const getCategorieBadge = (categorie: string) => {
    if (!categorie) return <Badge size="xs">Non défini</Badge>;
    return (
      <Badge color={categorieColors[categorie] || 'gray'} variant="light" size="sm">
        {categorieLabels[categorie] || categorie}
      </Badge>
    );
  };

  const filteredEntries = journalEntries.filter((entry: JournalEntry) => {
    if (!entry) return false;
    const search = searchTerm.toLowerCase();
    return (
      (entry.designation || '').toLowerCase().includes(search) ||
      (entry.reference || '').toLowerCase().includes(search)
    );
  });

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const filteredCharges = charges.filter((charge: ChargeFonctionnement) => {
    if (!charge) return false;
    const search = searchTerm.toLowerCase();
    return (
      (charge.designation || '').toLowerCase().includes(search) ||
      (charge.beneficiaire || '').toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
      </Center>
    );
  }

  return (
    <Stack gap="lg" p="md">
      {/* EN-TÊTE */}
      <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', borderBottom: '3px solid #e94560' }}>
        <Flex justify="space-between" align="center" wrap="wrap">
          <Group gap="md">
            <ThemeIcon size={45} radius="md" color="yellow" variant="filled">
              <IconCash size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white">Journal de Caisse</Title>
              <Text c="gray.3" size="sm">Suivi des entrées et sorties d'argent</Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              color="white"
              leftSection={<IconRefresh size={18} />}
              onClick={chargerDonnees}
            >
              Actualiser
            </Button>
          </Group>
        </Flex>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xl">
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="white" variant="light" size="lg">
                <IconMoneybag size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Solde actuel</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(soldeActuel)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(46,125,50,0.3)' }}>
            <Group>
              <ThemeIcon color="green" variant="light" size="lg">
                <IconArrowUpRight size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Entrées du jour</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(recap?.total_entrees || 0)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(211,47,47,0.3)' }}>
            <Group>
              <ThemeIcon color="red" variant="light" size="lg">
                <IconArrowDownRight size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Sorties du jour</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(recap?.total_sorties || 0)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="yellow" variant="light" size="lg">
                <IconCalendar size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Date</Text>
                <Text c="white" fw={700} size="xl">
                  {formatDateSimple(selectedDate)}
                </Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* FILTRES */}
      <Card withBorder radius="lg" shadow="sm" p="sm">
        <Grid align="flex-end">
          <Grid.Col span={3}>
            <TextInput
              label="Date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              size="xs"
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput
              placeholder="Rechercher..."
              leftSection={<IconSearch size={14} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="xs"
            />
          </Grid.Col>
          <Grid.Col span={5}>
            <Group justify="flex-end" gap="xs">
              <Button
                variant="light"
                color="blue"
                leftSection={<IconRefresh size={14} />}
                onClick={() => chargerDonnees()}
                size="xs"
              >
                Charger
              </Button>
              <Button
                variant="filled"
                color="red"
                leftSection={<IconPlus size={14} />}
                onClick={() => setChargeModalOpened(true)}
                size="xs"
              >
                Charge
              </Button>
              <Button
                variant="light"
                color="teal"
                leftSection={<IconPrinter size={14} />}
                onClick={handlePrint}
                size="xs"
              >
                Imprimer
              </Button>
              <Button
                variant="light"
                color="grape"
                leftSection={<IconDownload size={14} />}
                onClick={handleExportCSV}
                size="xs"
              >
                CSV
              </Button>
            </Group>
          </Grid.Col>
        </Grid>
      </Card>

      {/* TABLEAUX */}
      <Card withBorder radius="lg" shadow="sm" p="md">
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List grow>
            <Tabs.Tab value="journal" leftSection={<IconFileText size={16} />}>
              Journal de caisse
              <Badge size="xs" color="blue" ml="xs" variant="light">{journalEntries.length}</Badge>
            </Tabs.Tab>
            <Tabs.Tab value="charges" leftSection={<IconMoneybag size={16} />}>
              Charges fonctionnement
              <Badge size="xs" color="red" ml="xs" variant="light">{charges.length}</Badge>
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="journal" pt="md">
            <Card withBorder radius="lg" shadow="sm" p={0}>
              <ScrollArea h={450}>
                <Table striped highlightOnHover verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
                      <Table.Th c="white" w={50}>N°</Table.Th>
                      <Table.Th c="white">Date</Table.Th>
                      <Table.Th c="white">Désignation</Table.Th>
                      <Table.Th c="white" ta="center">Type</Table.Th>
                      <Table.Th c="white" ta="center">Catégorie</Table.Th>
                      <Table.Th c="white" ta="right">Montant</Table.Th>
                      <Table.Th c="white" ta="right">Solde</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedEntries.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={7} align="center">
                          <Text c="dimmed" py={40}>
                            Aucun mouvement pour le {formatDateSimple(selectedDate)}
                          </Text>
                          <Text c="dimmed" size="sm">Les ventes et règlements apparaîtront ici automatiquement</Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      paginatedEntries.map((entry, idx) => {
                        const num = (currentPage - 1) * itemsPerPage + idx + 1;
                        return (
                          <Table.Tr key={entry.idJournal}>
                            <Table.Td fw={600}>{num}</Table.Td>
                            <Table.Td>
                              <Text size="sm">{formatDateCustom(entry.date_journal)}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" fw={500}>{entry.designation || '-'}</Text>
                              {entry.reference && (
                                <Text size="xs" c="dimmed">Réf: {entry.reference}</Text>
                              )}
                            </Table.Td>
                            <Table.Td ta="center">
                              {/* ✅ NOUVEAU : Affichage du badge ENTRÉE / SORTIE */}
                              {getTypeLabel(entry.type_mouvement)}
                            </Table.Td>
                            <Table.Td ta="center">
                              {getCategorieBadge(entry.categorie)}
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text fw={600} c={entry.type_mouvement === 'ENTREE' ? 'green' : 'red'}>
                                {entry.type_mouvement === 'ENTREE' ? '+' : '-'}
                                {formatMontant(entry.montant)} F
                              </Text>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text fw={700}>{formatMontant(entry.solde_apres)} F</Text>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })
                    )}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {totalPages > 1 && (
                <Group justify="center" p="md">
                  <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="sm" />
                </Group>
              )}
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="charges" pt="md">
            <Card withBorder radius="lg" shadow="sm" p={0}>
              <ScrollArea h={450}>
                <Table striped highlightOnHover verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
                      <Table.Th c="white" w={50}>N°</Table.Th>
                      <Table.Th c="white">Date</Table.Th>
                      <Table.Th c="white">Désignation</Table.Th>
                      <Table.Th c="white">Bénéficiaire</Table.Th>
                      <Table.Th c="white">Catégorie</Table.Th>
                      <Table.Th c="white" ta="right">Montant</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredCharges.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={6} align="center">
                          <Text c="dimmed" py={40}>Aucune charge pour cette date</Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      filteredCharges.map((charge, idx) => {
                        const catInfo = categoriesCharges.find(c => c.value === charge.categorie_charge);
                        return (
                          <Table.Tr key={charge.idCharge}>
                            <Table.Td fw={600}>{idx + 1}</Table.Td>
                            <Table.Td>{formatDateCustom(charge.date_charge)}</Table.Td>
                            <Table.Td>
                              <Text fw={500} size="sm">{charge.designation || '-'}</Text>
                              {charge.reference_paiement && (
                                <Text size="xs" c="dimmed">Réf: {charge.reference_paiement}</Text>
                              )}
                            </Table.Td>
                            <Table.Td>{charge.beneficiaire || '-'}</Table.Td>
                            <Table.Td>
                              <Badge variant="light" size="sm">
                                {catInfo?.label || charge.categorie_charge || '-'}
                              </Badge>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text fw={600} c="red">{formatMontant(charge.montant)} F</Text>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })
                    )}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Card>
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* MODAL AJOUT CHARGE */}
      <Modal
        opened={chargeModalOpened}
        onClose={() => setChargeModalOpened(false)}
        title="Ajouter une charge de fonctionnement"
        size="md"
        centered
        styles={{
          header: { backgroundColor: '#1a1a2e', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        <Stack gap="md">
          <Alert color="orange" variant="light" icon={<IconAlertCircle size={16} />}>
            Solde actuel: <strong>{formatMontant(soldeActuel)} FCFA</strong>
          </Alert>

          <TextInput
            label="Désignation *"
            placeholder="Ex: Achat fournitures bureau"
            value={chargeForm.designation}
            onChange={(e) => setChargeForm({ ...chargeForm, designation: e.target.value })}
            required
            size="xs"
          />

          <NumberInput
            label="Montant *"
            placeholder="0"
            value={chargeForm.montant}
            onChange={(val) => setChargeForm({ ...chargeForm, montant: typeof val === 'number' ? val : 0 })}
            min={0}
            step={100}
            required
            leftSection="FCFA"
            size="xs"
          />

          <TextInput
            label="Bénéficiaire *"
            placeholder="Nom du bénéficiaire"
            value={chargeForm.beneficiaire}
            onChange={(e) => setChargeForm({ ...chargeForm, beneficiaire: e.target.value })}
            required
            size="xs"
          />

          <Select
            label="Catégorie"
            placeholder="Sélectionner une catégorie"
            data={categoriesCharges}
            value={chargeForm.categorie_charge}
            onChange={(value) => setChargeForm({ ...chargeForm, categorie_charge: value || 'AUTRE' })}
            size="xs"
          />

          <TextInput
            label="Référence de paiement"
            placeholder="N° de chèque, virement, etc."
            value={chargeForm.reference_paiement}
            onChange={(e) => setChargeForm({ ...chargeForm, reference_paiement: e.target.value })}
            size="xs"
          />

          <Textarea
            label="Notes"
            placeholder="Informations complémentaires"
            value={chargeForm.notes}
            onChange={(e) => setChargeForm({ ...chargeForm, notes: e.target.value })}
            rows={2}
            size="xs"
          />

          <Divider />

          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setChargeModalOpened(false)} size="xs">
              Annuler
            </Button>
            <Button
              onClick={handleAjouterCharge}
              loading={saving}
              color="red"
              leftSection={<IconPlus size={14} />}
              size="xs"
            >
              Ajouter la charge
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default JournalCaisse;