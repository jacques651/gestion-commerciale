// src/database/runMigration.ts
import { getDb } from './db';

/**
 * Exécute le schéma SQL complet de la base de données
 */
export const runSchemaMigration = async (): Promise<void> => {
  console.log('🚀 [runSchemaMigration] Début de l\'exécution...');
  
  try {
    console.log('🔄 [runSchemaMigration] Connexion à la base de données...');
    const db = await getDb();
    console.log('✅ [runSchemaMigration] Base de données connectée');
    
    // Vérifier si la table config_generale existe (indique que le schéma est déjà installé)
    console.log('🔍 [runSchemaMigration] Vérification des tables existantes...');
    const tables = await db.select<{ name: string }[]>(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);
    console.log('📊 [runSchemaMigration] Tables existantes:', tables.map(t => t.name));
    
    // Vérifier spécifiquement les tables du journal de caisse
    const hasJournalCaisse = tables.some(t => t.name === 'journal_caisse');
    const hasCharges = tables.some(t => t.name === 'charges_fonctionnement');
    const hasRecap = tables.some(t => t.name === 'recapitulatif_journalier');
    const hasCategoriesCharges = tables.some(t => t.name === 'categories_charges');
    const hasCredits = tables.some(t => t.name === 'credits');
    const hasRemboursements = tables.some(t => t.name === 'remboursements');
    
    console.log(`📋 [runSchemaMigration] Tables de caisse: Journal=${hasJournalCaisse}, Charges=${hasCharges}, Recap=${hasRecap}, Categories=${hasCategoriesCharges}`);
    console.log(`📋 [runSchemaMigration] Tables de crédits: Credits=${hasCredits}, Remboursements=${hasRemboursements}`);
    
    // Vérifier si le schéma est déjà installé
    const hasConfigGenerale = tables.some(t => t.name === 'config_generale');
    
    if (!hasConfigGenerale || !hasJournalCaisse) {
      console.log('⚠️ [runSchemaMigration] Schéma incomplet, exécution du schéma complet...');
      await db.execute(SCHEMA_SQL);
      console.log('✅ [runSchemaMigration] Schéma SQL exécuté avec succès');
    } else {
      console.log('ℹ️ [runSchemaMigration] Tables déjà existantes, exécution des migrations...');
      await runMigrations(db);
    }
    
    // Vérifier à nouveau les tables
    const tablesAfter = await db.select<{ name: string }[]>(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);
    console.log('📊 [runSchemaMigration] Tables après migration:', tablesAfter.map(t => t.name));
    
    // Vérifier les tables de caisse
    const hasJournalCaisseAfter = tablesAfter.some(t => t.name === 'journal_caisse');
    const hasChargesAfter = tablesAfter.some(t => t.name === 'charges_fonctionnement');
    const hasRecapAfter = tablesAfter.some(t => t.name === 'recapitulatif_journalier');
    const hasCategoriesChargesAfter = tablesAfter.some(t => t.name === 'categories_charges');
    const hasCreditsAfter = tablesAfter.some(t => t.name === 'credits');
    const hasRemboursementsAfter = tablesAfter.some(t => t.name === 'remboursements');
    
    console.log(`✅ [runSchemaMigration] Tables de caisse après migration: Journal=${hasJournalCaisseAfter}, Charges=${hasChargesAfter}, Recap=${hasRecapAfter}, Categories=${hasCategoriesChargesAfter}`);
    console.log(`✅ [runSchemaMigration] Tables de crédits après migration: Credits=${hasCreditsAfter}, Remboursements=${hasRemboursementsAfter}`);
    
    // Créer les tables manuellement si elles n'existent pas
    if (!hasJournalCaisseAfter) {
      console.error('❌ [runSchemaMigration] La table journal_caisse n\'a pas été créée !');
      await createCaisseTables(db);
    }
    
    if (!hasChargesAfter) {
      console.error('❌ [runSchemaMigration] La table charges_fonctionnement n\'a pas été créée !');
      await createCaisseTables(db);
    }
    
    if (!hasRecapAfter) {
      console.error('❌ [runSchemaMigration] La table recapitulatif_journalier n\'a pas été créée !');
      await createCaisseTables(db);
    }
    
    if (!hasCategoriesChargesAfter) {
      console.error('❌ [runSchemaMigration] La table categories_charges n\'a pas été créée !');
      await createCaisseTables(db);
    }
    
    if (!hasCreditsAfter) {
      console.error('❌ [runSchemaMigration] La table credits n\'a pas été créée !');
      await createCreditsTables(db);
    }
    
    if (!hasRemboursementsAfter) {
      console.error('❌ [runSchemaMigration] La table remboursements n\'a pas été créée !');
      await createCreditsTables(db);
    }
    
    console.log('✅ [runSchemaMigration] Migration terminée avec succès');
    
  } catch (error) {
    console.error('❌ [runSchemaMigration] Erreur:', error);
    throw error;
  }
};

/**
 * Crée les tables du journal de caisse
 */
