// src/components/pages/revendeurs/ModalImportStockRevendeur.tsx
// Import du stock d'un revendeur (permanent) depuis un fichier Excel/CSV.
//
// SYNCHRONISATION :
//  - Chaque ligne est rattachée au CATALOGUE produits : si l'article existe
//    (par code ou désignation) il est réutilisé, sinon il est créé.
//  - La quantité/prix/commission sont écrits dans `stock_revendeur` pour CE revendeur
//    (mise à jour si la ligne existe déjà, création sinon).
//  - Le STOCK GLOBAL du magasin (products.qte_stock) n'est PAS modifié : le stock du
//    revendeur est un stock qui lui est propre (ce qu'il détient déjà), indépendant.
//  - Après import, les décomptes/factures de ce revendeur utilisent ces quantités.
import React, { useState } from 'react';
import {
  Modal, Button, Group, Stack, Text, Alert, Card, Table, ScrollArea, Badge, FileInput, List,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconFileExcel, IconUpload, IconInfoCircle, IconCheck, IconAlertCircle, IconFileSpreadsheet } from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import { getDb } from '../../../database/db';
import { revendeurAuditService } from '../../../services/revendeurAuditService';

interface Props {
  opened: boolean;
  onClose: () => void;
  idRevendeur: number | null;
  revendeurNom?: string;
  onSuccess: () => void;
}

type Row = {
  designation: string; code: string; quantite: number;
  prix_achat: number; prix_vente: number; commission: number;
};

// Détection souple d'une colonne à partir de mots-clés dans l'en-tête
const pick = (obj: any, keys: string[]): any => {
  for (const k of Object.keys(obj)) {
    const norm = k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (keys.some(kw => norm.includes(kw))) return obj[k];
  }
  return undefined;
};

// Détecte spécifiquement le prix de VENTE sans confondre avec le prix d'achat
const pickPrixVente = (obj: any): any => {
  const norm = (k: string) => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const k of Object.keys(obj)) { if (norm(k).includes('vente')) return obj[k]; }
  for (const k of Object.keys(obj)) {
    const n = norm(k);
    if (n.includes('prix') && !n.includes('achat') && !n.includes('cout') && !n.includes('revient')) return obj[k];
  }
  return undefined;
};

