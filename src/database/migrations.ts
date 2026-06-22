// src/database/migrations.ts

import { getDb } from './db';
import { DatabaseVersionManager } from './versionManager';
import { BackupManager } from './backupManager';

type MigrationFunction = (db: any) => Promise<void>;

interface Migration {
  version: number;
  name: string;
  description: string;
  up: MigrationFunction;
  down?: MigrationFunction;
}

export const MIGRATIONS: Migration[] = [
  // =====================================================
  // VERSION 1: Tables de base
  // =====================================================
  {
    version: 1,
    name: 'Create initial tables',
    description: 'Création des tables de base (utilisateurs, clients, produits)',
    up: async (db) => {
      console.log('📦 Migration v1: Création des tables de base');
      
      const tables = await db.select(`SELECT name FROM sqlite_master WHERE type='table'`);
      const tableNames = (tables as any[]).map((t: any) => t.name);
      
      // 1. Créer la table utilisateurs (conforme au schéma)
      if (!tableNames.includes('utilisateurs')) {
        await db.execute(`
          CREATE TABLE utilisateurs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            prenom TEXT,
            login TEXT NOT NULL UNIQUE,
            mot_de_passe_hash TEXT NOT NULL,
            email TEXT,
            role TEXT NOT NULL DEFAULT 'COMMERCIAL',
            permissions TEXT DEFAULT '{}',
            est_actif INTEGER DEFAULT 1,
            derniere_connexion DATETIME,
            date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('✅ Table utilisateurs créée');
      }

      // 2. Créer la table clients
      if (!tableNames.includes('clients')) {
        await db.execute(`
          CREATE TABLE clients (
            idClient INTEGER PRIMARY KEY AUTOINCREMENT,
            NomComplet TEXT NOT NULL,
            Societe TEXT,
            Adresse TEXT,
            Tel TEXT,
            Email TEXT,
            Ville TEXT,
            TypeClient TEXT NOT NULL CHECK(TypeClient IN ('client', 'revendeur'))
          )
        `);
        console.log('✅ Table clients créée');
      }

      // 3. Créer la table products
      if (!tableNames.includes('products')) {
        await db.execute(`
          CREATE TABLE products (
            idProduit INTEGER PRIMARY KEY AUTOINCREMENT,
            code_produit TEXT UNIQUE NOT NULL,
            designation TEXT NOT NULL,
            categorie TEXT,
            unite_base TEXT DEFAULT 'pièce',
            prix_achat_base REAL DEFAULT 0,
            prix_vente_detail REAL DEFAULT 0,
            prix_vente_gros REAL DEFAULT 0,
            commission_pourcentage REAL DEFAULT 0,
            qte_stock REAL DEFAULT 0,
            seuil_alerte REAL DEFAULT 10,
            prix_moyen_pondere REAL DEFAULT 0,
            methode_gestion_stock TEXT DEFAULT 'FIFO',
            idUniteStockage INTEGER,
            date_entree DATETIME DEFAULT CURRENT_TIMESTAMP,
            est_supprime INTEGER DEFAULT 0
          )
        `);
        console.log('✅ Table products créée');
      }

      // 4. Créer la table unites
      if (!tableNames.includes('unites')) {
        await db.execute(`
          CREATE TABLE unites (
            idUnite INTEGER PRIMARY KEY AUTOINCREMENT,
            code_unite TEXT UNIQUE NOT NULL,
            nom_unite TEXT NOT NULL,
            symbole TEXT,
            categorie_unite TEXT DEFAULT 'QUANTITE',
            est_unite_base INTEGER DEFAULT 0,
            facteur_conversion REAL DEFAULT 1,
            unite_reference_id INTEGER
          )
        `);
        console.log('✅ Table unites créée');
      }

      // 5. Créer la table config_generale
      if (!tableNames.includes('config_generale')) {
        await db.execute(`
          CREATE TABLE config_generale (
            id_config INTEGER PRIMARY KEY CHECK (id_config = 1),
            nom_application TEXT DEFAULT 'Gestion Commerciale',
            version TEXT DEFAULT '3.0.0',
            devise TEXT DEFAULT 'FCFA',
            symbole_devise TEXT DEFAULT 'CFA',
            taux_tva_default REAL DEFAULT 18,
            date_format TEXT DEFAULT 'DD/MM/YYYY',
            nombre_decimales INTEGER DEFAULT 2,
            separateur_milliers TEXT DEFAULT ' ',
            theme TEXT DEFAULT 'light',
            langue TEXT DEFAULT 'fr',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('✅ Table config_generale créée');
      }
    }
  },

  // =====================================================
  // VERSION 2: Tables des commandes et factures
  // =====================================================
  {
    version: 2,
    name: 'Create commandes and factures tables',
    description: 'Création des tables de commandes et factures',
    up: async (db) => {
      console.log('📦 Migration v2: Création des tables de commandes et factures');
      
      const tables = await db.select(`SELECT name FROM sqlite_master WHERE type='table'`);
      const tableNames = (tables as any[]).map((t: any) => t.name);

      // 1. Table commandes
      if (!tableNames.includes('commandes')) {
        await db.execute(`
          CREATE TABLE commandes (
            idCommande INTEGER PRIMARY KEY AUTOINCREMENT,
            code_commande TEXT UNIQUE NOT NULL,
            idClient INTEGER NOT NULL,
            type_commande TEXT NOT NULL,
            date_commande DATETIME DEFAULT CURRENT_TIMESTAMP,
            adresse_livraison TEXT,
            montant_ht REAL DEFAULT 0,
            montant_tva REAL DEFAULT 0,
            montant_ttc REAL DEFAULT 0,
            montant_remise REAL DEFAULT 0,
            montant_net REAL DEFAULT 0,
            statut TEXT DEFAULT 'BROUILLON',
            source TEXT DEFAULT 'DIRECT',
            notes TEXT,
            signature_base64 TEXT,
            code_facture TEXT,
            date_facture DATE,
            FOREIGN KEY (idClient) REFERENCES clients(idClient)
          )
        `);
        console.log('✅ Table commandes créée');
      }

      // 2. Table commande_details
      if (!tableNames.includes('commande_details')) {
        await db.execute(`
          CREATE TABLE commande_details (
            idDetail INTEGER PRIMARY KEY AUTOINCREMENT,
            idCommande INTEGER NOT NULL,
            idProduit INTEGER NOT NULL,
            idConditionnement INTEGER,
            qte_commande REAL NOT NULL,
            prix_unitaire_vente REAL NOT NULL,
            remise REAL DEFAULT 0,
            FOREIGN KEY (idCommande) REFERENCES commandes(idCommande) ON DELETE CASCADE,
            FOREIGN KEY (idProduit) REFERENCES products(idProduit)
          )
        `);
        console.log('✅ Table commande_details créée');
      }

      // 3. Table factures
      if (!tableNames.includes('factures')) {
        await db.execute(`
          CREATE TABLE factures (
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
            notes TEXT,
            FOREIGN KEY (idClient) REFERENCES clients(idClient),
            FOREIGN KEY (idCommande) REFERENCES commandes(idCommande)
          )
        `);
        console.log('✅ Table factures créée');
      }

      // 4. Table facture_details
      if (!tableNames.includes('facture_details')) {
        await db.execute(`
          CREATE TABLE facture_details (
            idDetailFacture INTEGER PRIMARY KEY AUTOINCREMENT,
            idFacture INTEGER NOT NULL,
            idProduit INTEGER NOT NULL,
            qte REAL NOT NULL,
            prix_unitaire REAL NOT NULL,
            FOREIGN KEY (idFacture) REFERENCES factures(idFacture) ON DELETE CASCADE,
            FOREIGN KEY (idProduit) REFERENCES products(idProduit)
          )
        `);
        console.log('✅ Table facture_details créée');
      }

      // 5. Table ventes
      if (!tableNames.includes('ventes')) {
        await db.execute(`
          CREATE TABLE ventes (
            idVente INTEGER PRIMARY KEY AUTOINCREMENT,
            code_vente TEXT UNIQUE NOT NULL,
            idClient INTEGER,
            nom_prenom TEXT,
            contact TEXT,
            date_vente DATETIME DEFAULT CURRENT_TIMESTAMP,
            montant_ht REAL DEFAULT 0,
            montant_tva REAL DEFAULT 0,
            montant_ttc REAL DEFAULT 0,
            type_vente TEXT DEFAULT 'COMPTOIR',
            observation TEXT,
            FOREIGN KEY (idClient) REFERENCES clients(idClient)
          )
        `);
        console.log('✅ Table ventes créée');
      }

      // 6. Table vente_details
      if (!tableNames.includes('vente_details')) {
        await db.execute(`
          CREATE TABLE vente_details (
            idDetail INTEGER PRIMARY KEY AUTOINCREMENT,
            idVente INTEGER NOT NULL,
            idProduit INTEGER NOT NULL,
            quantite REAL NOT NULL,
            prix_unitaire_ht REAL NOT NULL,
            prix_unitaire_ttc REAL NOT NULL,
            remise_percent REAL DEFAULT 0,
            tva_taux REAL DEFAULT 18,
            FOREIGN KEY (idVente) REFERENCES ventes(idVente) ON DELETE CASCADE,
            FOREIGN KEY (idProduit) REFERENCES products(idProduit)
          )
        `);
        console.log('✅ Table vente_details créée');
      }
    }
  },

  // =====================================================
  // VERSION 3: Tables des décomptes et revendeurs
  // =====================================================
  {
    version: 3,
    name: 'Create decomptes and revendeurs tables',
    description: 'Création des tables des décomptes et revendeurs',
    up: async (db) => {
      console.log('📦 Migration v3: Création des tables des décomptes et revendeurs');
      
      const tables = await db.select(`SELECT name FROM sqlite_master WHERE type='table'`);
      const tableNames = (tables as any[]).map((t: any) => t.name);

      // 1. Table decomptes
      if (!tableNames.includes('decomptes')) {
        await db.execute(`
          CREATE TABLE decomptes (
            idDecompte INTEGER PRIMARY KEY AUTOINCREMENT,
            idClient INTEGER NOT NULL,
            code_decompte TEXT UNIQUE,
            date_decompte DATETIME DEFAULT CURRENT_TIMESTAMP,
            montant_achat REAL DEFAULT 0,
            montant_vente REAL DEFAULT 0,
            montant_benefice REAL DEFAULT 0,
            montant_commission REAL DEFAULT 0,
            montant_net REAL DEFAULT 0,
            statut TEXT DEFAULT 'brouillon',
            observation TEXT,
            periode_debut TEXT,
            periode_fin TEXT,
            notes TEXT,
            taux_commission REAL DEFAULT 60,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (idClient) REFERENCES clients(idClient)
          )
        `);
        console.log('✅ Table decomptes créée');
      }

      // 2. Table decompte_details
      if (!tableNames.includes('decompte_details')) {
        await db.execute(`
          CREATE TABLE decompte_details (
            idDetailRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
            idDecompte INTEGER NOT NULL,
            idProduit INTEGER NOT NULL,
            qte_decompte REAL NOT NULL DEFAULT 0,
            prix_achat REAL DEFAULT 0,
            prix_vente REAL DEFAULT 0,
            commission_pourcentage REAL DEFAULT 0,
            designation TEXT,
            total REAL DEFAULT 0,
            FOREIGN KEY (idDecompte) REFERENCES decomptes(idDecompte) ON DELETE CASCADE,
            FOREIGN KEY (idProduit) REFERENCES products(idProduit)
          )
        `);
        console.log('✅ Table decompte_details créée');
      }

      // 3. Table stock_revendeur
      if (!tableNames.includes('stock_revendeur')) {
        await db.execute(`
          CREATE TABLE stock_revendeur (
            idStockRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
            idProduit INTEGER NOT NULL,
            idRevendeur INTEGER NOT NULL,
            qte_stock REAL DEFAULT 0,
            prix_achat REAL DEFAULT 0,
            prix_vente REAL DEFAULT 0,
            commission_pourcentage REAL DEFAULT 0,
            UNIQUE(idProduit, idRevendeur)
          )
        `);
        console.log('✅ Table stock_revendeur créée');
      }

      // 4. Table factures_revendeur
      if (!tableNames.includes('factures_revendeur')) {
        await db.execute(`
          CREATE TABLE factures_revendeur (
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
          )
        `);
        console.log('✅ Table factures_revendeur créée');
      }

      // 5. Table mouvements_revendeur
      if (!tableNames.includes('mouvements_revendeur')) {
        await db.execute(`
          CREATE TABLE mouvements_revendeur (
            idMouvementRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
            idProduit INTEGER NOT NULL,
            idRevendeur INTEGER NOT NULL,
            idCommande INTEGER,
            idDecompte INTEGER,
            type_mouvement TEXT NOT NULL,
            qte_mouvement REAL NOT NULL,
            date_mouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (idProduit) REFERENCES products(idProduit),
            FOREIGN KEY (idRevendeur) REFERENCES clients(idClient),
            FOREIGN KEY (idCommande) REFERENCES commandes(idCommande),
            FOREIGN KEY (idDecompte) REFERENCES decomptes(idDecompte)
          )
        `);
        console.log('✅ Table mouvements_revendeur créée');
      }

      // 6. Table mouvements_stock
      if (!tableNames.includes('mouvements_stock')) {
        await db.execute(`
          CREATE TABLE mouvements_stock (
            idMouvement INTEGER PRIMARY KEY AUTOINCREMENT,
            idProduit INTEGER NOT NULL,
            type_mouvement TEXT NOT NULL,
            quantite REAL NOT NULL,
            stock_avant REAL NOT NULL,
            stock_apres REAL NOT NULL,
            prix_unitaire REAL,
            reference TEXT,
            notes TEXT,
            date_mouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
            idCommande INTEGER,
            idLot INTEGER,
            FOREIGN KEY (idProduit) REFERENCES products(idProduit)
          )
        `);
        console.log('✅ Table mouvements_stock créée');
      }
    }
  },

  // =====================================================
  // VERSION 4: Tables financières
  // =====================================================
  {
    version: 4,
    name: 'Create financial tables',
    description: 'Création des tables financières (journal, crédits, remboursements)',
    up: async (db) => {
      console.log('📦 Migration v4: Création des tables financières');
      
      const tables = await db.select(`SELECT name FROM sqlite_master WHERE type='table'`);
      const tableNames = (tables as any[]).map((t: any) => t.name);

      // 1. Table journal_caisse
      if (!tableNames.includes('journal_caisse')) {
        await db.execute(`
          CREATE TABLE journal_caisse (
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
          )
        `);
        console.log('✅ Table journal_caisse créée');
      }

      // 2. Table charges_fonctionnement
      if (!tableNames.includes('charges_fonctionnement')) {
        await db.execute(`
          CREATE TABLE charges_fonctionnement (
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
            FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal),
            FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
          )
        `);
        console.log('✅ Table charges_fonctionnement créée');
      }

      // 3. Table categories_charges
      if (!tableNames.includes('categories_charges')) {
        await db.execute(`
          CREATE TABLE categories_charges (
            idCategorie INTEGER PRIMARY KEY AUTOINCREMENT,
            code_categorie TEXT UNIQUE NOT NULL,
            libelle TEXT NOT NULL,
            description TEXT,
            est_actif INTEGER DEFAULT 1
          )
        `);
        
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
        console.log('✅ Table categories_charges créée avec les données initiales');
      }

      // 4. Table credits
      if (!tableNames.includes('credits')) {
        await db.execute(`
          CREATE TABLE credits (
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
            updated_at TEXT NOT NULL,
            FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal)
          )
        `);
        console.log('✅ Table credits créée');
      }

      // 5. Table remboursements
      if (!tableNames.includes('remboursements')) {
        await db.execute(`
          CREATE TABLE remboursements (
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
            FOREIGN KEY (idCredit) REFERENCES credits(idCredit) ON DELETE CASCADE,
            FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal)
          )
        `);
        console.log('✅ Table remboursements créée');
      }

      // 6. Table reglements
      if (!tableNames.includes('reglements')) {
        await db.execute(`
          CREATE TABLE reglements (
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
            FOREIGN KEY (idClient) REFERENCES clients(idClient),
            FOREIGN KEY (idFacture) REFERENCES factures(idFacture),
            FOREIGN KEY (idVente) REFERENCES ventes(idVente)
          )
        `);
        console.log('✅ Table reglements créée');
      }

      // 7. Table reglements_revendeur
      if (!tableNames.includes('reglements_revendeur')) {
        await db.execute(`
          CREATE TABLE reglements_revendeur (
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
          )
        `);
        console.log('✅ Table reglements_revendeur créée');
      }

      // 8. Table recapitulatif_journalier
      if (!tableNames.includes('recapitulatif_journalier')) {
        await db.execute(`
          CREATE TABLE recapitulatif_journalier (
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
        `);
        console.log('✅ Table recapitulatif_journalier créée');
      }
    }
  },

  // =====================================================
  // VERSION 5: Index et contraintes
  // =====================================================
  {
    version: 5,
    name: 'Add indexes and constraints',
    description: 'Ajout des index et contraintes pour optimiser les performances',
    up: async (db) => {
      console.log('📦 Migration v5: Ajout des index et contraintes');

      // Index pour utilisateurs
      try {
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_utilisateurs_login ON utilisateurs(login)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_utilisateurs_role ON utilisateurs(role)`);
        console.log('✅ Index utilisateurs créés');
      } catch (e) {
        console.warn('⚠️ Index utilisateurs déjà existants');
      }

      // Index pour clients
      try {
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(TypeClient)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_clients_nom ON clients(NomComplet)`);
        console.log('✅ Index clients créés');
      } catch (e) {
        console.warn('⚠️ Index clients déjà existants');
      }

      // Index pour products
      try {
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_products_code ON products(code_produit)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_products_categorie ON products(categorie)`);
        console.log('✅ Index products créés');
      } catch (e) {
        console.warn('⚠️ Index products déjà existants');
      }

      // Index pour commandes
      try {
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_commandes_client ON commandes(idClient)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_commandes_date ON commandes(date_commande)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_commandes_statut ON commandes(statut)`);
        console.log('✅ Index commandes créés');
      } catch (e) {
        console.warn('⚠️ Index commandes déjà existants');
      }

      // Index pour decomptes
      try {
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_decomptes_client ON decomptes(idClient)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_decomptes_date ON decomptes(date_decompte)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_decomptes_statut ON decomptes(statut)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_decomptes_code ON decomptes(code_decompte)`);
        console.log('✅ Index decomptes créés');
      } catch (e) {
        console.warn('⚠️ Index decomptes déjà existants');
      }

      // Index pour journal_caisse
      try {
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_journal_caisse_date ON journal_caisse(date_journal)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_journal_caisse_type ON journal_caisse(type_mouvement)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_journal_caisse_categorie ON journal_caisse(categorie)`);
        console.log('✅ Index journal_caisse créés');
      } catch (e) {
        console.warn('⚠️ Index journal_caisse déjà existants');
      }

      // Index pour factures
      try {
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_factures_client ON factures(idClient)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_factures_date ON factures(date_facture)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_factures_statut ON factures(statut)`);
        console.log('✅ Index factures créés');
      } catch (e) {
        console.warn('⚠️ Index factures déjà existants');
      }

      // Index pour credits
      try {
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_credits_beneficiaire ON credits(beneficiaire)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_credits_statut ON credits(statut)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_credits_date ON credits(date_credit)`);
        console.log('✅ Index credits créés');
      } catch (e) {
        console.warn('⚠️ Index credits déjà existants');
      }

      // Index pour remboursements
      try {
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_remboursements_idCredit ON remboursements(idCredit)`);
        console.log('✅ Index remboursements créés');
      } catch (e) {
        console.warn('⚠️ Index remboursements déjà existants');
      }

      // Index pour stock_revendeur
      try {
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_stock_revendeur_revendeur ON stock_revendeur(idRevendeur)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_stock_revendeur_produit ON stock_revendeur(idProduit)`);
        console.log('✅ Index stock_revendeur créés');
      } catch (e) {
        console.warn('⚠️ Index stock_revendeur déjà existants');
      }
    }
  },

  // =====================================================
  // VERSION 6: Ajout de la colonne permissions à utilisateurs
  // =====================================================
  {
    version: 6,
    name: 'Add permissions column to utilisateurs',
    description: 'Ajout de la colonne permissions dans la table utilisateurs',
    up: async (db) => {
      console.log('📦 Migration v6: Ajout de la colonne permissions');
      
      try {
        const tableInfo = await db.select(`PRAGMA table_info(utilisateurs)`);
        const columns = (tableInfo as any[]).map((col: any) => col.name);
        
        if (!columns.includes('permissions')) {
          await db.execute(`ALTER TABLE utilisateurs ADD COLUMN permissions TEXT DEFAULT '{}'`);
          console.log('✅ Colonne permissions ajoutée à utilisateurs');
        } else {
          console.log('ℹ️ Colonne permissions existe déjà');
        }
      } catch (error) {
        console.warn('⚠️ Impossible d\'ajouter la colonne permissions:', error);
      }
    }
  }
];