const createCaisseTables = async (db: any): Promise<void> => {
  console.log('🔄 Création des tables de caisse...');
  
  try {
    // Journal de caisse
    await db.execute(`
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
      )
    `);
    console.log('✅ Table journal_caisse créée');
    
    // Charges de fonctionnement
    await db.execute(`
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal),
        FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
      )
    `);
    console.log('✅ Table charges_fonctionnement créée');
    
    // Catégories de charges
    await db.execute(`
      CREATE TABLE IF NOT EXISTS categories_charges (
        idCategorie INTEGER PRIMARY KEY AUTOINCREMENT,
        code_categorie TEXT UNIQUE NOT NULL,
        libelle TEXT NOT NULL,
        description TEXT,
        est_actif INTEGER DEFAULT 1
      )
    `);
    console.log('✅ Table categories_charges créée');
    
    // Récapitulatif journalier
    await db.execute(`
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
    `);
    console.log('✅ Table recapitulatif_journalier créée');
    
    // Index
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_journal_caisse_date ON journal_caisse(date_journal);
      CREATE INDEX IF NOT EXISTS idx_journal_caisse_type ON journal_caisse(type_mouvement);
      CREATE INDEX IF NOT EXISTS idx_journal_caisse_categorie ON journal_caisse(categorie);
      CREATE INDEX IF NOT EXISTS idx_charges_date ON charges_fonctionnement(date_charge);
      CREATE INDEX IF NOT EXISTS idx_recap_date ON recapitulatif_journalier(date_recap);
    `);
    console.log('✅ Index créés');
    
    // Données initiales
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
    console.log('✅ Données initiales des catégories de charges insérées');
    
    // Journal initial avec solde à 0
    const journalCount = await db.select(`
      SELECT COUNT(*) as count FROM journal_caisse
    `) as { count: number }[];
    
    if (journalCount[0]?.count === 0) {
      await db.execute(`
        INSERT INTO journal_caisse (code_journal, date_journal, type_mouvement, categorie, designation, montant, solde_apres)
        VALUES ('JRN-INIT', datetime('now'), 'ENTREE', 'AUTRE_ENTREE', 'Solde initial', 0, 0)
      `);
      console.log('✅ Solde initial à 0 créé');
    }
    
    console.log('✅ Toutes les tables de caisse sont créées');
    
  } catch (error) {
    console.error('❌ Erreur création tables de caisse:', error);
    throw error;
  }
};

/**
 * Crée les tables de crédits
 */
const createCreditsTables = async (db: any): Promise<void> => {
  console.log('🔄 Création des tables de crédits...');
  
  try {
    // Table des crédits
    await db.execute(`
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
        updated_at TEXT NOT NULL,
        FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal)
      )
    `);
    console.log('✅ Table credits créée');
    
    // Table des remboursements
    await db.execute(`
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
        created_at TEXT NOT NULL,
        FOREIGN KEY (idCredit) REFERENCES credits(idCredit) ON DELETE CASCADE,
        FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal)
      )
    `);
    console.log('✅ Table remboursements créée');
    
    // Index pour améliorer les performances
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_credits_beneficiaire ON credits(beneficiaire);
      CREATE INDEX IF NOT EXISTS idx_credits_statut ON credits(statut);
      CREATE INDEX IF NOT EXISTS idx_credits_date ON credits(date_credit);
      CREATE INDEX IF NOT EXISTS idx_remboursements_idCredit ON remboursements(idCredit);
      CREATE INDEX IF NOT EXISTS idx_remboursements_date ON remboursements(date_remboursement);
    `);
    console.log('✅ Index des crédits créés');
    
    console.log('✅ Toutes les tables de crédits sont créées');
    
  } catch (error) {
    console.error('❌ Erreur création tables de crédits:', error);
    throw error;
  }
};

/**
 * Exécute les migrations pour ajouter les colonnes manquantes
 */
