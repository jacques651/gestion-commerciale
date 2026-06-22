// src/components/DiagnosticDB.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  Title,
  Text,
  Group,
  Stack,
  SimpleGrid,
  Badge,
  Button,
  Table,
  ScrollArea,
  LoadingOverlay,
  Alert,
  Box,
  Divider,
  ThemeIcon,
  Paper,
  Chip,
  Modal,
  TextInput,
  PasswordInput,
  ActionIcon,
  Tooltip,
  Code,
  Switch,
  NativeSelect,
  Textarea,
  Tabs,
  Menu,
  Checkbox,
  Pagination,
  Container,
  Center,
  RingProgress,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconDatabase,
  IconTable,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconRefresh,
  IconShieldCheck,
  IconPlus,
  IconTrash,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconDatabaseExport,
  IconDatabaseImport,
  IconFileDownload,
  IconAlertTriangle,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconHistory,
  IconSql,
  IconCode,
  IconTerminal,
  IconDeviceFloppy,
  IconFileImport,
  IconActivity,
} from '@tabler/icons-react';
import { getDb } from '../database/db';

// =====================================================
// TYPES
// =====================================================

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface TableStats {
  name: string;
  rowCount: number;
  columns: ColumnInfo[];
}

interface TableRow {
  [key: string]: any;
}

interface QueryHistory {
  id: string;
  query: string;
  timestamp: string;
  duration: number;
  rowCount: number;
  success: boolean;
}

interface BackupInfo {
  name: string;
  size: number;
  date: string;
}

// =====================================================
// CONSTANTES
// =====================================================

const financeTables = [
  'reglements',
  'reglements_revendeur',
  'factures',
  'facture_details',
  'factures_revendeur',
  'factures_revendeur_details',
  'credits',
  'remboursements',
  'journal_caisse',
  'charges_fonctionnement',
  'recapitulatif_journalier'
];

// =====================================================
// COMPOSANT PRINCIPAL
// =====================================================