export class MigrationManager {
  static async runMigrations(): Promise<void> {
    try {
      const db = await getDb();
      const versionInfo = await DatabaseVersionManager.getCurrentVersion();
      const currentVersion = versionInfo.version;
      
      const pendingMigrations = MIGRATIONS.filter(m => m.version > currentVersion);
      
      if (pendingMigrations.length === 0) {
        console.log('✅ Aucune migration nécessaire');
        return;
      }
      
      console.log(`🔄 ${pendingMigrations.length} migration(s) à exécuter`);
      
      try {
        const backup = await BackupManager.createBackup();
        console.log(`💾 Sauvegarde créée: ${backup.id}`);
      } catch (backupError) {
        console.warn('⚠️ Impossible de créer la sauvegarde, continuation...');
      }
      
      for (const migration of pendingMigrations) {
        console.log(`📦 Exécution de la migration v${migration.version}: ${migration.name}`);
        
        try {
          await migration.up(db);
          await DatabaseVersionManager.updateVersion(
            migration.version,
            `${migration.name} - ${new Date().toISOString()}`
          );
          console.log(`✅ Migration v${migration.version} réussie`);
        } catch (error) {
          console.error(`❌ Erreur migration v${migration.version}:`, error);
          throw new Error(`Échec de la migration v${migration.version}: ${error}`);
        }
      }
      
      console.log('✅ Toutes les migrations ont été exécutées avec succès');
      
    } catch (error) {
      console.error('❌ Erreur lors des migrations:', error);
      throw error;
    }
  }
  
  static async getMigrationStatus(): Promise<{
    currentVersion: number;
    latestVersion: number;
    pendingMigrations: Migration[];
    hasBackup: boolean;
  }> {
    const versionInfo = await DatabaseVersionManager.getCurrentVersion();
    const backups = BackupManager.getBackupList();
    
    return {
      currentVersion: versionInfo.version,
      latestVersion: DatabaseVersionManager.getCurrentVersionNumber(),
      pendingMigrations: MIGRATIONS.filter(m => m.version > versionInfo.version),
      hasBackup: backups.length > 0
    };
  }
}

export default MIGRATIONS;