export const runMigrations = async (db: any): Promise<void> => {
  console.log('🔄 [runMigrations] Vérification des migrations...');
  let migrationCount = 0;
  
  try {
    // 1. Vérifier les colonnes de decomptes
    console.log('📋 [runMigrations] Vérification de la table decomptes...');
    try {
      const tableInfo = await db.select(`PRAGMA table_info(decomptes)`);
      const columns = tableInfo.map((c: any) => c.name);
      console.log(`   Colonnes existantes: ${columns.join(', ')}`);
      
      if (!columns.includes('taux_commission')) {
        console.log('🔄 Ajout de la colonne taux_commission à decomptes...');
        await db.execute(`ALTER TABLE decomptes ADD COLUMN taux_commission REAL DEFAULT 60`);
        migrationCount++;
      }
      
      if (!columns.includes('idFactureRevendeur')) {
        console.log('🔄 Ajout de la colonne idFactureRevendeur à decomptes...');
        await db.execute(`ALTER TABLE decomptes ADD COLUMN idFactureRevendeur INTEGER`);
        migrationCount++;
      }
    } catch (error) {
      console.warn('⚠️ [runMigrations] Erreur sur decomptes:', error);
    }
    
    // 2. Vérifier les colonnes de decompte_details
    console.log('📋 [runMigrations] Vérification de la table decompte_details...');
    try {
      const detailsInfo = await db.select(`PRAGMA table_info(decompte_details)`);
      const detailsColumns = detailsInfo.map((c: any) => c.name);
      console.log(`   Colonnes existantes: ${detailsColumns.join(', ')}`);
      
      if (!detailsColumns.includes('benefice')) {
        console.log('🔄 Ajout de la colonne benefice à decompte_details...');
        await db.execute(`ALTER TABLE decompte_details ADD COLUMN benefice REAL DEFAULT 0`);
        migrationCount++;
      }
      
      if (!detailsColumns.includes('commission')) {
        console.log('🔄 Ajout de la colonne commission à decompte_details...');
        await db.execute(`ALTER TABLE decompte_details ADD COLUMN commission REAL DEFAULT 0`);
        migrationCount++;
      }
    } catch (error) {
      console.warn('⚠️ [runMigrations] Erreur sur decompte_details:', error);
    }
    
    // 3. Vérifier factures_revendeur
    console.log('📋 [runMigrations] Vérification de la table factures_revendeur...');
    try {
      const facturesRevInfo = await db.select(`PRAGMA table_info(factures_revendeur)`);
      const facturesRevColumns = facturesRevInfo.map((c: any) => c.name);
      console.log(`   Colonnes existantes: ${facturesRevColumns.join(', ')}`);
      
      if (!facturesRevColumns.includes('taux_commission')) {
        console.log('🔄 Ajout de la colonne taux_commission à factures_revendeur...');
        await db.execute(`ALTER TABLE factures_revendeur ADD COLUMN taux_commission REAL DEFAULT 60`);
        migrationCount++;
      }
    } catch (error) {
      console.warn('⚠️ [runMigrations] Erreur sur factures_revendeur:', error);
    }
    
    // 4. Vérifier reglements
    console.log('📋 [runMigrations] Vérification de la table reglements...');
    try {
      const reglementsInfo = await db.select(`PRAGMA table_info(reglements)`);
      const reglementsColumns = reglementsInfo.map((c: any) => c.name);
      console.log(`   Colonnes existantes: ${reglementsColumns.join(', ')}`);
      
      if (!reglementsColumns.includes('code_reglement')) {
        console.log('🔄 Ajout de la colonne code_reglement à reglements...');
        await db.execute(`ALTER TABLE reglements ADD COLUMN code_reglement TEXT`);
        migrationCount++;
      }
    } catch (error) {
      console.warn('⚠️ [runMigrations] Erreur sur reglements:', error);
    }
    
    // 5. Vérifier factures_revendeur_details
    console.log('📋 [runMigrations] Vérification de la table factures_revendeur_details...');
    try {
      const detailsFRInfo = await db.select(`PRAGMA table_info(factures_revendeur_details)`);
      
      if (detailsFRInfo.length === 0) {
        console.log('🔄 Création de la table factures_revendeur_details...');
        await db.execute(`
          CREATE TABLE IF NOT EXISTS factures_revendeur_details (
              idDetailFactureRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
              idFactureRevendeur INTEGER NOT NULL,
              idProduit INTEGER NOT NULL,
              qte_commande REAL NOT NULL,
              prix_achat_base REAL DEFAULT 0,
              prix_unitaire_vente REAL NOT NULL,
              FOREIGN KEY(idFactureRevendeur) REFERENCES factures_revendeur(idFactureRevendeur) ON DELETE CASCADE,
              FOREIGN KEY(idProduit) REFERENCES products(idProduit)
          )
        `);
        migrationCount++;
      }
    } catch (error) {
      console.warn('⚠️ [runMigrations] Erreur sur factures_revendeur_details:', error);
    }
    
    // 6. Vérifier reglements_revendeur
    console.log('📋 [runMigrations] Vérification de la table reglements_revendeur...');
    try {
      const reglementsRevInfo = await db.select(`PRAGMA table_info(reglements_revendeur)`);
      
      if (reglementsRevInfo.length === 0) {
        console.log('🔄 Création de la table reglements_revendeur...');
        await db.execute(`
          CREATE TABLE IF NOT EXISTS reglements_revendeur (
              idReglement INTEGER PRIMARY KEY AUTOINCREMENT,
              idFactureRevendeur INTEGER NOT NULL,
              idClient INTEGER NOT NULL,
              date_reglement DATETIME DEFAULT CURRENT_TIMESTAMP,
              montant REAL NOT NULL,
              mode_reglement TEXT,
              reference TEXT,
              observation TEXT,
              FOREIGN KEY(idFactureRevendeur) REFERENCES factures_revendeur(idFactureRevendeur),
              FOREIGN KEY(idClient) REFERENCES clients(idClient)
          )
        `);
        migrationCount++;
      }
    } catch (error) {
      console.warn('⚠️ [runMigrations] Erreur sur reglements_revendeur:', error);
    }
    
    // 7. Vérifier les tables de caisse
    console.log('📋 [runMigrations] Vérification des tables de caisse...');
    
    // Vérifier journal_caisse
    try {
      const journalInfo = await db.select(`PRAGMA table_info(journal_caisse)`);
      if (journalInfo.length === 0) {
        console.log('🔄 Création de la table journal_caisse...');
        await db.execute(`
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
          )
        `);
        migrationCount++;
      }
    } catch (error) {
      console.warn('⚠️ [runMigrations] Erreur sur journal_caisse:', error);
    }
    
    // Vérifier charges_fonctionnement
    try {
      const chargesInfo = await db.select(`PRAGMA table_info(charges_fonctionnement)`);
      if (chargesInfo.length === 0) {
        console.log('🔄 Création de la table charges_fonctionnement...');
        await db.execute(`
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal),
            FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
          )
        `);
        migrationCount++;
      }
    } catch (error) {
      console.warn('⚠️ [runMigrations] Erreur sur charges_fonctionnement:', error);
    }
    
    // Vérifier categories_charges
    try {
      const categoriesInfo = await db.select(`PRAGMA table_info(categories_charges)`);
      if (categoriesInfo.length === 0) {
        console.log('🔄 Création de la table categories_charges...');
        await db.execute(`
          CREATE TABLE IF NOT EXISTS categories_charges (
            idCategorie INTEGER PRIMARY KEY AUTOINCREMENT,
            code_categorie TEXT UNIQUE NOT NULL,
            libelle TEXT NOT NULL,
            description TEXT,
            est_actif INTEGER DEFAULT 1
          )
        `);
        migrationCount++;
        
        // Insérer les catégories par défaut
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
      }
    } catch (error) {
      console.warn('⚠️ [runMigrations] Erreur sur categories_charges:', error);
    }
    
    // Vérifier recapitulatif_journalier
    try {
      const recapInfo = await db.select(`PRAGMA table_info(recapitulatif_journalier)`);
      if (recapInfo.length === 0) {
        console.log('🔄 Création de la table recapitulatif_journalier...');
        await db.execute(`
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
        `);
        migrationCount++;
      }
    } catch (error) {
      console.warn('⚠️ [runMigrations] Erreur sur recapitulatif_journalier:', error);
    }
    
    // 8. Vérifier les tables de crédits
    console.log('📋 [runMigrations] Vérification des tables de crédits...');
    
    // Vérifier credits
    try {
      const creditsInfo = await db.select(`PRAGMA table_info(credits)`);
      if (creditsInfo.length === 0) {
        console.log('🔄 Création de la table credits...');
        await db.execute(`
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
            updated_at TEXT NOT NULL,
            FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal)
          )
        `);
        migrationCount++;
        
        // Créer les index pour credits
        await db.execute(`
          CREATE INDEX IF NOT EXISTS idx_credits_beneficiaire ON credits(beneficiaire);
          CREATE INDEX IF NOT EXISTS idx_credits_statut ON credits(statut);
          CREATE INDEX IF NOT EXISTS idx_credits_date ON credits(date_credit);
        `);
      }
    } catch (error) {
      console.warn('⚠️ [runMigrations] Erreur sur credits:', error);
    }
    
    // Vérifier remboursements
    try {
      const remboursementsInfo = await db.select(`PRAGMA table_info(remboursements)`);
      if (remboursementsInfo.length === 0) {
        console.log('🔄 Création de la table remboursements...');
        await db.execute(`
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
            created_at TEXT NOT NULL,
            FOREIGN KEY (idCredit) REFERENCES credits(idCredit) ON DELETE CASCADE,
            FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal)
          )
        `);
        migrationCount++;
        
        // Créer les index pour remboursements
        await db.execute(`
          CREATE INDEX IF NOT EXISTS idx_remboursements_idCredit ON remboursements(idCredit);
          CREATE INDEX IF NOT EXISTS idx_remboursements_date ON remboursements(date_remboursement);
        `);
      }
    } catch (error) {
      console.warn('⚠️ [runMigrations] Erreur sur remboursements:', error);
    }
    
    console.log(`✅ [runMigrations] ${migrationCount} migration(s) exécutée(s)`);
    
  } catch (error) {
    console.error('❌ [runMigrations] Erreur lors des migrations:', error);
    throw error;
  }
};

