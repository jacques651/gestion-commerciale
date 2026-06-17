// src/components/DiagnosticDB.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  Text,
  Table,
  Badge,
  Group,
  Button,
  Alert,
  Stack,
  Title,
  ThemeIcon,
  Paper,
  Divider,
  SimpleGrid,
  Loader,
  ScrollArea,
  Box,
  ActionIcon,
  Tooltip,
  Modal,
} from '@mantine/core';
import {
  IconDatabase,
  IconTable,
  IconColumns,
  IconCheck,
  IconX,
  IconRefresh,
  IconTrash,
  IconAlertCircle,
  IconFileText,
  IconReceipt,
  IconCreditCard,
  IconBuildingWarehouse,
  IconCash,
  IconMoneybag,
} from '@tabler/icons-react';
import { getDb } from '../database/db';
import { notifications } from '@mantine/notifications';

interface TableInfo {
  name: string;
}

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface TableStatus {
  name: string;
  exists: boolean;
  columns: string[];
  rowCount: number;
}

export const DiagnosticDB: React.FC = () => {
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recreateModal, setRecreateModal] = useState(false);
  const [recreating, setRecreating] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);

  const requiredTables = [
    'config_generale',
    'config_types_commerce',
    'config_modules',
    'config_commerce',
    'categories',
    'products',
    'clients',
    'commandes',
    'commande_details',
    'factures',
    'facture_details',
    'factures_revendeur',
    'factures_revendeur_details',
    'reglements',
    'reglements_revendeur',
    'ventes',
    'vente_details',
    'decomptes',
    'decompte_details',
    'credits',
    'remboursements',
    'journal_caisse',
    'charges_fonctionnement',
    'categories_charges',
    'recapitulatif_journalier',
    'stock_revendeur',
    'mouvements_stock',
    'mouvements_revendeur',
    'utilisateurs',
    'configuration_atelier'
  ];

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

  useEffect(() => {
    checkDatabase();
  }, []);

  const checkDatabase = async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await getDb();
      
      const tableList = await db.select<TableInfo[]>(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        ORDER BY name
      `);
      
      const existingTables = new Set(tableList.map(t => t.name));
      const statuses: TableStatus[] = [];
      
      for (const name of requiredTables) {
        const exists = existingTables.has(name);
        let columns: string[] = [];
        let rowCount = 0;
        
        if (exists) {
          const colInfo = await db.select<ColumnInfo[]>(`PRAGMA table_info(${name})`);
          columns = colInfo.map(c => c.name);
          
          try {
            const count = await db.select<{ count: number }[]>(`SELECT COUNT(*) as count FROM ${name}`);
            rowCount = count[0]?.count || 0;
          } catch (e) {
            rowCount = -1;
          }
        }
        
        statuses.push({ name, exists, columns, rowCount });
      }
      
      setTables(statuses);
      
    } catch (err) {
      console.error('Erreur:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const viewTableData = async (tableName: string) => {
    try {
      const db = await getDb();
      const data = await db.select<any[]>(`SELECT * FROM ${tableName} LIMIT 50`);
      setTableData(data);
      setSelectedTable(tableName);
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les données',
        color: 'red',
      });
    }
  };

  const recreateTable = async (tableName: string) => {
    if (!confirm(`Voulez-vous vraiment recréer la table "${tableName}" ? Cela supprimera toutes les données existantes.`)) {
      return;
    }

    try {
      const db = await getDb();
      
      await db.execute(`DROP TABLE IF EXISTS ${tableName}`);
      
      // Recréer selon le type
      const createQueries: Record<string, string> = {
        'reglements': `
          CREATE TABLE IF NOT EXISTS reglements (
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
            idUtilisateur INTEGER
          )
        `,
        'reglements_revendeur': `
          CREATE TABLE IF NOT EXISTS reglements_revendeur (
            idReglement INTEGER PRIMARY KEY AUTOINCREMENT,
            idFactureRevendeur INTEGER NOT NULL,
            idClient INTEGER NOT NULL,
            date_reglement DATETIME DEFAULT CURRENT_TIMESTAMP,
            montant REAL NOT NULL,
            mode_reglement TEXT,
            reference TEXT,
            observation TEXT
          )
        `,
        'factures': `
          CREATE TABLE IF NOT EXISTS factures (
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
          )
        `,
        'facture_details': `
          CREATE TABLE IF NOT EXISTS facture_details (
            idDetailFacture INTEGER PRIMARY KEY AUTOINCREMENT,
            idFacture INTEGER NOT NULL,
            idProduit INTEGER NOT NULL,
            qte REAL NOT NULL,
            prix_unitaire REAL NOT NULL
          )
        `,
        'factures_revendeur': `
          CREATE TABLE IF NOT EXISTS factures_revendeur (
            idFactureRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
            idCommande INTEGER NOT NULL,
            idRevendeur INTEGER NOT NULL,
            code_facture TEXT UNIQUE,
            date_facture DATETIME DEFAULT CURRENT_TIMESTAMP,
            montant_ht REAL DEFAULT 0,
            montant_ttc REAL DEFAULT 0,
            commission REAL DEFAULT 0,
            statut TEXT DEFAULT 'EN_ATTENTE',
            taux_commission REAL DEFAULT 60
          )
        `,
        'factures_revendeur_details': `
          CREATE TABLE IF NOT EXISTS factures_revendeur_details (
            idDetailFactureRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
            idFactureRevendeur INTEGER NOT NULL,
            idProduit INTEGER NOT NULL,
            qte_commande REAL NOT NULL,
            prix_achat_base REAL DEFAULT 0,
            prix_unitaire_vente REAL NOT NULL
          )
        `,
        'credits': `
          CREATE TABLE IF NOT EXISTS credits (
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
          )
        `,
        'remboursements': `
          CREATE TABLE IF NOT EXISTS remboursements (
            idRemboursement INTEGER PRIMARY KEY AUTOINCREMENT,
            code_remboursement TEXT NOT NULL UNIQUE,
            date_remboursement TEXT NOT NULL,
            idCredit INTEGER NOT NULL,
            montant REAL NOT NULL,
            mode_paiement TEXT NOT NULL CHECK (mode_paiement IN ('ESPECES', 'VIREMENT', 'CHEQUE', 'MOBILE_MONEY', 'AUTRE')),
            reference_paiement TEXT,
            notes TEXT,
            idJournal INTEGER,
            created_at TEXT NOT NULL
          )
        `,
        'journal_caisse': `
          CREATE TABLE IF NOT EXISTS journal_caisse (
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
          )
        `,
        'charges_fonctionnement': `
          CREATE TABLE IF NOT EXISTS charges_fonctionnement (
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `,
        'recapitulatif_journalier': `
          CREATE TABLE IF NOT EXISTS recapitulatif_journalier (
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
          )
        `
      };

      if (createQueries[tableName]) {
        await db.execute(createQueries[tableName]);
      }

      // Créer les index
      const indexQueries: Record<string, string[]> = {
        'reglements': [
          'CREATE INDEX IF NOT EXISTS idx_reglements_facture ON reglements(idFacture)',
          'CREATE INDEX IF NOT EXISTS idx_reglements_client ON reglements(idClient)'
        ],
        'reglements_revendeur': [
          'CREATE INDEX IF NOT EXISTS idx_reglements_revendeur_facture ON reglements_revendeur(idFactureRevendeur)'
        ],
        'factures': [
          'CREATE INDEX IF NOT EXISTS idx_factures_client ON factures(idClient)',
          'CREATE INDEX IF NOT EXISTS idx_factures_date ON factures(date_facture)'
        ],
        'credits': [
          'CREATE INDEX IF NOT EXISTS idx_credits_beneficiaire ON credits(beneficiaire)',
          'CREATE INDEX IF NOT EXISTS idx_credits_statut ON credits(statut)'
        ],
        'remboursements': [
          'CREATE INDEX IF NOT EXISTS idx_remboursements_idCredit ON remboursements(idCredit)'
        ],
        'journal_caisse': [
          'CREATE INDEX IF NOT EXISTS idx_journal_caisse_date ON journal_caisse(date_journal)'
        ],
        'charges_fonctionnement': [
          'CREATE INDEX IF NOT EXISTS idx_charges_date ON charges_fonctionnement(date_charge)'
        ],
        'recapitulatif_journalier': [
          'CREATE INDEX IF NOT EXISTS idx_recap_date ON recapitulatif_journalier(date_recap)'
        ]
      };

      if (indexQueries[tableName]) {
        for (const query of indexQueries[tableName]) {
          await db.execute(query);
        }
      }

      notifications.show({
        title: '✅ Succès',
        message: `Table "${tableName}" recréée avec succès`,
        color: 'green',
      });
      
      await checkDatabase();
      
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: `Impossible de recréer la table "${tableName}"`,
        color: 'red',
      });
    }
  };

  const recreateAllFinanceTables = async () => {
    if (!confirm('⚠️ Voulez-vous vraiment recréer TOUTES les tables financières ? Cela supprimera toutes les données existantes (règlements, factures, crédits, etc.)')) {
      return;
    }

    setRecreating(true);
    try {
      const db = await getDb();
      
      // Supprimer toutes les tables financières
      for (const tableName of financeTables) {
        try {
          await db.execute(`DROP TABLE IF EXISTS ${tableName}`);
        } catch (e) {}
      }
      
      // Recréer toutes les tables avec leurs index
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
          prix_unitaire REAL NOT NULL
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
          taux_commission REAL DEFAULT 60
        )`,

        `CREATE TABLE IF NOT EXISTS factures_revendeur_details (
          idDetailFactureRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
          idFactureRevendeur INTEGER NOT NULL,
          idProduit INTEGER NOT NULL,
          qte_commande REAL NOT NULL,
          prix_achat_base REAL DEFAULT 0,
          prix_unitaire_vente REAL NOT NULL
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
          idUtilisateur INTEGER
        )`,

        `CREATE TABLE IF NOT EXISTS reglements_revendeur (
          idReglement INTEGER PRIMARY KEY AUTOINCREMENT,
          idFactureRevendeur INTEGER NOT NULL,
          idClient INTEGER NOT NULL,
          date_reglement DATETIME DEFAULT CURRENT_TIMESTAMP,
          montant REAL NOT NULL,
          mode_reglement TEXT,
          reference TEXT,
          observation TEXT
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
          created_at TEXT NOT NULL
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
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
        await db.execute(query);
      }

      // Créer tous les index
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
        await db.execute(query);
      }

      // Insérer les catégories de charges par défaut
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

      notifications.show({
        title: '✅ Succès',
        message: 'Toutes les tables financières ont été recréées avec succès !',
        color: 'green',
      });
      
      await checkDatabase();
      setRecreateModal(false);
      
      // Proposer un redémarrage
      setTimeout(() => {
        if (window.confirm('Redémarrer l\'application pour appliquer les changements ?')) {
          window.location.reload();
        }
      }, 1000);
      
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de recréer les tables',
        color: 'red',
      });
    } finally {
      setRecreating(false);
    }
  };

  if (loading) {
    return (
      <Card withBorder p="xl" ta="center">
        <Loader size="xl" />
        <Text mt="md">Analyse de la base de données...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert color="red" title="Erreur" icon={<IconAlertCircle size={16} />}>
        {error}
      </Alert>
    );
  }

  const financeMissing = tables.filter(t => financeTables.includes(t.name) && !t.exists);
  const hasFinanceIssues = financeMissing.length > 0;

  return (
    <Stack gap="lg">
      <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
        <Group justify="space-between">
          <Group>
            <ThemeIcon size={50} radius="md" color="white" variant="light">
              <IconDatabase size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white">Diagnostic de la Base de Données</Title>
              <Text c="gray.3" size="sm">
                Vérification de l'intégrité des tables et des données
              </Text>
            </div>
          </Group>
          <Group>
            <Tooltip label="Actualiser">
              <ActionIcon variant="light" color="white" onClick={checkDatabase} size="lg">
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Button
              variant={hasFinanceIssues ? "filled" : "light"}
              color={hasFinanceIssues ? "red" : "gray"}
              onClick={() => setRecreateModal(true)}
              leftSection={<IconTrash size={16} />}
            >
              {hasFinanceIssues ? `⚠️ ${financeMissing.length} table(s) manquante(s)` : "Recréer les tables financières"}
            </Button>
          </Group>
        </Group>

        {hasFinanceIssues && (
          <Alert color="red" variant="light" mt="md">
            <Group>
              <IconAlertCircle size={20} />
              <Text>
                ⚠️ {financeMissing.length} table(s) financière(s) manquante(s) : {financeMissing.map(t => t.name).join(', ')}
              </Text>
            </Group>
          </Alert>
        )}
      </Paper>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group gap="xs" mb="md">
            <IconTable size={20} color="#1b365d" />
            <Title order={4}>Tables existantes</Title>
          </Group>
          <ScrollArea h={400}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Table</Table.Th>
                  <Table.Th>Statut</Table.Th>
                  <Table.Th>Lignes</Table.Th>
                  <Table.Th>Colonnes</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tables.map((table) => (
                  <Table.Tr key={table.name}>
                    <Table.Td>
                      <Group gap="xs">
                        {table.name.includes('reglement') && <IconReceipt size={16} color="blue" />}
                        {table.name.includes('facture') && <IconFileText size={16} color="teal" />}
                        {table.name.includes('credit') && <IconCreditCard size={16} color="violet" />}
                        {table.name.includes('stock') && <IconBuildingWarehouse size={16} color="orange" />}
                        {table.name.includes('caisse') && <IconCash size={16} color="green" />}
                        {table.name.includes('charge') && <IconMoneybag size={16} color="red" />}
                        <Text size="sm" fw={500}>{table.name}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {table.exists ? (
                        <Badge color="green" variant="light">✅ Existe</Badge>
                      ) : (
                        <Badge color="red" variant="light">❌ Manquante</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {table.exists && table.rowCount >= 0 ? (
                        <Text size="sm">{table.rowCount}</Text>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed">{table.columns.length}</Text>
                        {table.exists && (
                          <Tooltip label={`Colonnes: ${table.columns.join(', ')}`}>
                            <ActionIcon size="sm" variant="subtle" onClick={() => viewTableData(table.name)}>
                              <IconColumns size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {table.exists && financeTables.includes(table.name) && (
                          <Tooltip label="Recréer cette table">
                            <ActionIcon size="sm" color="red" variant="subtle" onClick={() => recreateTable(table.name)}>
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Card>

        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group gap="xs" mb="md">
            <IconFileText size={20} color="#1b365d" />
            <Title order={4}>Résumé</Title>
          </Group>
          <Stack gap="sm">
            <SimpleGrid cols={2} spacing="sm">
              <Paper withBorder p="sm" radius="md" bg="green.0">
                <Text size="xs" c="dimmed">Tables existantes</Text>
                <Text fw={700} size="xl">{tables.filter(t => t.exists).length}</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md" bg="red.0">
                <Text size="xs" c="dimmed">Tables manquantes</Text>
                <Text fw={700} size="xl" c="red">{tables.filter(t => !t.exists).length}</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md" bg="blue.0">
                <Text size="xs" c="dimmed">Tables financières</Text>
                <Text fw={700} size="xl">{tables.filter(t => financeTables.includes(t.name) && t.exists).length}/{financeTables.length}</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md" bg="gray.0">
                <Text size="xs" c="dimmed">Total colonnes</Text>
                <Text fw={700} size="xl">{tables.reduce((acc, t) => acc + t.columns.length, 0)}</Text>
              </Paper>
            </SimpleGrid>

            <Divider />

            <Box>
              <Text fw={600} size="sm" mb="xs">Statut des tables financières</Text>
              {financeTables.map(tableName => {
                const table = tables.find(t => t.name === tableName);
                return (
                  <Group key={tableName} gap="xs" mb={4}>
                    {table?.exists ? (
                      <IconCheck size={14} color="green" />
                    ) : (
                      <IconX size={14} color="red" />
                    )}
                    <Text size="xs" c={table?.exists ? 'dimmed' : 'red'}>
                      {tableName}
                      {!table?.exists && ' ❌'}
                    </Text>
                    {table?.exists && table.rowCount > 0 && (
                      <Text size="xs" c="dimmed">({table.rowCount} lignes)</Text>
                    )}
                  </Group>
                );
              })}
            </Box>

            {hasFinanceIssues && (
              <Alert color="red" variant="light" mt="md">
                <Text fw={600} size="sm">⚠️ Problème détecté</Text>
                <Text size="sm" c="dimmed">
                  Des tables financières sont manquantes. Cliquez sur "Recréer les tables financières" pour les reconstruire.
                </Text>
              </Alert>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      {/* Modal de confirmation pour recréer toutes les tables */}
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
              return (
                <Group key={tableName} gap="xs" mb={4}>
                  {table?.exists ? (
                    <IconCheck size={14} color="green" />
                  ) : (
                    <IconX size={14} color="red" />
                  )}
                  <Text size="sm" c={table?.exists ? 'dimmed' : 'red'}>
                    {tableName}
                    {table?.exists && table.rowCount > 0 && ` (${table.rowCount} lignes)`}
                    {!table?.exists && ' ❌ manquante'}
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

      {/* Modal pour voir les données d'une table */}
      <Modal
        opened={!!selectedTable}
        onClose={() => {
          setSelectedTable(null);
          setTableData([]);
        }}
        title={`Données de la table "${selectedTable}"`}
        size="xl"
        centered
      >
        <ScrollArea h={400}>
          {tableData.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">Aucune donnée dans cette table</Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  {Object.keys(tableData[0] || {}).map(key => (
                    <Table.Th key={key}>{key}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tableData.map((row, index) => (
                  <Table.Tr key={index}>
                    {Object.values(row).map((value: any, idx) => (
                      <Table.Td key={idx}>
                        <Text size="xs" lineClamp={2}>
                          {value !== null && value !== undefined ? String(value) : '-'}
                        </Text>
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </ScrollArea>
        <Divider my="md" />
        <Group justify="flex-end">
          <Text size="xs" c="dimmed">{tableData.length} ligne(s)</Text>
          <Button variant="light" onClick={() => {
            setSelectedTable(null);
            setTableData([]);
          }}>
            Fermer
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
};

export default DiagnosticDB;