const num = (v: any): number => {
  if (v == null || String(v).trim() === '') return 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(/[^\d.,-]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export const ModalImportStockRevendeur: React.FC<Props> = ({ opened, onClose, idRevendeur, revendeurNom, onSuccess }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ importes: number; crees: number; erreurs: string[] } | null>(null);

  const reset = () => { setRows([]); setFileName(''); setResult(null); };

  const TEMPLATE_HEADERS = ['Désignation', 'Code / Référence', 'Quantité', 'Prix achat', 'Prix vente', 'Commission (%)'];
  const TEMPLATE_EXAMPLE = ['Chargeur TECNO', 'REF-001', '10', '350', '1000', '60'];

  const downloadExcelTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock revendeur');
    XLSX.writeFile(wb, 'template_stock_revendeur.xlsx');
  };

  const downloadCSVTemplate = () => {
    const csv = [TEMPLATE_HEADERS.join(','), TEMPLATE_EXAMPLE.join(',')].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'template_stock_revendeur.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
      const parsed: Row[] = json.map((r) => ({
        designation: String(pick(r, ['designation', 'produit', 'article', 'libelle', 'nom']) || '').trim(),
        code: String(pick(r, ['code', 'reference', 'ref']) || '').trim(),
        quantite: num(pick(r, ['quantite', 'qte', 'stock', 'qty'])),
        prix_achat: num(pick(r, ['achat', 'cout', 'revient'])),
        prix_vente: num(pickPrixVente(r)),
        commission: num(pick(r, ['commission', 'taux'])),
      })).filter((r) => r.designation || r.code);
      setRows(parsed);
      if (parsed.length === 0) {
        notifications.show({ title: 'Fichier vide', message: 'Aucune ligne exploitable détectée', color: 'orange' });
      }
    } catch (e) {
      console.error(e);
      notifications.show({ title: 'Erreur', message: 'Impossible de lire le fichier', color: 'red' });
    }
  };

  const handleImport = async () => {
    if (!idRevendeur) {
      notifications.show({ title: 'Erreur', message: 'Sélectionnez d\'abord un revendeur', color: 'red' });
      return;
    }
    if (rows.length === 0) return;
    setLoading(true);
    const erreurs: string[] = [];
    let importes = 0, crees = 0;
    try {
      const db = await getDb();
      // Séquence de base pour des codes propres et uniques : PROD-XXXX à la suite de l'existant
      const seqRes = await db.select<any[]>(
        `SELECT COALESCE(MAX(CAST(substr(code_produit, 6) AS INTEGER)), 0) as maxseq FROM products WHERE code_produit LIKE 'PROD-%'`
      );
      let seqProd = Number(seqRes[0]?.maxseq || 0);
      for (const r of rows) {
        try {
          // 1. Retrouver le produit dans le catalogue (par code puis désignation)
          let idProduit: number | null = null;
          if (r.code) {
            const byCode = await db.select<any[]>(
              'SELECT idProduit FROM products WHERE code_produit = ? AND est_supprime = 0 LIMIT 1', [r.code]
            );
            if (byCode.length) idProduit = byCode[0].idProduit;
          }
          if (!idProduit && r.designation) {
            const byName = await db.select<any[]>(
              'SELECT idProduit FROM products WHERE LOWER(designation) = LOWER(?) AND est_supprime = 0 LIMIT 1', [r.designation]
            );
            if (byName.length) idProduit = byName[0].idProduit;
          }
          // 2. Créer le produit s'il n'existe pas (stock global = 0 : indépendant du revendeur)
          if (!idProduit) {
            // Code propre : la référence importée si fournie, sinon PROD-XXXX séquentiel
            const code = r.code || `PROD-${String(++seqProd).padStart(4, '0')}`;
            const ins = await db.execute(
              `INSERT INTO products (code_produit, reference, designation, prix_achat_base, prix_vente_detail, prix_vente_gros, qte_stock, seuil_alerte)
               VALUES (?, ?, ?, ?, ?, ?, 0, 5)`,
              [code, r.code || null, r.designation || code, r.prix_achat, r.prix_vente, r.prix_vente]
            );
            idProduit = Number(ins.lastInsertId);
            crees++;
          }
          // 3. Upsert dans stock_revendeur (SANS toucher au stock global)
          const existing = await db.select<any[]>(
            'SELECT idStockRevendeur, qte_stock FROM stock_revendeur WHERE idProduit = ? AND idRevendeur = ?', [idProduit, idRevendeur]
          );
          const ancienneQuantite = Number(existing[0]?.qte_stock || 0);
          if (existing.length) {
            await db.execute(
              `UPDATE stock_revendeur SET qte_stock = ?, prix_achat = ?, prix_vente = ?, commission_pourcentage = ?
               WHERE idProduit = ? AND idRevendeur = ?`,
              [r.quantite, r.prix_achat, r.prix_vente, r.commission, idProduit, idRevendeur]
            );
          } else {
            await db.execute(
              `INSERT INTO stock_revendeur (idProduit, idRevendeur, qte_stock, prix_achat, prix_vente, commission_pourcentage)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [idProduit, idRevendeur, r.quantite, r.prix_achat, r.prix_vente, r.commission]
            );
          }
          const ecart = r.quantite - ancienneQuantite;
          if (ecart !== 0) {
            await db.execute(
              `INSERT INTO mouvements_revendeur (idProduit, idRevendeur, type_mouvement, qte_mouvement)
               VALUES (?, ?, 'IMPORT_INVENTAIRE', ?)`,
              [idProduit, idRevendeur, ecart]
            );
          }
          importes++;
        } catch (e: any) {
          erreurs.push(`${r.designation || r.code} : ${e?.message || 'erreur'}`);
        }
      }
      await revendeurAuditService.tracer({ action: 'IMPORT_INVENTAIRE', entite: 'IMPORT', idRevendeur, details: { fichier: fileName, importes, crees, erreurs: erreurs.length } });
      setResult({ importes, crees, erreurs });
      notifications.show({
        title: '✅ Import terminé',
        message: `${importes} ligne(s) importée(s), ${crees} produit(s) créé(s)${erreurs.length ? `, ${erreurs.length} erreur(s)` : ''}`,
        color: erreurs.length ? 'orange' : 'green',
      });
      onSuccess();
    } catch (e: any) {
      notifications.show({ title: 'Erreur', message: e?.message || 'Échec de l\'import', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={() => { reset(); onClose(); }} size="lg" centered
      title={`Importer le stock — ${revendeurNom || 'revendeur'}`}>
      <Stack>
        <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
          <Text size="sm" fw={600} mb={4}>Comment fonctionne la synchronisation</Text>
          <List size="xs" spacing={2}>
            <List.Item>Les articles sont reliés au catalogue (par code ou désignation), créés si absents.</List.Item>
            <List.Item>Les quantités/prix/commission sont enregistrés dans le stock <b>de ce revendeur</b>.</List.Item>
            <List.Item>Le <b>stock global du magasin n'est pas modifié</b> (le stock revendeur lui est propre).</List.Item>
            <List.Item>Ensuite, ses décomptes et factures utilisent ces quantités.</List.Item>
          </List>
        </Alert>

        <Text size="xs" c="dimmed">
          Colonnes reconnues (souple) : Désignation/Produit, Code/Référence, Quantité/Qté/Stock,
          Prix achat, Prix vente, Commission.
        </Text>

        <Card withBorder p="sm" radius="md">
          <Text size="sm" fw={600} mb="xs">1. Télécharger le modèle et le remplir</Text>
          <Group grow>
            <Button variant="light" color="green" leftSection={<IconFileExcel size={16} />} onClick={downloadExcelTemplate}>
              Modèle Excel
            </Button>
            <Button variant="light" color="blue" leftSection={<IconFileSpreadsheet size={16} />} onClick={downloadCSVTemplate}>
              Modèle CSV
            </Button>
          </Group>
          <Text size="xs" c="dimmed" mt={6}>
            Colonnes : Désignation, Code / Référence, Quantité, Prix achat, Prix vente, Commission (%). Seule la Désignation (ou le Code) est indispensable ; les prix vides valent 0.
          </Text>
        </Card>

        <FileInput
          label="2. Charger le fichier rempli (Excel ou CSV)"
          placeholder="Choisir un fichier (.xlsx, .xls, .csv)"
          leftSection={<IconFileExcel size={16} />}
          accept=".xlsx,.xls,.csv"
          value={null}
          onChange={handleFile}
        />

        {fileName && <Badge variant="light">{fileName} — {rows.length} ligne(s)</Badge>}

        {rows.length > 0 && (
          <Card withBorder p="xs">
            <ScrollArea h={200}>
              <Table striped highlightOnHover fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Désignation</Table.Th><Table.Th>Code</Table.Th>
                    <Table.Th ta="right">Qté</Table.Th><Table.Th ta="right">P. achat</Table.Th>
                    <Table.Th ta="right">P. vente</Table.Th><Table.Th ta="right">Comm. %</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.slice(0, 100).map((r, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{r.designation || '-'}</Table.Td>
                      <Table.Td>{r.code || '-'}</Table.Td>
                      <Table.Td ta="right">{r.quantite}</Table.Td>
                      <Table.Td ta="right">{r.prix_achat.toLocaleString('fr-FR')}</Table.Td>
                      <Table.Td ta="right">{r.prix_vente.toLocaleString('fr-FR')}</Table.Td>
                      <Table.Td ta="right">{r.commission}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>
        )}

        {result && (
          <Alert color={result.erreurs.length ? 'orange' : 'green'} icon={<IconCheck size={16} />}>
            <Text size="sm">{result.importes} ligne(s) importée(s), {result.crees} produit(s) créé(s).</Text>
            {result.erreurs.length > 0 && (
              <List size="xs" mt={4} icon={<IconAlertCircle size={12} />}>
                {result.erreurs.slice(0, 10).map((e, i) => <List.Item key={i}>{e}</List.Item>)}
              </List>
            )}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="light" color="gray" onClick={() => { reset(); onClose(); }}>Fermer</Button>
          <Button leftSection={<IconUpload size={16} />} onClick={handleImport}
            loading={loading} disabled={rows.length === 0 || !idRevendeur}>
            Importer {rows.length > 0 ? `(${rows.length})` : ''}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default ModalImportStockRevendeur;