/**
 * Fonction principale pour initialiser la base de données avec toutes les migrations
 */
export const initDatabaseWithMigrations = async (): Promise<void> => {
  try {
    console.log('🚀 [initDatabaseWithMigrations] Initialisation de la base de données...');
    await runSchemaMigration();
    console.log('✅ [initDatabaseWithMigrations] Base de données initialisée avec succès');
  } catch (error) {
    console.error('❌ [initDatabaseWithMigrations] Erreur:', error);
    throw error;
  }
};

// =====================================================
// SCHÉMA SQL COMPLET
// =====================================================
const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

-- =====================================================
-- 1. CONFIGURATION GENERALE DE L'APPLICATION
-- =====================================================

CREATE TABLE IF NOT EXISTS config_generale (
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
);

CREATE TABLE IF NOT EXISTS config_modules (
    id_module INTEGER PRIMARY KEY AUTOINCREMENT,
    code_module TEXT UNIQUE NOT NULL,
    nom_module TEXT NOT NULL,
    description TEXT,
    est_actif INTEGER DEFAULT 1,
    ordre_affichage INTEGER DEFAULT 0,
    date_activation DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS config_types_commerce (
    id_type_commerce INTEGER PRIMARY KEY AUTOINCREMENT,
    code_type TEXT UNIQUE NOT NULL,
    libelle TEXT NOT NULL,
    description TEXT,
    parametres_par_defaut TEXT,
    est_actif INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS config_parametres (
    id_param INTEGER PRIMARY KEY AUTOINCREMENT,
    categorie TEXT NOT NULL,
    code_param TEXT NOT NULL,
    valeur TEXT,
    type_valeur TEXT DEFAULT 'string',
    description TEXT,
    modifiable INTEGER DEFAULT 1,
    UNIQUE(categorie, code_param)
);

CREATE TABLE IF NOT EXISTS config_statuts (
    id_statut INTEGER PRIMARY KEY AUTOINCREMENT,
    entite_type TEXT NOT NULL,
    code_statut TEXT NOT NULL,
    libelle TEXT NOT NULL,
    couleur TEXT DEFAULT '#000000',
    ordre INTEGER DEFAULT 0,
    est_initial INTEGER DEFAULT 0,
    est_final INTEGER DEFAULT 0,
    est_actif INTEGER DEFAULT 1,
    UNIQUE(entite_type, code_statut)
);

CREATE TABLE IF NOT EXISTS config_modes_reglement (
    id_mode INTEGER PRIMARY KEY AUTOINCREMENT,
    code_mode TEXT UNIQUE NOT NULL,
    libelle TEXT NOT NULL,
    necessite_reference INTEGER DEFAULT 0,
    delai_jours INTEGER DEFAULT 0,
    est_actif INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS config_tva (
    id_tva INTEGER PRIMARY KEY AUTOINCREMENT,
    code_tva TEXT UNIQUE NOT NULL,
    taux REAL NOT NULL,
    libelle TEXT NOT NULL,
    est_defaut INTEGER DEFAULT 0,
    est_actif INTEGER DEFAULT 1
);

-- =====================================================
-- 2. REFERENTIEL PRODUITS
-- =====================================================

CREATE TABLE IF NOT EXISTS marques (
    idMarque INTEGER PRIMARY KEY AUTOINCREMENT,
    code_marque TEXT UNIQUE NOT NULL,
    nom_marque TEXT NOT NULL,
    site_web TEXT,
    contact TEXT,
    est_actif INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS fournisseurs (
    idFournisseur INTEGER PRIMARY KEY AUTOINCREMENT,
    code_fournisseur TEXT UNIQUE NOT NULL,
    raison_sociale TEXT NOT NULL,
    adresse TEXT,
    ville TEXT,
    pays TEXT,
    telephone TEXT,
    email TEXT,
    site_web TEXT,
    contact_nom TEXT,
    contact_telephone TEXT,
    delai_livraison_jours INTEGER DEFAULT 0,
    conditions_paiement TEXT,
    est_actif INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    idCategorie INTEGER PRIMARY KEY AUTOINCREMENT,
    code_categorie TEXT UNIQUE NOT NULL,
    nom_categorie TEXT NOT NULL,
    description TEXT,
    parent_id INTEGER,
    niveau INTEGER DEFAULT 0,
    chemin TEXT,
    image_url TEXT,
    est_active INTEGER DEFAULT 1,
    ordre_affichage INTEGER DEFAULT 0,
    FOREIGN KEY (parent_id) REFERENCES categories(idCategorie)
);

CREATE TABLE IF NOT EXISTS unites (
    idUnite INTEGER PRIMARY KEY AUTOINCREMENT,
    code_unite TEXT UNIQUE NOT NULL,
    nom_unite TEXT NOT NULL,
    symbole TEXT,
    categorie_unite TEXT DEFAULT 'QUANTITE',
    est_unite_base INTEGER DEFAULT 0,
    facteur_conversion REAL DEFAULT 1,
    unite_reference_id INTEGER,
    FOREIGN KEY (unite_reference_id) REFERENCES unites(idUnite)
);

CREATE TABLE IF NOT EXISTS products (
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
    date_entree DATETIME DEFAULT CURRENT_TIMESTAMP,
    est_supprime INTEGER DEFAULT 0
);

-- =====================================================
-- 3. CLIENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS clients (
    idClient INTEGER PRIMARY KEY AUTOINCREMENT,
    NomComplet TEXT NOT NULL,
    Societe TEXT,
    Adresse TEXT,
    Tel TEXT,
    Email TEXT,
    Ville TEXT,
    TypeClient TEXT NOT NULL CHECK(TypeClient IN ('client', 'revendeur'))
);

-- =====================================================
-- 4. COMMANDES
-- =====================================================

CREATE TABLE IF NOT EXISTS commandes (
    idCommande INTEGER PRIMARY KEY AUTOINCREMENT,
    code_commande TEXT UNIQUE NOT NULL,
    idClient INTEGER NOT NULL,
    type_commande TEXT NOT NULL,
    date_commande DATETIME DEFAULT CURRENT_TIMESTAMP,
    montant_ht REAL DEFAULT 0,
    montant_ttc REAL DEFAULT 0,
    code_facture TEXT,
    statut TEXT DEFAULT 'BROUILLON',
    FOREIGN KEY(idClient) REFERENCES clients(idClient)
);

CREATE TABLE IF NOT EXISTS commande_details (
    idDetail INTEGER PRIMARY KEY AUTOINCREMENT,
    idCommande INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    qte_commande REAL NOT NULL,
    prix_unitaire_vente REAL NOT NULL,
    FOREIGN KEY(idCommande) REFERENCES commandes(idCommande) ON DELETE CASCADE,
    FOREIGN KEY(idProduit) REFERENCES products(idProduit)
);

-- =====================================================
-- 5. STOCK REVENDEUR
-- =====================================================

CREATE TABLE IF NOT EXISTS stock_revendeur (
    idStockRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
    idProduit INTEGER NOT NULL,
    idRevendeur INTEGER NOT NULL,
    qte_stock REAL DEFAULT 0,
    prix_achat REAL DEFAULT 0,
    prix_vente REAL DEFAULT 0,
    commission_pourcentage REAL DEFAULT 0,
    UNIQUE(idProduit, idRevendeur)
);

-- =====================================================
-- 6. DECOMPTES
-- =====================================================

CREATE TABLE IF NOT EXISTS decomptes (
    idDecompte INTEGER PRIMARY KEY AUTOINCREMENT,
    idClient INTEGER NOT NULL,
    code_decompte TEXT UNIQUE,
    date_decompte DATETIME DEFAULT CURRENT_TIMESTAMP,
    montant_achat REAL DEFAULT 0,
    montant_vente REAL DEFAULT 0,
    montant_benefice REAL DEFAULT 0,
    montant_commission REAL DEFAULT 0,
    montant_net REAL DEFAULT 0,
    statut TEXT DEFAULT 'EN_ATTENTE',
    observation TEXT,
    taux_commission REAL DEFAULT 60,
    idFactureRevendeur INTEGER,
    FOREIGN KEY(idClient) REFERENCES clients(idClient)
);

CREATE TABLE IF NOT EXISTS decompte_details (
    idDetailRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
    idDecompte INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    qte_decompte REAL NOT NULL DEFAULT 0,
    prix_achat REAL DEFAULT 0,
    prix_vente REAL DEFAULT 0,
    benefice REAL DEFAULT 0,
    commission REAL DEFAULT 0,
    FOREIGN KEY(idDecompte) REFERENCES decomptes(idDecompte) ON DELETE CASCADE,
    FOREIGN KEY(idProduit) REFERENCES products(idProduit)
);

-- =====================================================
-- 7. VENTES
-- =====================================================

CREATE TABLE IF NOT EXISTS ventes (
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
    FOREIGN KEY(idClient) REFERENCES clients(idClient)
);

CREATE TABLE IF NOT EXISTS vente_details (
    idDetail INTEGER PRIMARY KEY AUTOINCREMENT,
    idVente INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    quantite REAL NOT NULL,
    prix_unitaire_ht REAL NOT NULL,
    prix_unitaire_ttc REAL NOT NULL,
    remise_percent REAL DEFAULT 0,
    tva_taux REAL DEFAULT 18,
    FOREIGN KEY(idVente) REFERENCES ventes(idVente) ON DELETE CASCADE,
    FOREIGN KEY(idProduit) REFERENCES products(idProduit)
);

CREATE INDEX IF NOT EXISTS idx_vente_date ON ventes(date_vente);
CREATE INDEX IF NOT EXISTS idx_vente_client ON ventes(idClient);
CREATE INDEX IF NOT EXISTS idx_vente_detail_vente ON vente_details(idVente);
CREATE INDEX IF NOT EXISTS idx_vente_detail_produit ON vente_details(idProduit);

-- =====================================================
-- 8. MOUVEMENTS STOCK
-- =====================================================

CREATE TABLE IF NOT EXISTS mouvements_stock (
    idMouvement INTEGER PRIMARY KEY AUTOINCREMENT,
    idProduit INTEGER NOT NULL,
    type_mouvement TEXT NOT NULL,
    quantite REAL NOT NULL,
    stock_avant REAL NOT NULL,
    stock_apres REAL NOT NULL,
    date_mouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
    idCommande INTEGER,
    FOREIGN KEY(idProduit) REFERENCES products(idProduit)
);

CREATE TABLE IF NOT EXISTS mouvements_revendeur (
    idMouvementRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
    idProduit INTEGER NOT NULL,
    idRevendeur INTEGER NOT NULL,
    idCommande INTEGER,
    idDecompte INTEGER,
    type_mouvement TEXT NOT NULL,
    qte_mouvement REAL NOT NULL,
    date_mouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(idProduit) REFERENCES products(idProduit),
    FOREIGN KEY(idRevendeur) REFERENCES clients(idClient),
    FOREIGN KEY(idCommande) REFERENCES commandes(idCommande),
    FOREIGN KEY(idDecompte) REFERENCES decomptes(idDecompte)
);

-- =====================================================
-- 9. FACTURES
-- =====================================================

CREATE TABLE IF NOT EXISTS factures (
    idFacture INTEGER PRIMARY KEY AUTOINCREMENT,
    code_facture TEXT UNIQUE NOT NULL,
    idClient INTEGER NOT NULL,
    idCommande INTEGER,
    date_facture DATETIME DEFAULT CURRENT_TIMESTAMP,
    montant_ttc REAL DEFAULT 0,
    montant_regle REAL DEFAULT 0,
    statut TEXT DEFAULT 'EN_ATTENTE',
    FOREIGN KEY(idClient) REFERENCES clients(idClient),
    FOREIGN KEY(idCommande) REFERENCES commandes(idCommande)
);

CREATE TABLE IF NOT EXISTS facture_details (
    idDetailFacture INTEGER PRIMARY KEY AUTOINCREMENT,
    idFacture INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    qte REAL NOT NULL,
    prix_unitaire REAL NOT NULL,
    FOREIGN KEY(idFacture) REFERENCES factures(idFacture) ON DELETE CASCADE,
    FOREIGN KEY(idProduit) REFERENCES products(idProduit)
);

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
    taux_commission REAL DEFAULT 60,
    FOREIGN KEY(idCommande) REFERENCES commandes(idCommande),
    FOREIGN KEY(idRevendeur) REFERENCES clients(idClient)
);

CREATE TABLE IF NOT EXISTS factures_revendeur_details (
    idDetailFactureRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
    idFactureRevendeur INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    qte_commande REAL NOT NULL,
    prix_achat_base REAL DEFAULT 0,
    prix_unitaire_vente REAL NOT NULL,
    FOREIGN KEY(idFactureRevendeur) REFERENCES factures_revendeur(idFactureRevendeur) ON DELETE CASCADE,
    FOREIGN KEY(idProduit) REFERENCES products(idProduit)
);

-- =====================================================
-- 10. REGLEMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS reglements (
    idReglement INTEGER PRIMARY KEY AUTOINCREMENT,
    code_reglement TEXT UNIQUE NOT NULL,
    idFacture INTEGER NOT NULL,
    montant REAL NOT NULL,
    mode_reglement TEXT,
    date_reglement DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(idFacture) REFERENCES factures(idFacture)
);

CREATE TABLE IF NOT EXISTS reglements_revendeur (
    idReglement INTEGER PRIMARY KEY AUTOINCREMENT,
    idFactureRevendeur INTEGER NOT NULL,
    idClient INTEGER NOT NULL,
    date_reglement DATETIME DEFAULT CURRENT_TIMESTAMP,
    montant REAL NOT NULL,
    mode_reglement TEXT,
    reference TEXT,
    observation TEXT,
    FOREIGN KEY(idFactureRevendeur) REFERENCES factures_revendeur(idFactureRevendeur),
    FOREIGN KEY(idClient) REFERENCES clients(idClient)
);

-- =====================================================
-- 11. UTILISATEURS
-- =====================================================

CREATE TABLE IF NOT EXISTS utilisateurs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    prenom TEXT,
    login TEXT NOT NULL UNIQUE,
    mot_de_passe_hash TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'COMMERCIAL',
    est_actif INTEGER DEFAULT 1,
    derniere_connexion DATETIME,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 12. CONFIGURATION ATELIER
-- =====================================================

CREATE TABLE IF NOT EXISTS configuration_atelier (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nom_atelier TEXT,
    telephone TEXT,
    adresse TEXT,
    email TEXT,
    nif TEXT,
    message_facture TEXT,
    logo_base64 TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 13. CONFIGURATION COMMERCE
-- =====================================================

CREATE TABLE IF NOT EXISTS config_commerce (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    id_type_commerce INTEGER NOT NULL,
    modules_actifs TEXT DEFAULT '[]',
    parametres TEXT DEFAULT '{}',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_type_commerce) REFERENCES config_types_commerce(id_type_commerce)
);

-- =====================================================
-- 14. CREDITS ET REMBOURSEMENTS
-- =====================================================

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
    updated_at TEXT NOT NULL,
    FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal)
);

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
    created_at TEXT NOT NULL,
    FOREIGN KEY (idCredit) REFERENCES credits(idCredit) ON DELETE CASCADE,
    FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal)
);