export const DiagnosticDB: React.FC = () => {
  const [tables, setTables] = useState<TableStats[]>([]);
  const [filteredTables, setFilteredTables] = useState<TableStats[]>([]);
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [tableData, setTableData] = useState<TableRow[]>([]);
  const [filteredData, setFilteredData] = useState<TableRow[]>([]);
  const [showData, setShowData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setDbPath] = useState<string>('');
  const [integrityOk, setIntegrityOk] = useState<boolean | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [queryHistory, setQueryHistory] = useState<QueryHistory[]>([]);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>('tables');
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [recreateModal, setRecreateModal] = useState(false);
  const [recreating, setRecreating] = useState(false);

  // Modals
  const [addColumnOpened, { open: openAddColumn, close: closeAddColumn }] = useDisclosure(false);
  const [deleteColumnOpened, { open: openDeleteColumn, close: closeDeleteColumn }] = useDisclosure(false);
  const [resetDbOpened, { open: openResetDb, close: closeResetDb }] = useDisclosure(false);
  const [sqlQueryOpened, { open: openSqlQuery, close: closeSqlQuery }] = useDisclosure(false);
  const [editRowOpened, { open: openEditRow, close: closeEditRow }] = useDisclosure(false);
  const [backupOpened, { open: openBackup, close: closeBackup }] = useDisclosure(false);
  const [restoreOpened, { open: openRestore, close: closeRestore }] = useDisclosure(false);
  const [addRowOpened, { open: openAddRow, close: closeAddRow }] = useDisclosure(false);

  // Form states
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState('TEXT');
  const [newColumnDefault, setNewColumnDefault] = useState('');
  const [newColumnNotNull, setNewColumnNotNull] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState('');
  const [confirmReset, setConfirmReset] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryResult, setQueryResult] = useState<any[]>([]);
  const [editingRow, setEditingRow] = useState<TableRow | null>(null);
  const [editedRowData, setEditedRowData] = useState<TableRow>({});
  const [backupName, setBackupName] = useState('');
  const [newRowData, setNewRowData] = useState<TableRow>({});
  const [isAddingRow, setIsAddingRow] = useState(false);

  // =====================================================
  // CHARGEMENT DES DONNÉES
  // =====================================================

  useEffect(() => {
    loadDatabaseInfo();
    loadBackups();
  }, []);

  // Filtrer les tables par recherche
  useEffect(() => {
    if (!tableSearchTerm.trim()) {
      setFilteredTables(tables);
    } else {
      const term = tableSearchTerm.toLowerCase();
      const filtered = tables.filter(table => 
        table.name.toLowerCase().includes(term)
      );
      setFilteredTables(filtered);
    }
  }, [tables, tableSearchTerm]);

  const loadDatabaseInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const db = await getDb();

      try {
        const pathResult = await db.select<{ file: string }[]>('PRAGMA database_list');
        if (pathResult && pathResult.length > 0) {
          setDbPath(pathResult[0]?.file || 'Inconnu');
        }
      } catch (e) {
        console.log('Impossible d\'obtenir le chemin de la base');
      }

      const tableList = await db.select<{ name: string }[]>(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);

      const tableNames = tableList.map((t) => t.name);

      const stats: TableStats[] = [];
      for (const tableName of tableNames) {
        try {
          const countResult = await db.select<{ count: number }[]>(
            `SELECT COUNT(*) as count FROM ${tableName}`
          );
          const columnsResult = await db.select<ColumnInfo[]>(
            `PRAGMA table_info(${tableName})`
          );
          stats.push({
            name: tableName,
            rowCount: countResult[0]?.count || 0,
            columns: columnsResult,
          });
        } catch (e) {
          stats.push({
            name: tableName,
            rowCount: 0,
            columns: [],
          });
        }
      }

      setTables(stats);
      setFilteredTables(stats);

      if (tableNames.length > 0) {
        setSelectedTable(tableNames[0]);
        const cols = await db.select<ColumnInfo[]>(
          `PRAGMA table_info(${tableNames[0]})`
        );
        setColumns(cols);
        await loadTableData(tableNames[0]);
      }
    } catch (err) {
      console.error('Erreur:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (tableName: string, page: number = 1) => {
    try {
      const db = await getDb();
      const offset = (page - 1) * itemsPerPage;
      const data = await db.select<TableRow[]>(
        `SELECT * FROM ${tableName} LIMIT ${itemsPerPage} OFFSET ${offset}`
      );
      setTableData(data);
      setFilteredData(data);
      setCurrentPage(page);
    } catch (err) {
      console.error('Erreur chargement données:', err);
      setTableData([]);
      setFilteredData([]);
    }
  };

  // =====================================================
  // TRI DES DONNÉES
  // =====================================================

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }

    const sorted = [...filteredData].sort((a, b) => {
      const aVal = a[field] ?? '';
      const bVal = b[field] ?? '';
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    setFilteredData(sorted);
  };

  // =====================================================
  // SÉLECTION D'UNE TABLE
  // =====================================================

  const handleTableSelect = async (tableName: string) => {
    try {
      const db = await getDb();
      setSelectedTable(tableName);
      const cols = await db.select<ColumnInfo[]>(
        `PRAGMA table_info(${tableName})`
      );
      setColumns(cols);
      await loadTableData(tableName);
      setShowData(false);
      setSelectedRows([]);
    } catch (err) {
      console.error('Erreur lors de la sélection:', err);
    }
  };

  // =====================================================
  // AJOUTER UNE LIGNE
  // =====================================================

  const handleAddRow = () => {
    const emptyRow: TableRow = {};
    columns.forEach(col => {
      if (col.pk === 1) {
        emptyRow[col.name] = '';
      } else if (col.dflt_value) {
        emptyRow[col.name] = col.dflt_value;
      } else {
        emptyRow[col.name] = '';
      }
    });
    setNewRowData(emptyRow);
    openAddRow();
  };

  const handleSaveNewRow = async () => {
    setIsAddingRow(true);
    try {
      const db = await getDb();

      const columnsList = Object.keys(newRowData).filter(key => {
        const col = columns.find(c => c.name === key);
        return !(col?.pk === 1 && (newRowData[key] === '' || newRowData[key] === null));
      });

      const placeholders = columnsList.map(() => '?').join(', ');
      const values = columnsList.map(key => newRowData[key] || null);

      await db.execute(
        `INSERT INTO ${selectedTable} (${columnsList.join(', ')}) VALUES (${placeholders})`,
        values
      );

      notifications.show({
        title: '✅ Succès',
        message: `Nouvelle ligne ajoutée à "${selectedTable}"`,
        color: 'green',
      });

      closeAddRow();
      await loadTableData(selectedTable, currentPage);
    } catch (err) {
      notifications.show({
        title: '❌ Erreur',
        message: err instanceof Error ? err.message : 'Erreur inconnue',
        color: 'red',
      });
    } finally {
      setIsAddingRow(false);
    }
  };

  // =====================================================
  // AJOUTER UNE COLONNE
  // =====================================================

  const handleAddColumn = async () => {
    if (!selectedTable || !newColumnName) {
      notifications.show({
        title: 'Erreur',
        message: 'Veuillez remplir tous les champs',
        color: 'red',
      });
      return;
    }

    try {
      const db = await getDb();
      let sql = `ALTER TABLE ${selectedTable} ADD COLUMN ${newColumnName} ${newColumnType}`;

      if (newColumnDefault && newColumnDefault.trim() !== '') {
        sql += ` DEFAULT ${newColumnDefault}`;
      }

      if (newColumnNotNull) {
        sql += ` NOT NULL`;
      }

      await db.execute(sql);

      notifications.show({
        title: '✅ Succès',
        message: `Colonne "${newColumnName}" ajoutée à "${selectedTable}"`,
        color: 'green',
      });

      await loadDatabaseInfo();
      closeAddColumn();
      setNewColumnName('');
      setNewColumnType('TEXT');
      setNewColumnDefault('');
      setNewColumnNotNull(false);
    } catch (err) {
      notifications.show({
        title: '❌ Erreur',
        message: err instanceof Error ? err.message : 'Erreur inconnue',
        color: 'red',
      });
    }
  };

  // =====================================================
  // SUPPRIMER UNE COLONNE
  // =====================================================

  const handleDeleteColumn = async () => {
    if (!selectedTable || !selectedColumn) {
      notifications.show({
        title: 'Erreur',
        message: 'Veuillez sélectionner une colonne',
        color: 'red',
      });
      return;
    }

    try {
      const db = await getDb();

      const columnsInfo = await db.select<ColumnInfo[]>(
        `PRAGMA table_info(${selectedTable})`
      );

      const remainingColumns = columnsInfo
        .filter(col => col.name !== selectedColumn)
        .map(col => `${col.name} ${col.type}`)
        .join(', ');

      const tempTable = `${selectedTable}_temp`;
      await db.execute(`CREATE TABLE ${tempTable} AS SELECT ${remainingColumns} FROM ${selectedTable}`);
      await db.execute(`DROP TABLE ${selectedTable}`);
      await db.execute(`ALTER TABLE ${tempTable} RENAME TO ${selectedTable}`);

      notifications.show({
        title: '✅ Succès',
        message: `Colonne "${selectedColumn}" supprimée de "${selectedTable}"`,
        color: 'green',
      });

      await loadDatabaseInfo();
      closeDeleteColumn();
      setSelectedColumn('');
    } catch (err) {
      notifications.show({
        title: '❌ Erreur',
        message: err instanceof Error ? err.message : 'Erreur inconnue',
        color: 'red',
      });
    }
  };

  // =====================================================
  // MODIFIER UNE LIGNE
  // =====================================================

  const handleEditRow = (row: TableRow) => {
    setEditingRow(row);
    setEditedRowData({ ...row });
    openEditRow();
  };

  const handleSaveRow = async () => {
    if (!editingRow || !selectedTable) return;

    try {
      const db = await getDb();
      const primaryKey = columns.find(col => col.pk === 1)?.name || 'id';
      const id = editingRow[primaryKey];

      const updates = Object.keys(editedRowData)
        .filter(key => key !== primaryKey)
        .map(key => `${key} = ?`)
        .join(', ');

      const values = Object.keys(editedRowData)
        .filter(key => key !== primaryKey)
        .map(key => editedRowData[key]);

      await db.execute(
        `UPDATE ${selectedTable} SET ${updates} WHERE ${primaryKey} = ?`,
        [...values, id]
      );

      notifications.show({
        title: '✅ Succès',
        message: 'Ligne mise à jour avec succès',
        color: 'green',
      });

      await loadTableData(selectedTable, currentPage);
      closeEditRow();
    } catch (err) {
      notifications.show({
        title: '❌ Erreur',
        message: err instanceof Error ? err.message : 'Erreur inconnue',
        color: 'red',
      });
    }
  };

  // =====================================================
  // SUPPRIMER DES LIGNES SÉLECTIONNÉES
  // =====================================================

  const handleDeleteSelectedRows = async () => {
    if (selectedRows.length === 0) return;

    try {
      const db = await getDb();
      const primaryKey = columns.find(col => col.pk === 1)?.name || 'id';

      const placeholders = selectedRows.map(() => '?').join(',');
      await db.execute(
        `DELETE FROM ${selectedTable} WHERE ${primaryKey} IN (${placeholders})`,
        selectedRows
      );

      notifications.show({
        title: '✅ Succès',
        message: `${selectedRows.length} lignes supprimées`,
        color: 'green',
      });

      setSelectedRows([]);
      await loadTableData(selectedTable, currentPage);
    } catch (err) {
      notifications.show({
        title: '❌ Erreur',
        message: err instanceof Error ? err.message : 'Erreur inconnue',
        color: 'red',
      });
    }
  };

  // =====================================================
  // EXÉCUTER UNE REQUÊTE SQL
  // =====================================================

  const executeSqlQuery = async () => {
    if (!sqlQuery.trim()) {
      notifications.show({
        title: 'Erreur',
        message: 'Veuillez saisir une requête SQL',
        color: 'red',
      });
      return;
    }

    const startTime = Date.now();

    try {
      const db = await getDb();
      const isSelect = sqlQuery.trim().toLowerCase().startsWith('select');

      let result: TableRow[] | undefined;
      if (isSelect) {
        result = await db.select<TableRow[]>(sqlQuery);
        setQueryResult(result || []);
      } else {
        await db.execute(sqlQuery);
        setQueryResult([{ message: 'Requête exécutée avec succès' }]);
      }

      const duration = Date.now() - startTime;

      setQueryHistory(prev => [{
        id: Date.now().toString(),
        query: sqlQuery,
        timestamp: new Date().toISOString(),
        duration,
        rowCount: isSelect ? (result?.length || 0) : 0,
        success: true,
      }, ...prev].slice(0, 50));

      notifications.show({
        title: '✅ Succès',
        message: `Requête exécutée en ${duration}ms${isSelect ? `, ${result?.length || 0} lignes` : ''}`,
        color: 'green',
      });

    } catch (err) {
      const duration = Date.now() - startTime;
      setQueryResult([{ error: err instanceof Error ? err.message : 'Erreur inconnue' }]);

      setQueryHistory(prev => [{
        id: Date.now().toString(),
        query: sqlQuery,
        timestamp: new Date().toISOString(),
        duration,
        rowCount: 0,
        success: false,
      }, ...prev].slice(0, 50));

      notifications.show({
        title: '❌ Erreur SQL',
        message: err instanceof Error ? err.message : 'Erreur inconnue',
        color: 'red',
      });
    }
  };

  // =====================================================
  // SAUVEGARDER ET RESTAURER
  // =====================================================

  const createBackup = async () => {
    try {
      const db = await getDb();
      const backupName = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;

      await db.execute(`VACUUM INTO '${backupName}'`);

      notifications.show({
        title: '✅ Succès',
        message: `Backup créé: ${backupName}`,
        color: 'green',
      });

      loadBackups();
      closeBackup();
    } catch (err) {
      notifications.show({
        title: '❌ Erreur',
        message: err instanceof Error ? err.message : 'Erreur inconnue',
        color: 'red',
      });
    }
  };

  const loadBackups = async () => {
    try {
      setBackups([
        { name: 'backup_2026-06-21_10-30-00.db', size: 245760, date: '2026-06-21 10:30:00' },
        { name: 'backup_2026-06-20_15-45-00.db', size: 241664, date: '2026-06-20 15:45:00' },
        { name: 'backup_2026-06-19_08-00-00.db', size: 239104, date: '2026-06-19 08:00:00' },
      ]);
    } catch (error) {
      console.error('Erreur chargement backups:', error);
    }
  };

 // Fonction handleResetDatabase corrigée

const handleResetDatabase = async () => {
  if (confirmPassword !== 'admin123') {
    notifications.show({
      title: '❌ Erreur',
      message: 'Mot de passe incorrect',
      color: 'red',
    });
    return;
  }

  try {
    setLoading(true);
    
    // ✅ Récupérer la connexion à la base
    const db = await getDb();
    
    // 1. Récupérer la liste des tables
    const tables = await db.select<{ name: string }[]>(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    // 2. Supprimer toutes les tables
    for (const table of tables) {
      try {
        await db.execute(`DROP TABLE IF EXISTS ${table.name}`);
        console.log(`✅ Table supprimée: ${table.name}`);
      } catch (e) {
        console.warn(`Impossible de supprimer ${table.name}:`, e);
      }
    }
    
    // 3. Recréer les tables avec le schéma
    // Importer dynamiquement le schéma
    const { initDatabase } = await import('../database/db');
    await initDatabase();
    
    // 4. Vérifier que les tables ont été recréées
    const newTables = await db.select<{ name: string }[]>(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    console.log('✅ Tables recréées:', newTables.map(t => t.name).join(', '));

    notifications.show({
      title: '✅ Succès',
      message: `Base de données réinitialisée avec succès (${newTables.length} tables)`,
      color: 'green',
    });

    closeResetDb();
    setConfirmPassword('');
    setConfirmReset('');
    
    // 5. Recharger les données
    await loadDatabaseInfo();
    
    // 6. Redémarrer l'application
    setTimeout(() => {
      notifications.show({
        title: '🔄 Redémarrage',
        message: 'L\'application va redémarrer pour appliquer les changements',
        color: 'blue',
        autoClose: 3000,
      });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }, 1000);
    
  } catch (err: any) {
    console.error('❌ Erreur réinitialisation:', err);
    notifications.show({
      title: '❌ Erreur',
      message: err?.message || 'Erreur inconnue lors de la réinitialisation',
      color: 'red',
    });
    setLoading(false);
  }
};
  // =====================================================
  // RECRÉER LES TABLES FINANCIÈRES
  // =====================================================

const recreateAllFinanceTables = async () => {
    setRecreating(true);
    try {
      const db = await getDb();
      
      // 1. Supprimer les tables existantes
      const dropQueries = financeTables.map(name => `DROP TABLE IF EXISTS ${name}`);
      for (const query of dropQueries) {
        try {
          await db.execute(query);
        } catch (e) {
          console.warn(`Impossible de supprimer la table: ${query}`, e);
        }
      }

      // 2. Recréer les tables avec leurs structures
      const createQueries = [
        `CREATE TABLE IF NOT EXISTS factures (
          idFacture INTEGER PRIMARY KEY AUTOINCREMENT,
          code_facture TEXT UNIQUE NOT NULL,
          idClient INTEGER NOT NULL,
          idCommande INTEGER,
          date_facture DATETIME DEFAULT CURRENT_TIMESTAMP,
          date_echeance DATE,
          montant_ht REAL DEFAULT 0,
          montant_tva REAL DEFAULT 0,
          montant_ttc REAL DEFAULT 0,
          montant_regle REAL DEFAULT 0,
          statut TEXT DEFAULT 'EN_ATTENTE',
          type_facture TEXT DEFAULT 'VENTE',
          notes TEXT
        )`,

        `CREATE TABLE IF NOT EXISTS facture_details (
          idDetailFacture INTEGER PRIMARY KEY AUTOINCREMENT,
          idFacture INTEGER NOT NULL,
          idProduit INTEGER NOT NULL,
          qte REAL NOT NULL,
          prix_unitaire REAL NOT NULL,
          FOREIGN KEY (idFacture) REFERENCES factures(idFacture) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS factures_revendeur (
          idFactureRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
          idCommande INTEGER NOT NULL,
          idRevendeur INTEGER NOT NULL,
          code_facture TEXT UNIQUE,
          date_facture DATETIME DEFAULT CURRENT_TIMESTAMP,
          montant_ht REAL DEFAULT 0,
          montant_ttc REAL DEFAULT 0,
          commission REAL DEFAULT 0,
          statut TEXT DEFAULT 'EN_ATTENTE',
          taux_commission REAL DEFAULT 60,
          FOREIGN KEY (idCommande) REFERENCES commandes(idCommande),
          FOREIGN KEY (idRevendeur) REFERENCES clients(idClient)
        )`,

        `CREATE TABLE IF NOT EXISTS factures_revendeur_details (
          idDetailFactureRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
          idFactureRevendeur INTEGER NOT NULL,
          idProduit INTEGER NOT NULL,
          qte_commande REAL NOT NULL,
          prix_achat_base REAL DEFAULT 0,
          prix_unitaire_vente REAL NOT NULL,
          FOREIGN KEY (idFactureRevendeur) REFERENCES factures_revendeur(idFactureRevendeur) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS reglements (
          idReglement INTEGER PRIMARY KEY AUTOINCREMENT,
          code_reglement TEXT UNIQUE NOT NULL,
          idClient INTEGER,
          idFacture INTEGER NOT NULL,
          idVente INTEGER,
          date_reglement DATETIME DEFAULT CURRENT_TIMESTAMP,
          montant REAL NOT NULL,
          mode_reglement TEXT,
          reference TEXT,
          banque TEXT,
          numero_cheque TEXT,
          date_valeur DATE,
          est_lettrage INTEGER DEFAULT 0,
          observation TEXT,
          idUtilisateur INTEGER,
          FOREIGN KEY (idFacture) REFERENCES factures(idFacture),
          FOREIGN KEY (idClient) REFERENCES clients(idClient)
        )`,

        `CREATE TABLE IF NOT EXISTS reglements_revendeur (
          idReglement INTEGER PRIMARY KEY AUTOINCREMENT,
          idFactureRevendeur INTEGER NOT NULL,
          idClient INTEGER NOT NULL,
          date_reglement DATETIME DEFAULT CURRENT_TIMESTAMP,
          montant REAL NOT NULL,
          mode_reglement TEXT,
          reference TEXT,
          observation TEXT,
          FOREIGN KEY (idFactureRevendeur) REFERENCES factures_revendeur(idFactureRevendeur),
          FOREIGN KEY (idClient) REFERENCES clients(idClient)
        )`,

        `CREATE TABLE IF NOT EXISTS credits (
          idCredit INTEGER PRIMARY KEY AUTOINCREMENT,
          code_credit TEXT NOT NULL UNIQUE,
          date_credit TEXT NOT NULL,
          designation TEXT NOT NULL,
          montant_total REAL NOT NULL,
          montant_restant REAL NOT NULL,
          beneficiaire TEXT NOT NULL,
          type_credit TEXT NOT NULL CHECK (type_credit IN ('CLIENT', 'FOURNISSEUR', 'AUTRE')),
          reference TEXT,
          notes TEXT,
          statut TEXT NOT NULL DEFAULT 'EN_COURS' CHECK (statut IN ('EN_COURS', 'TERMINE', 'ANNULE')),
          idJournal INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,

        `CREATE TABLE IF NOT EXISTS remboursements (
          idRemboursement INTEGER PRIMARY KEY AUTOINCREMENT,
          code_remboursement TEXT NOT NULL UNIQUE,
          date_remboursement TEXT NOT NULL,
          idCredit INTEGER NOT NULL,
          montant REAL NOT NULL,
          mode_paiement TEXT NOT NULL CHECK (mode_paiement IN ('ESPECES', 'VIREMENT', 'CHEQUE', 'MOBILE_MONEY', 'AUTRE')),
          reference_paiement TEXT,
          notes TEXT,
          idJournal INTEGER,
          created_at TEXT NOT NULL,
          FOREIGN KEY (idCredit) REFERENCES credits(idCredit) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS journal_caisse (
          idJournal INTEGER PRIMARY KEY AUTOINCREMENT,
          code_journal TEXT UNIQUE NOT NULL,
          date_journal DATETIME DEFAULT CURRENT_TIMESTAMP,
          type_mouvement TEXT NOT NULL CHECK(type_mouvement IN ('ENTREE', 'SORTIE')),
          categorie TEXT NOT NULL CHECK(categorie IN ('VENTE_COMPTOIR', 'REGLEMENT_FACTURE', 'DECOMPTE_REVENDEUR', 'CHARGE_FONCTIONNEMENT', 'AUTRE_ENTREE', 'AUTRE_SORTIE')),
          designation TEXT NOT NULL,
          montant REAL NOT NULL,
          solde_apres REAL NOT NULL,
          reference TEXT,
          idReference INTEGER,
          idUtilisateur INTEGER,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS charges_fonctionnement (
          idCharge INTEGER PRIMARY KEY AUTOINCREMENT,
          code_charge TEXT UNIQUE NOT NULL,
          date_charge DATETIME DEFAULT CURRENT_TIMESTAMP,
          designation TEXT NOT NULL,
          montant REAL NOT NULL,
          beneficiaire TEXT NOT NULL,
          categorie_charge TEXT NOT NULL CHECK(categorie_charge IN ('EAU', 'ELECTRICITE', 'LOYER', 'SALAIRE', 'TRANSPORT', 'COMMUNICATION', 'AUTRE')),
          reference_paiement TEXT,
          idJournal INTEGER,
          idUtilisateur INTEGER,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal)
        )`,

        `CREATE TABLE IF NOT EXISTS categories_charges (
          idCategorie INTEGER PRIMARY KEY AUTOINCREMENT,
          code_categorie TEXT UNIQUE NOT NULL,
          libelle TEXT NOT NULL,
          description TEXT,
          est_actif INTEGER DEFAULT 1
        )`,

        `CREATE TABLE IF NOT EXISTS recapitulatif_journalier (
          idRecap INTEGER PRIMARY KEY AUTOINCREMENT,
          date_recap DATE UNIQUE NOT NULL,
          solde_initial REAL DEFAULT 0,
          total_entrees REAL DEFAULT 0,
          total_sorties REAL DEFAULT 0,
          solde_final REAL DEFAULT 0,
          total_ventes_comptoir REAL DEFAULT 0,
          total_reglements_factures REAL DEFAULT 0,
          total_decomptes_revendeurs REAL DEFAULT 0,
          total_charges REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ];

      for (const query of createQueries) {
        try {
          await db.execute(query);
        } catch (e) {
          console.warn('Erreur création table:', query.substring(0, 50), e);
        }
      }

      // 3. Créer les index
      const indexQueries = [
        'CREATE INDEX IF NOT EXISTS idx_reglements_facture ON reglements(idFacture)',
        'CREATE INDEX IF NOT EXISTS idx_reglements_client ON reglements(idClient)',
        'CREATE INDEX IF NOT EXISTS idx_factures_client ON factures(idClient)',
        'CREATE INDEX IF NOT EXISTS idx_factures_date ON factures(date_facture)',
        'CREATE INDEX IF NOT EXISTS idx_reglements_revendeur_facture ON reglements_revendeur(idFactureRevendeur)',
        'CREATE INDEX IF NOT EXISTS idx_credits_beneficiaire ON credits(beneficiaire)',
        'CREATE INDEX IF NOT EXISTS idx_credits_statut ON credits(statut)',
        'CREATE INDEX IF NOT EXISTS idx_remboursements_idCredit ON remboursements(idCredit)',
        'CREATE INDEX IF NOT EXISTS idx_journal_caisse_date ON journal_caisse(date_journal)',
        'CREATE INDEX IF NOT EXISTS idx_charges_date ON charges_fonctionnement(date_charge)',
        'CREATE INDEX IF NOT EXISTS idx_recap_date ON recapitulatif_journalier(date_recap)'
      ];

      for (const query of indexQueries) {
        try {
          await db.execute(query);
        } catch (e) {
          console.warn('Erreur création index:', query, e);
        }
      }

      // 4. Insérer les données par défaut
      try {
        await db.execute(`
          INSERT OR IGNORE INTO categories_charges (code_categorie, libelle) VALUES
          ('EAU', 'Eau'),
          ('ELECTRICITE', 'Électricité'),
          ('LOYER', 'Loyer'),
          ('SALAIRE', 'Salaire'),
          ('TRANSPORT', 'Transport'),
          ('COMMUNICATION', 'Communication'),
          ('AUTRE', 'Autres charges')
        `);
      } catch (e) {
        console.warn('Erreur insertion catégories charges:', e);
      }

      notifications.show({
        title: '✅ Succès',
        message: 'Toutes les tables financières ont été recréées avec succès !',
        color: 'green',
      });
      
      await loadDatabaseInfo();
      setRecreateModal(false);
      
      setTimeout(() => {
        if (window.confirm('Redémarrer l\'application pour appliquer les changements ?')) {
          window.location.reload();
        }
      }, 1000);
      
    } catch (error: any) {
      notifications.show({
        title: '❌ Erreur',
        message: error?.message || 'Impossible de recréer les tables',
        color: 'red',
      });
    } finally {
      setRecreating(false);
    }
  };

  // =====================================================
  // VÉRIFICATION DE L'INTÉGRITÉ
  // =====================================================

  const checkIntegrity = async () => {
    try {
      const db = await getDb();
      const result = await db.select<{ integrity_check: string }[]>(
        'PRAGMA integrity_check'
      );
      setIntegrityOk(result[0]?.integrity_check === 'ok');

      notifications.show({
        title: result[0]?.integrity_check === 'ok' ? '✅ Intégrité OK' : '⚠️ Problème détecté',
        message: result[0]?.integrity_check === 'ok' ? 'La base est intègre' : 'Des problèmes ont été détectés',
        color: result[0]?.integrity_check === 'ok' ? 'green' : 'red',
      });
    } catch (err) {
      setIntegrityOk(false);
      notifications.show({
        title: '❌ Erreur',
        message: err instanceof Error ? err.message : 'Erreur inconnue',
        color: 'red',
      });
    }
  };

  // =====================================================
  // EXPORTER LES DONNÉES
  // =====================================================

  const exportTableData = async () => {
    if (!selectedTable) return;

    try {
      const db = await getDb();
      const data = await db.select<TableRow[]>(`SELECT * FROM ${selectedTable}`);

      if (data.length === 0) {
        notifications.show({
          title: 'ℹ️ Information',
          message: 'La table est vide',
          color: 'blue',
        });
        return;
      }

      const headers = Object.keys(data[0]);
      const csv = [
        headers.join(','),
        ...data.map(row => headers.map(h => JSON.stringify(row[h] || '')).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTable}_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      notifications.show({
        title: '✅ Succès',
        message: `${data.length} lignes exportées`,
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: '❌ Erreur',
        message: err instanceof Error ? err.message : 'Erreur inconnue',
        color: 'red',
      });
    }
  };

  // =====================================================
  // STATISTIQUES
  // =====================================================

  const totalRecords = tables.reduce((sum, t) => sum + t.rowCount, 0);
  const tablesWithData = tables.filter((t) => t.rowCount > 0).length;
  const healthScore = tables.length > 0 ? Math.round((tablesWithData / tables.length) * 100) : 0;

  // ✅ Correction : Vérifier l'existence des tables (pas le contenu)
  const existingTableNames = tables.map(t => t.name);
  const missingFinanceTables = financeTables.filter(name => !existingTableNames.includes(name));
  const hasFinanceIssues = missingFinanceTables.length > 0;

  // =====================================================
  // RENDU
  // =====================================================

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Card withBorder radius="lg" p="xl" pos="relative" style={{ minHeight: 300 }}>
          <LoadingOverlay visible={true} />
          <Center>
            <Stack align="center" gap="md">
              <IconDatabase size={48} color="gray" />
              <Text size="lg" c="dimmed">Chargement de la base de données...</Text>
            </Stack>
          </Center>
        </Card>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Alert
          icon={<IconAlertCircle size={24} />}
          title="Erreur de chargement"
          color="red"
          variant="filled"
          radius="lg"
        >
          <Text>{error}</Text>
          <Button variant="white" size="sm" mt="md" onClick={loadDatabaseInfo}>
            Réessayer
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* HEADER AVEC GRADIENT - CORRIGÉ ET ERGONOMIQUE */}
        <Paper
          p="xl"
          radius="lg"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            style={{
              position: 'absolute',
              top: -100,
              right: -100,
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'rgba(255, 215, 0, 0.05)',
            }}
          />
          <Box
            style={{
              position: 'absolute',
              bottom: -150,
              left: -50,
              width: 400,
              height: 400,
              borderRadius: '50%',
              background: 'rgba(100, 149, 237, 0.05)',
            }}
          />

          <Group justify="space-between" align="center" wrap="wrap" style={{ position: 'relative', zIndex: 1 }}>
            <Group>
              <ThemeIcon size={50} radius="lg" color="gold" variant="light" style={{ backgroundColor: 'rgba(255, 215, 0, 0.15)' }}>
                <IconDatabase size={28} />
              </ThemeIcon>
              <div>
                <Title order={2} c="white" style={{ fontSize: '1.5rem' }}>
                  Administration de la Base de Données
                </Title>
                <Group gap="xs" wrap="wrap">
                  <Badge color="gold" variant="filled" size="lg">
                    {tables.length} tables
                  </Badge>
                  <Badge color="cyan" variant="filled" size="lg">
                    {totalRecords} enregistrements
                  </Badge>
                  <Badge 
                    color={hasFinanceIssues ? "red" : "green"} 
                    variant="filled" 
                    size="lg"
                  >
                    {hasFinanceIssues ? `⚠️ ${missingFinanceTables.length} table(s) manquante(s)` : '✅ Toutes les tables sont présentes'}
                  </Badge>
                </Group>
              </div>
            </Group>
            <Group wrap="wrap" gap="xs">
              <Button
                variant="light"
                color="gray"
                leftSection={<IconRefresh size={16} />}
                onClick={loadDatabaseInfo}
                style={{ backgroundColor: 'rgba(243, 180, 7, 0.91)' }}
                size="sm"
              >
                Rafraîchir
              </Button>
              <Button
                variant="light"
                color="green"
                leftSection={<IconShieldCheck size={16} />}
                onClick={checkIntegrity}
                style={{ backgroundColor: 'rgba(11, 230, 22, 0.88)' }}
                size="sm"
              >
                Vérifier
              </Button>
              {hasFinanceIssues && (
                <Button
                  variant="filled"
                  color="red"
                  onClick={() => setRecreateModal(true)}
                  leftSection={<IconTrash size={16} />}
                  size="sm"
                >
                  🔧 Recréer les tables manquantes ({missingFinanceTables.length})
                </Button>
              )}
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Button
                    variant="light"
                    color="blue"
                    leftSection={<IconDatabaseExport size={16} />}
                    style={{ backgroundColor: 'rgba(226, 204, 6, 0.93)' }}
                    size="sm"
                  >
                    Outils
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item leftSection={<IconFileDownload size={14} />} onClick={exportTableData}>
                    Exporter table
                  </Menu.Item>
                  <Menu.Item leftSection={<IconDeviceFloppy size={14} />} onClick={openBackup}>
                    Créer un backup
                  </Menu.Item>
                  <Menu.Item leftSection={<IconFileImport size={14} />} onClick={openRestore}>
                    Restaurer un backup
                  </Menu.Item>
                  <Menu.Item leftSection={<IconSql size={14} />} onClick={openSqlQuery}>
                    Exécuter SQL
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item leftSection={<IconDatabaseImport size={14} />} color="red" onClick={openResetDb}>
                    Réinitialiser
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>

          {/* Alert si des tables manquent */}
          {hasFinanceIssues && (
            <Alert color="red" variant="light" mt="md">
              <Group>
                <IconAlertCircle size={20} />
                <Text size="sm">
                  ⚠️ {missingFinanceTables.length} table(s) financière(s) manquante(s) : 
                  <Text component="span" fw={600} c="red"> {missingFinanceTables.join(', ')}</Text>
                </Text>
              </Group>
            </Alert>
          )}
        </Paper>

        {/* INTÉGRITÉ */}
        {integrityOk !== null && (
          <Alert
            icon={integrityOk ? <IconCheck size={20} /> : <IconX size={20} />}
            title={integrityOk ? 'Intégrité parfaite' : 'Problème d\'intégrité'}
            color={integrityOk ? 'green' : 'red'}
            variant="light"
            radius="md"
          >
            {integrityOk
              ? '✅ La base de données est intègre et fonctionne correctement.'
              : '⚠️ Des problèmes d\'intégrité ont été détectés. Veuillez vérifier la base.'}
          </Alert>
        )}

        {/* STATISTIQUES AVANCÉES */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <Paper
            p="md"
            radius="md"
            style={{
              background: 'linear-gradient(135deg, #e3f2fd, #bbdefb)',
              border: '1px solid #90caf9',
            }}
          >
            <Group>
              <ThemeIcon size={40} radius="md" color="blue" variant="light">
                <IconTable size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Tables</Text>
                <Text size="xl" fw={700} c="blue">{tables.length}</Text>
              </div>
            </Group>
          </Paper>

          <Paper
            p="md"
            radius="md"
            style={{
              background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)',
              border: '1px solid #a5d6a7',
            }}
          >
            <Group>
              <ThemeIcon size={40} radius="md" color="green" variant="light">
                <IconDatabase size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Enregistrements</Text>
                <Text size="xl" fw={700} c="green">{totalRecords}</Text>
              </div>
            </Group>
          </Paper>

          <Paper
            p="md"
            radius="md"
            style={{
              background: 'linear-gradient(135deg, #f3e5f5, #e1bee7)',
              border: '1px solid #ce93d8',
            }}
          >
            <Group>
              <ThemeIcon size={40} radius="md" color="purple" variant="light">
                <IconActivity size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Tables actives</Text>
                <Text size="xl" fw={700} c="purple">{tablesWithData}</Text>
              </div>
            </Group>
          </Paper>

          <Paper
            p="md"
            radius="md"
            style={{
              background: 'linear-gradient(135deg, #fff3e0, #ffe0b2)',
              border: '1px solid #ffcc80',
            }}
          >
            <Group>
              <div style={{ position: 'relative' }}>
                <RingProgress
                  size={50}
                  thickness={5}
                  sections={[{ value: healthScore, color: healthScore > 70 ? 'green' : healthScore > 40 ? 'orange' : 'red' }]}
                  label={
                    <Text size="xs" ta="center" fw={700}>
                      {healthScore}%
                    </Text>
                  }
                />
              </div>
              <div>
                <Text size="xs" c="dimmed">Santé de la base</Text>
                <Text size="xl" fw={700} c="orange">{healthScore}%</Text>
              </div>
            </Group>
          </Paper>
        </SimpleGrid>

        {/* TABS PRINCIPAUX */}
        <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="md">
          <Tabs.List grow>
            <Tabs.Tab value="tables" leftSection={<IconTable size={16} />}>
              Tables
            </Tabs.Tab>
            <Tabs.Tab value="sql" leftSection={<IconSql size={16} />}>
              SQL Console
            </Tabs.Tab>
            <Tabs.Tab value="backup" leftSection={<IconDeviceFloppy size={16} />}>
              Sauvegardes
            </Tabs.Tab>
            <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
              Historique
            </Tabs.Tab>
          </Tabs.List>

          {/* TAB TABLES */}
          <Tabs.Panel value="tables" pt="md">
            <Card withBorder radius="lg" shadow="sm" p="lg">
              <Group justify="space-between" mb="md" wrap="wrap">
                <Group gap="xs">
                  <IconTable size={20} color="#1976d2" />
                  <Text fw={600} size="lg">Tables disponibles</Text>
                  <Badge color="blue" variant="light" size="lg">
                    {filteredTables.length}
                  </Badge>
                </Group>
                <Group gap="xs" wrap="wrap">
                  <TextInput
                    placeholder="Rechercher une table..."
                    value={tableSearchTerm}
                    onChange={(e) => setTableSearchTerm(e.target.value)}
                    leftSection={<IconSearch size={14} />}
                    size="xs"
                    style={{ width: 200 }}
                  />
                  <Tooltip label="Ajouter une colonne">
                    <ActionIcon
                      variant="gradient"
                      gradient={{ from: 'green', to: 'lime' }}
                      size="lg"
                      onClick={openAddColumn}
                    >
                      <IconPlus size={18} />
                    </ActionIcon>
                  </Tooltip>
                  {selectedRows.length > 0 && (
                    <Button
                      color="red"
                      size="xs"
                      leftSection={<IconTrash size={14} />}
                      onClick={handleDeleteSelectedRows}
                    >
                      Supprimer {selectedRows.length}
                    </Button>
                  )}
                </Group>
              </Group>
              <Divider mb="md" />

              <ScrollArea>
                <Group gap="xs" wrap="wrap" mb="md">
                  {filteredTables.map((table) => (
                    <Chip
                      key={table.name}
                      checked={selectedTable === table.name}
                      onChange={() => handleTableSelect(table.name)}
                      variant="filled"
                      color={table.rowCount > 0 ? 'blue' : 'gray'}
                      size="sm"
                    >
                      <Group gap={4}>
                        {table.name}
                        <Badge
                          size="xs"
                          color={table.rowCount > 0 ? 'green' : 'gray'}
                          variant="light"
                        >
                          {table.rowCount}
                        </Badge>
                      </Group>
                    </Chip>
                  ))}
                </Group>
              </ScrollArea>

              {/* DÉTAILS DE LA TABLE */}
              {selectedTable && columns.length > 0 && (
                <Box mt="md">
                  <Group justify="space-between" mb="md">
                    <Group>
                      <ThemeIcon size={30} radius="md" color="blue" variant="light">
                        <IconEye size={16} />
                      </ThemeIcon>
                      <Text fw={600}>
                        Table : <Text component="span" c="blue" fw={700}>{selectedTable}</Text>
                      </Text>
                      <Badge color="gray" variant="light">{columns.length} colonnes</Badge>
                      <Badge color="green" variant="light">{tableData.length} lignes</Badge>
                    </Group>
                    <Group>
                      <Button
                        variant="gradient"
                        gradient={{ from: 'green', to: 'lime' }}
                        size="xs"
                        leftSection={<IconPlus size={14} />}
                        onClick={handleAddRow}
                      >
                        Ajouter une ligne
                      </Button>
                      <Button
                        variant="subtle"
                        size="xs"
                        leftSection={showData ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                        onClick={() => setShowData(!showData)}
                      >
                        {showData ? 'Masquer' : 'Voir'} les données
                      </Button>
                      <Tooltip label="Supprimer une colonne">
                        <ActionIcon
                          variant="light"
                          color="red"
                          onClick={openDeleteColumn}
                          disabled={columns.length <= 1}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Group>
                  <Divider mb="md" />

                  <ScrollArea h={showData ? 500 : 300}>
                    <Table striped highlightOnHover withTableBorder>
                      <Table.Thead style={{ backgroundColor: '#2c3e50' }}>
                        <Table.Tr>
                          <Table.Th style={{ width: 40 }}>
                            <Checkbox
                              size="xs"
                              color="blue"
                              checked={selectedRows.length === tableData.length && tableData.length > 0}
                              onChange={() => {
                                if (selectedRows.length === tableData.length) {
                                  setSelectedRows([]);
                                } else {
                                  setSelectedRows(tableData.map((_, i) => i));
                                }
                              }}
                            />
                          </Table.Th>
                          <Table.Th style={{ width: 50 }}>
                            <Text c="white" size="xs" fw={600}>#</Text>
                          </Table.Th>
                          {columns.map((col) => (
                            <Table.Th
                              key={col.cid}
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleSort(col.name)}
                            >
                              <Group gap={4}>
                                <Text c="white" size="xs" fw={600}>{col.name}</Text>
                                {sortField === col.name && (
                                  sortDirection === 'asc' ? <IconSortAscending size={12} color="white" /> : <IconSortDescending size={12} color="white" />
                                )}
                                {col.pk === 1 && (
                                  <Badge size="xs" color="yellow" variant="filled">PK</Badge>
                                )}
                              </Group>
                            </Table.Th>
                          ))}
                          <Table.Th style={{ width: 80 }}>
                            <Text c="white" size="xs" fw={600}>Actions</Text>
                          </Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {filteredData.length > 0 ? (
                          filteredData.map((row, idx) => (
                            <Table.Tr key={idx} style={{ transition: 'background 0.2s' }}>
                              <Table.Td>
                                <Checkbox
                                  size="xs"
                                  checked={selectedRows.includes(idx)}
                                  onChange={() => {
                                    if (selectedRows.includes(idx)) {
                                      setSelectedRows(selectedRows.filter(i => i !== idx));
                                    } else {
                                      setSelectedRows([...selectedRows, idx]);
                                    }
                                  }}
                                />
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm" c="dimmed">{idx + 1}</Text>
                              </Table.Td>
                              {columns.map((col) => (
                                <Table.Td key={col.cid}>
                                  <Text size="sm" c="gray.8">
                                    {row[col.name] !== null && row[col.name] !== undefined
                                      ? String(row[col.name])
                                      : <Text component="span" c="dimmed" size="xs">NULL</Text>
                                    }
                                  </Text>
                                </Table.Td>
                              ))}
                              <Table.Td>
                                <ActionIcon
                                  variant="subtle"
                                  color="blue"
                                  size="sm"
                                  onClick={() => handleEditRow(row)}
                                >
                                  <IconEdit size={14} />
                                </ActionIcon>
                              </Table.Td>
                            </Table.Tr>
                          ))
                        ) : (
                          <Table.Tr>
                            <Table.Td colSpan={columns.length + 3}>
                              <Center py="xl">
                                <Stack align="center" gap="xs">
                                  <IconDatabase size={40} color="#adb5bd" />
                                  <Text size="lg" c="dimmed" fw={500}>
                                    Aucune donnée dans cette table
                                  </Text>
                                  <Text size="sm" c="dimmed">
                                    La table est vide ou ne contient pas de données
                                  </Text>
                                </Stack>
                              </Center>
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>

                  {filteredData.length > 0 && (
                    <Group justify="space-between" mt="md">
                      <Text size="sm" c="dimmed">
                        Affichage de {filteredData.length} lignes
                      </Text>
                      <Pagination
                        value={currentPage}
                        onChange={(page) => loadTableData(selectedTable, page)}
                        total={Math.ceil(tableData.length / itemsPerPage)}
                        size="sm"
                        color="blue"
                      />
                    </Group>
                  )}
                </Box>
              )}
            </Card>
          </Tabs.Panel>

          {/* TAB SQL CONSOLE */}
          <Tabs.Panel value="sql" pt="md">
            <Card withBorder radius="lg" shadow="sm" p="lg">
              <Group justify="space-between" mb="md">
                <Group>
                  <IconTerminal size={20} color="#1976d2" />
                  <Text fw={600} size="lg">Console SQL</Text>
                </Group>
                <Group>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => setSqlQuery('SELECT * FROM ' + selectedTable)}
                  >
                    SELECT *
                  </Button>
                  <Button
                    size="xs"
                    variant="gradient"
                    gradient={{ from: 'blue', to: 'cyan' }}
                    onClick={executeSqlQuery}
                    leftSection={<IconCode size={14} />}
                  >
                    Exécuter
                  </Button>
                </Group>
              </Group>
              <Divider mb="md" />

              <Textarea
                placeholder="-- Entrez votre requête SQL ici --"
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                minRows={6}
                maxRows={12}
                autosize
                styles={{
                  input: {
                    fontFamily: 'monospace',
                    fontSize: 13,
                    backgroundColor: '#1a1a2e',
                    color: '#00ff00',
                  },
                }}
              />

              {queryResult.length > 0 && (
                <Box mt="md">
                  <Divider label="📊 Résultat" labelPosition="center" />
                  <ScrollArea h={300} mt="md">
                    <Table striped highlightOnHover withTableBorder>
                      <Table.Thead style={{ backgroundColor: '#e3f2fd' }}>
                        <Table.Tr>
                          {Object.keys(queryResult[0]).map((key) => (
                            <Table.Th key={key} fw={600}>{key}</Table.Th>
                          ))}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {queryResult.map((row, idx) => (
                          <Table.Tr key={idx}>
                            {Object.values(row).map((val, i) => (
                              <Table.Td key={i}>
                                {val !== null && val !== undefined ? String(val) : 'NULL'}
                              </Table.Td>
                            ))}
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                  <Text size="xs" c="dimmed" mt="sm">
                    {queryResult.length} lignes retournées
                  </Text>
                </Box>
              )}
            </Card>
          </Tabs.Panel>

          {/* TAB BACKUP */}
          <Tabs.Panel value="backup" pt="md">
            <Card withBorder radius="lg" shadow="sm" p="lg">
              <Group justify="space-between" mb="md">
                <Group>
                  <IconDeviceFloppy size={20} color="#1976d2" />
                  <Text fw={600} size="lg">Sauvegardes</Text>
                  <Badge color="blue" variant="light">{backups.length}</Badge>
                </Group>
                <Button
                  variant="gradient"
                  gradient={{ from: 'green', to: 'lime' }}
                  leftSection={<IconPlus size={14} />}
                  onClick={openBackup}
                >
                  Créer une sauvegarde
                </Button>
              </Group>
              <Divider mb="md" />

              {backups.length === 0 ? (
                <Center py="xl">
                  <Stack align="center" gap="xs">
                    <IconAlertCircle size={32} color="gray" />
                    <Text c="dimmed">Aucune sauvegarde disponible</Text>
                  </Stack>
                </Center>
              ) : (
                <Table striped highlightOnHover>
                  <Table.Thead style={{ backgroundColor: '#f5f5f5' }}>
                    <Table.Tr>
                      <Table.Th>Nom</Table.Th>
                      <Table.Th>Taille</Table.Th>
                      <Table.Th>Date</Table.Th>
                      <Table.Th style={{ width: 150 }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {backups.map((backup, idx) => (
                      <Table.Tr key={idx}>
                        <Table.Td>
                          <Group gap="xs">
                            <IconFileDownload size={14} color="#1976d2" />
                            <Text size="sm" fw={500}>{backup.name}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>{(backup.size / 1024).toFixed(1)} KB</Table.Td>
                        <Table.Td>{backup.date}</Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            <Button size="xs" variant="subtle" color="green">
                              Restaurer
                            </Button>
                            <Button size="xs" variant="subtle" color="red">
                              Supprimer
                            </Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Card>
          </Tabs.Panel>

          {/* TAB HISTORY */}
          <Tabs.Panel value="history" pt="md">
            <Card withBorder radius="lg" shadow="sm" p="lg">
              <Group mb="md">
                <IconHistory size={20} color="#1976d2" />
                <Text fw={600} size="lg">Historique des requêtes</Text>
                <Badge color="blue" variant="light">{queryHistory.length}</Badge>
              </Group>
              <Divider mb="md" />

              {queryHistory.length === 0 ? (
                <Center py="xl">
                  <Stack align="center" gap="xs">
                    <IconAlertCircle size={32} color="gray" />
                    <Text c="dimmed">Aucune requête exécutée</Text>
                  </Stack>
                </Center>
              ) : (
                <Stack gap="sm">
                  {queryHistory.map((item) => (
                    <Paper
                      key={item.id}
                      withBorder
                      p="sm"
                      radius="md"
                      style={{
                        backgroundColor: item.success ? '#f1f8e9' : '#ffebee',
                        borderLeft: `4px solid ${item.success ? '#4caf50' : '#f44336'}`,
                      }}
                    >
                      <Group justify="space-between" wrap="wrap">
                        <Group gap="xs">
                          {item.success ? (
                            <ThemeIcon size="sm" color="green" radius="xl">
                              <IconCheck size={12} />
                            </ThemeIcon>
                          ) : (
                            <ThemeIcon size="sm" color="red" radius="xl">
                              <IconX size={12} />
                            </ThemeIcon>
                          )}
                          <Code block style={{ fontSize: 11, maxWidth: 400 }}>
                            {item.query}
                          </Code>
                        </Group>
                        <Group gap="xs">
                          <Badge size="xs" color="gray" variant="light">
                            ⏱️ {item.duration}ms
                          </Badge>
                          {item.success && item.rowCount > 0 && (
                            <Badge size="xs" color="blue" variant="light">
                              📊 {item.rowCount} lignes
                            </Badge>
                          )}
                          <Text size="xs" c="dimmed">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </Text>
                        </Group>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Card>
          </Tabs.Panel>
        </Tabs>

        {/* ===================================================== */}
        {/* MODALS */}
        {/* ===================================================== */}

        {/* AJOUTER UNE LIGNE */}
        <Modal
          opened={addRowOpened}
          onClose={closeAddRow}
          title={
            <Group>
              <ThemeIcon color="green" size="lg" radius="xl">
                <IconPlus size={18} />
              </ThemeIcon>
              <Text fw={600} size="lg">Ajouter une ligne</Text>
            </Group>
          }
          size="lg"
          centered
          overlayProps={{ blur: 3 }}
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Ajouter une nouvelle ligne dans la table <Text component="span" fw={600} c="blue">{selectedTable}</Text>
            </Text>
            <Divider />

            <ScrollArea h={400}>
              <Stack gap="xs">
                {columns.map((col) => (
                  <TextInput
                    key={col.cid}
                    label={col.name}
                    description={col.type + (col.pk === 1 ? ' 🔑 Clé primaire (auto-incrémentée)' : '')}
                    placeholder={`Entrez la valeur pour ${col.name}`}
                    value={newRowData[col.name] ?? ''}
                    onChange={(e) => setNewRowData({
                      ...newRowData,
                      [col.name]: e.target.value
                    })}
                    disabled={col.pk === 1}
                    withAsterisk={col.notnull === 1}
                    size="sm"
                  />
                ))}
              </Stack>
            </ScrollArea>

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeAddRow}>Annuler</Button>
              <Button
                variant="gradient"
                gradient={{ from: 'green', to: 'lime' }}
                onClick={handleSaveNewRow}
                loading={isAddingRow}
              >
                Ajouter la ligne
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* AJOUTER UNE COLONNE */}
        <Modal
          opened={addColumnOpened}
          onClose={closeAddColumn}
          title={
            <Group>
              <ThemeIcon color="green" size="lg" radius="xl">
                <IconPlus size={18} />
              </ThemeIcon>
              <Text fw={600} size="lg">Ajouter une colonne</Text>
            </Group>
          }
          size="lg"
          centered
          overlayProps={{ blur: 3 }}
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Ajouter une colonne à la table <Text component="span" fw={600} c="blue">{selectedTable}</Text>
            </Text>
            <Divider />

            <TextInput
              label="Nom de la colonne"
              placeholder="ex: nouvelle_colonne"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              required
              withAsterisk
            />

            <NativeSelect
              label="Type de données"
              value={newColumnType}
              onChange={(e) => setNewColumnType(e.target.value)}
              data={[
                'TEXT', 'INTEGER', 'REAL', 'NUMERIC', 'BLOB',
                'BOOLEAN', 'DATE', 'DATETIME'
              ]}
              withAsterisk
            />

            <TextInput
              label="Valeur par défaut"
              placeholder="ex: 'valeur' ou 0 ou NULL"
              value={newColumnDefault}
              onChange={(e) => setNewColumnDefault(e.target.value)}
            />

            <Switch
              label="NOT NULL"
              checked={newColumnNotNull}
              onChange={(e) => setNewColumnNotNull(e.currentTarget.checked)}
              color="green"
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeAddColumn}>Annuler</Button>
              <Button variant="gradient" gradient={{ from: 'green', to: 'lime' }} onClick={handleAddColumn}>
                Ajouter
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* SUPPRIMER UNE COLONNE */}
        <Modal
          opened={deleteColumnOpened}
          onClose={closeDeleteColumn}
          title={
            <Group>
              <ThemeIcon color="red" size="lg" radius="xl">
                <IconTrash size={18} />
              </ThemeIcon>
              <Text fw={600} size="lg">Supprimer une colonne</Text>
            </Group>
          }
          size="lg"
          centered
          overlayProps={{ blur: 3 }}
        >
          <Stack gap="md">
            <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
              ⚠️ Attention : La suppression d'une colonne est définitive et supprime toutes les données.
            </Alert>

            <NativeSelect
              label="Sélectionner la colonne à supprimer"
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
              data={[
                { value: '', label: 'Sélectionner...' },
                ...columns
                  .filter(col => col.pk === 0)
                  .map(col => ({ value: col.name, label: `${col.name} (${col.type})` }))
              ]}
              required
              withAsterisk
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeDeleteColumn}>Annuler</Button>
              <Button color="red" onClick={handleDeleteColumn} disabled={!selectedColumn}>
                Supprimer
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* MODIFIER UNE LIGNE */}
        <Modal
          opened={editRowOpened}
          onClose={closeEditRow}
          title={
            <Group>
              <ThemeIcon color="blue" size="lg" radius="xl">
                <IconEdit size={18} />
              </ThemeIcon>
              <Text fw={600} size="lg">Modifier la ligne</Text>
            </Group>
          }
          size="lg"
          centered
          overlayProps={{ blur: 3 }}
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Modification de la ligne dans <Text component="span" fw={600} c="blue">{selectedTable}</Text>
            </Text>
            <Divider />

            {editingRow && columns.map((col) => (
              <TextInput
                key={col.cid}
                label={col.name}
                value={editedRowData[col.name] ?? ''}
                onChange={(e) => setEditedRowData({
                  ...editedRowData,
                  [col.name]: e.target.value
                })}
                disabled={col.pk === 1}
                placeholder={col.pk === 1 ? 'Clé primaire (non modifiable)' : 'Entrez la valeur'}
              />
            ))}

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeEditRow}>Annuler</Button>
              <Button variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} onClick={handleSaveRow}>
                Sauvegarder
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* SQL CONSOLE */}
        <Modal
          opened={sqlQueryOpened}
          onClose={closeSqlQuery}
          title={
            <Group>
              <ThemeIcon color="blue" size="lg" radius="xl">
                <IconSql size={18} />
              </ThemeIcon>
              <Text fw={600} size="lg">Console SQL</Text>
            </Group>
          }
          size="xl"
          centered
          overlayProps={{ blur: 3 }}
        >
          <Stack gap="md">
            <Textarea
              placeholder="-- Entrez votre requête SQL ici --"
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              minRows={10}
              autosize
              styles={{
                input: {
                  fontFamily: 'monospace',
                  fontSize: 13,
                  backgroundColor: '#1a1a2e',
                  color: '#00ff00',
                },
              }}
            />

            <Group justify="flex-end">
              <Button variant="light" onClick={closeSqlQuery}>Fermer</Button>
              <Button variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} onClick={executeSqlQuery}>
                Exécuter
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* BACKUP */}
        <Modal
          opened={backupOpened}
          onClose={closeBackup}
          title={
            <Group>
              <ThemeIcon color="green" size="lg" radius="xl">
                <IconDeviceFloppy size={18} />
              </ThemeIcon>
              <Text fw={600} size="lg">Créer une sauvegarde</Text>
            </Group>
          }
          size="md"
          centered
          overlayProps={{ blur: 3 }}
        >
          <Stack gap="md">
            <Alert color="blue" variant="light" icon={<IconShieldCheck size={16} />}>
              Une sauvegarde complète de la base de données sera créée.
            </Alert>

            <TextInput
              label="Nom de la sauvegarde"
              placeholder={`backup_${new Date().toISOString().split('T')[0]}`}
              value={backupName}
              onChange={(e) => setBackupName(e.target.value)}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeBackup}>Annuler</Button>
              <Button variant="gradient" gradient={{ from: 'green', to: 'lime' }} onClick={createBackup}>
                Créer
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* RESTAURER */}
        <Modal
          opened={restoreOpened}
          onClose={closeRestore}
          title={
            <Group>
              <ThemeIcon color="orange" size="lg" radius="xl">
                <IconFileImport size={18} />
              </ThemeIcon>
              <Text fw={600} size="lg">Restaurer une sauvegarde</Text>
            </Group>
          }
          size="md"
          centered
          overlayProps={{ blur: 3 }}
        >
          <Stack gap="md">
            <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
              ⚠️ La restauration remplacera toutes les données actuelles.
            </Alert>

            <NativeSelect
              label="Sélectionner une sauvegarde"
              data={backups.length > 0 ? backups.map(b => b.name) : ['Aucune sauvegarde disponible']}
              disabled={backups.length === 0}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeRestore}>Annuler</Button>
              <Button color="orange" onClick={closeRestore} disabled={backups.length === 0}>
                Restaurer
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* RÉINITIALISER */}
        <Modal
          opened={resetDbOpened}
          onClose={closeResetDb}
          title={
            <Group>
              <ThemeIcon color="red" size="lg" radius="xl">
                <IconDatabaseImport size={18} />
              </ThemeIcon>
              <Text fw={600} size="lg">Réinitialiser la base de données</Text>
            </Group>
          }
          size="md"
          centered
          overlayProps={{ blur: 3 }}
        >
          <Stack gap="md">
            <Alert color="red" variant="filled" icon={<IconAlertTriangle size={16} />}>
              ⚠️ ATTENTION : Cette action est irréversible !
              <Text size="sm" mt="sm">
                Toutes les données seront perdues. La base sera recréée avec le schéma initial.
              </Text>
            </Alert>

            <TextInput
              label="Confirmer la réinitialisation"
              placeholder="Tapez 'RESET' pour confirmer"
              value={confirmReset}
              onChange={(e) => setConfirmReset(e.target.value)}
              withAsterisk
            />

            <PasswordInput
              label="Mot de passe administrateur"
              placeholder="admin123"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              withAsterisk
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeResetDb}>Annuler</Button>
              <Button
                color="red"
                onClick={handleResetDatabase}
                disabled={confirmReset !== 'RESET' || confirmPassword !== 'admin123'}
              >
                Réinitialiser
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* MODAL RECREATION TABLES FINANCIERES */}
        <Modal
          opened={recreateModal}
          onClose={() => !recreating && setRecreateModal(false)}
          title="⚠️ Recréation des tables financières"
          size="md"
          centered
          styles={{
            header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
            title: { color: 'white', fontWeight: 600 },
            body: { padding: '20px' }
          }}
        >
          <Stack gap="md">
            <Alert color="red" variant="filled">
              <Text c="white" fw={600}>⚠️ Attention !</Text>
              <Text c="white" size="sm">
                Cette action va supprimer et recréer toutes les tables financières
              </Text>
            </Alert>

            <Box>
              <Text fw={500} size="sm" mb="xs">Tables concernées :</Text>
              {financeTables.map(tableName => {
                const table = tables.find(t => t.name === tableName);
                const exists = table && table.rowCount >= 0;
                const rowCount = table?.rowCount ?? 0;
                return (
                  <Group key={tableName} gap="xs" mb={4}>
                    {exists && rowCount > 0 ? (
                      <IconCheck size={14} color="green" />
                    ) : (
                      <IconX size={14} color="red" />
                    )}
                    <Text size="sm" c={exists && rowCount > 0 ? 'dimmed' : 'red'}>
                      {tableName}
                      {exists && rowCount > 0 && ` (${rowCount} lignes)`}
                      {(!exists || rowCount === 0) && ' ❌ manquante'}
                    </Text>
                  </Group>
                );
              })}
            </Box>

            <Alert color="yellow" variant="light">
              <Text size="sm" fw={500}>🚨 Conséquences :</Text>
              <Text size="sm" c="dimmed">
                • Toutes les données financières seront supprimées
                • Les règlements, factures et crédits seront réinitialisés
                • Le journal de caisse sera vidé
              </Text>
            </Alert>

            <Alert color="blue" variant="light">
              <Text size="sm" fw={500}>✅ Après la recréation :</Text>
              <Text size="sm" c="dimmed">
                • Les catégories de charges seront réinitialisées
                • Un redémarrage de l'application sera nécessaire
              </Text>
            </Alert>

            <Group justify="flex-end">
              <Button variant="outline" onClick={() => setRecreateModal(false)} disabled={recreating}>
                Annuler
              </Button>
              <Button
                color="red"
                onClick={recreateAllFinanceTables}
                loading={recreating}
                leftSection={<IconTrash size={16} />}
              >
                Confirmer la recréation
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
};

export default DiagnosticDB;