CREATE INDEX IF NOT EXISTS idx_credits_beneficiaire ON credits(beneficiaire);
CREATE INDEX IF NOT EXISTS idx_credits_statut ON credits(statut);
CREATE INDEX IF NOT EXISTS idx_credits_date ON credits(date_credit);
CREATE INDEX IF NOT EXISTS idx_remboursements_idCredit ON remboursements(idCredit);
CREATE INDEX IF NOT EXISTS idx_remboursements_date ON remboursements(date_remboursement);

-- =====================================================
-- 15. JOURNAL DE CAISSE
-- =====================================================

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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
);

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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal),
  FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
);

CREATE TABLE IF NOT EXISTS categories_charges (
  idCategorie INTEGER PRIMARY KEY AUTOINCREMENT,
  code_categorie TEXT UNIQUE NOT NULL,
  libelle TEXT NOT NULL,
  description TEXT,
  est_actif INTEGER DEFAULT 1
);

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
);

-- =====================================================
-- 16. DONNEES PAR DEFAUT
-- =====================================================

INSERT OR IGNORE INTO config_generale (id_config, nom_application, devise, taux_tva_default) 
VALUES (1, 'Gestion Commerciale Pro', 'FCFA', 18);

INSERT OR IGNORE INTO config_types_commerce (code_type, libelle, description) VALUES
('DETAIL', 'Commerce de détail', 'Boutique, supermarché'),
('GROS', 'Commerce de gros', 'Distribution, grossiste'),
('MIXTE', 'Commerce mixte', 'Hybride'),
('SERVICE', 'Prestation de services', 'Atelier, réparation');

INSERT OR IGNORE INTO config_modes_reglement (code_mode, libelle, necessite_reference) VALUES
('ESPECES', 'Espèces', 0),
('CHEQUE', 'Chèque', 1),
('VIREMENT', 'Virement', 1),
('CARTE', 'Carte bancaire', 1),
('MOBILE_MONEY', 'Mobile Money', 1);

INSERT OR IGNORE INTO config_tva (code_tva, taux, libelle, est_defaut) VALUES
('TVA0', 0, 'TVA 0%', 0),
('TVA18', 18, 'TVA 18%', 1);

INSERT OR IGNORE INTO config_modules (code_module, nom_module, ordre_affichage) VALUES
('VENTES', 'Ventes', 1),
('STOCK', 'Stock', 2),
('CLIENTS', 'Clients', 3),
('PRODUITS', 'Produits', 4),
('FINANCES', 'Finances', 5);

INSERT OR IGNORE INTO config_statuts (entite_type, code_statut, libelle, couleur, ordre, est_initial, est_final) VALUES
('COMMANDE', 'BROUILLON', 'Brouillon', '#808080', 1, 1, 0),
('COMMANDE', 'CONFIRMEE', 'Confirmée', '#3498db', 2, 0, 0),
('COMMANDE', 'LIVREE', 'Livrée', '#27ae60', 3, 0, 0),
('COMMANDE', 'ANNULEE', 'Annulée', '#e74c3c', 4, 0, 1),
('FACTURE', 'EN_ATTENTE', 'En attente', '#f39c12', 1, 1, 0),
('FACTURE', 'REGLEE', 'Réglée', '#27ae60', 2, 0, 1),
('FACTURE', 'ANNULEE', 'Annulée', '#e74c3c', 3, 0, 1);

INSERT OR IGNORE INTO configuration_atelier (id, nom_atelier) VALUES (1, 'MON ATELIER');

INSERT OR IGNORE INTO utilisateurs (nom, login, mot_de_passe_hash, role, est_actif) 
VALUES ('Administrateur', 'admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ADMIN', 1);

INSERT OR IGNORE INTO unites (code_unite, nom_unite, symbole, est_unite_base) VALUES
('PC', 'Pièce', 'pc', 1),
('KG', 'Kilogramme', 'kg', 1),
('M', 'Mètre', 'm', 1),
('L', 'Litre', 'l', 1);

INSERT OR IGNORE INTO config_commerce (id, id_type_commerce, modules_actifs, parametres) 
VALUES (1, 1, '[]', '{"tva_default":18,"devise":"FCFA"}');

INSERT OR IGNORE INTO categories_charges (code_categorie, libelle) VALUES
('EAU', 'Eau'),
('ELECTRICITE', 'Électricité'),
('LOYER', 'Loyer'),
('SALAIRE', 'Salaire'),
('TRANSPORT', 'Transport'),
('COMMUNICATION', 'Communication'),
('AUTRE', 'Autres charges');

-- =====================================================
-- 17. INDEX
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_journal_caisse_date ON journal_caisse(date_journal);
CREATE INDEX IF NOT EXISTS idx_journal_caisse_type ON journal_caisse(type_mouvement);
CREATE INDEX IF NOT EXISTS idx_journal_caisse_categorie ON journal_caisse(categorie);
CREATE INDEX IF NOT EXISTS idx_charges_date ON charges_fonctionnement(date_charge);
CREATE INDEX IF NOT EXISTS idx_recap_date ON recapitulatif_journalier(date_recap);
`;

export default {
  runSchemaMigration,
  runMigrations,
  initDatabaseWithMigrations
};