// src/database/db.ts
import Database from '@tauri-apps/plugin-sql';

let dbInstance: Database | null = null;

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
    categorie TEXT,
    designation TEXT NOT NULL,
    unite_base TEXT DEFAULT 'pièce',
    prix_achat_base REAL DEFAULT 0,
    prix_vente_detail REAL DEFAULT 0,
    prix_vente_gros REAL DEFAULT 0,
    seuil_alerte INTEGER DEFAULT 0,
    commission_pourcentage REAL DEFAULT 0,
    qte_stock INTEGER DEFAULT 0,
    date_entree DATETIME DEFAULT CURRENT_TIMESTAMP,
    est_supprime INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS conditionnements (
    idConditionnement INTEGER PRIMARY KEY AUTOINCREMENT,
    idProduit INTEGER NOT NULL,
    idUnite INTEGER NOT NULL,
    libelle TEXT NOT NULL,
    quantite_par_unite_base REAL NOT NULL,
    prix_vente_ht REAL DEFAULT 0,
    prix_vente_ttc REAL DEFAULT 0,
    prix_achat_ht REAL DEFAULT 0,
    code_barres TEXT UNIQUE,
    est_conditionnement_par_defaut INTEGER DEFAULT 0,
    est_actif INTEGER DEFAULT 1,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit),
    FOREIGN KEY (idUnite) REFERENCES unites(idUnite)
);

-- =====================================================
-- 3. CLIENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS clients (
    idClient INTEGER PRIMARY KEY AUTOINCREMENT,
    NomComplet TEXT,
    Societe TEXT,
    Adresse TEXT,
    Tel TEXT,
    Email TEXT,
    Ville TEXT,
    TypeClient TEXT DEFAULT 'client' CHECK(TypeClient IN ('client', 'revendeur'))
);

-- =====================================================
-- 4. COMMANDES ET VENTES
-- =====================================================

CREATE TABLE IF NOT EXISTS commandes (
    idCommande INTEGER PRIMARY KEY AUTOINCREMENT,
    code_commande TEXT UNIQUE NOT NULL,
    idClient INTEGER NOT NULL,
    type_commande TEXT DEFAULT 'STANDARD',
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
);

CREATE TABLE IF NOT EXISTS commande_details (
    idDetail INTEGER PRIMARY KEY AUTOINCREMENT,
    idCommande INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    idConditionnement INTEGER,
    qte_commande REAL NOT NULL,
    prix_unitaire_vente REAL NOT NULL,
    remise REAL DEFAULT 0,
    FOREIGN KEY (idCommande) REFERENCES commandes(idCommande) ON DELETE CASCADE,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit),
    FOREIGN KEY (idConditionnement) REFERENCES conditionnements(idConditionnement)
);

-- =====================================================
-- DÉCOMPTES REVENDEURS
-- =====================================================

CREATE TABLE IF NOT EXISTS decomptes (
    idDecompte INTEGER PRIMARY KEY AUTOINCREMENT,
    idClient INTEGER NOT NULL,
    DateDecompte DATETIME DEFAULT CURRENT_TIMESTAMP,
    Objet TEXT,
    MontantHT REAL DEFAULT 0,
    MontantTTC REAL DEFAULT 0,
    CodeReçu TEXT UNIQUE,
    DateReçu DATETIME,
    ConditionPaiement TEXT DEFAULT 'NET',
    DateEcheance DATE,
    ModePaiement TEXT DEFAULT 'especes',
    statut TEXT DEFAULT 'EN_ATTENTE',
    notes TEXT,
    FOREIGN KEY (idClient) REFERENCES clients(idClient)
);

-- Table des détails des décomptes
CREATE TABLE IF NOT EXISTS decompte_details (
    idDetailRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
    idDecompte INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    idRevendeur INTEGER NOT NULL,
    QteDecompte REAL DEFAULT 0,
    PrixUnitaireVente REAL DEFAULT 0,
    DateVente DATETIME DEFAULT CURRENT_TIMESTAMP,
    Description TEXT,
    FOREIGN KEY (idDecompte) REFERENCES decomptes(idDecompte) ON DELETE CASCADE,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit),
    FOREIGN KEY (idRevendeur) REFERENCES clients(idClient)
);

-- Table des produits par revendeur (stock revendeur)
CREATE TABLE IF NOT EXISTS produits_revendeur (
    idProduitRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
    idCommande INTEGER NOT NULL,
    code_facture TEXT,
    date_entree DATETIME DEFAULT CURRENT_TIMESTAMP,
    idProduit INTEGER NOT NULL,
    code_produit TEXT,
    categorie TEXT,
    designation TEXT NOT NULL,
    unite_mesure TEXT DEFAULT 'pièce',
    qte_stock REAL DEFAULT 0,
    prix_achat REAL DEFAULT 0,
    prix_vente REAL DEFAULT 0,
    idRevendeur INTEGER NOT NULL,
    FOREIGN KEY (idCommande) REFERENCES commandes(idCommande),
    FOREIGN KEY (idProduit) REFERENCES products(idProduit),
    FOREIGN KEY (idRevendeur) REFERENCES clients(idClient)
);

-- Table des mouvements revendeur
CREATE TABLE IF NOT EXISTS mouvements_revendeur (
    idMouvementRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
    date_mouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
    idProduit INTEGER NOT NULL,
    idRevendeur INTEGER NOT NULL,
    type_mouvement TEXT CHECK(type_mouvement IN ('ENTREE', 'SORTIE')),
    qte_mouvement REAL NOT NULL,
    prix_unitaire REAL DEFAULT 0,
    idCommande INTEGER,
    code_facture TEXT,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit),
    FOREIGN KEY (idRevendeur) REFERENCES clients(idClient),
    FOREIGN KEY (idCommande) REFERENCES commandes(idCommande)
);

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
    notes TEXT,
    FOREIGN KEY (idClient) REFERENCES clients(idClient),
    FOREIGN KEY (idCommande) REFERENCES commandes(idCommande)
);

CREATE TABLE IF NOT EXISTS ventes (
    idVente INTEGER PRIMARY KEY AUTOINCREMENT,
    code_vente TEXT UNIQUE NOT NULL,
    idClient INTEGER,
    idCaissier INTEGER,
    date_vente DATETIME DEFAULT CURRENT_TIMESTAMP,
    montant_ht REAL DEFAULT 0,
    montant_tva REAL DEFAULT 0,
    montant_ttc REAL DEFAULT 0,
    montant_remise REAL DEFAULT 0,
    montant_regle REAL DEFAULT 0,
    monnaie_rendue REAL DEFAULT 0,
    type_vente TEXT DEFAULT 'COMPTOIR',
    statut TEXT DEFAULT 'COMPLETEE',
    notes TEXT,
    idFacture INTEGER,
    FOREIGN KEY (idClient) REFERENCES clients(idClient),
    FOREIGN KEY (idFacture) REFERENCES factures(idFacture)
);

CREATE TABLE IF NOT EXISTS vente_details (
    idDetail INTEGER PRIMARY KEY AUTOINCREMENT,
    idVente INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    idConditionnement INTEGER,
    quantite REAL NOT NULL,
    prix_unitaire_ht REAL NOT NULL,
    prix_unitaire_ttc REAL NOT NULL,
    remise_percent REAL DEFAULT 0,
    tva_taux REAL DEFAULT 0,
    FOREIGN KEY (idVente) REFERENCES ventes(idVente) ON DELETE CASCADE,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit),
    FOREIGN KEY (idConditionnement) REFERENCES conditionnements(idConditionnement)
);

-- =====================================================
-- 5. REGLEMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS reglements (
    idReglement INTEGER PRIMARY KEY AUTOINCREMENT,
    code_reglement TEXT UNIQUE NOT NULL,
    idClient INTEGER,
    idFacture INTEGER,
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
);

-- =====================================================
-- 6. MOUVEMENTS STOCK
-- =====================================================

CREATE TABLE IF NOT EXISTS mouvements_stock (
    idMouvement INTEGER PRIMARY KEY AUTOINCREMENT,
    code_mouvement TEXT UNIQUE NOT NULL,
    idProduit INTEGER NOT NULL,
    idConditionnement INTEGER,
    idLot INTEGER,
    type_mouvement TEXT NOT NULL,
    quantite REAL NOT NULL,
    stock_avant REAL NOT NULL,
    stock_apres REAL NOT NULL,
    date_mouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
    document_type TEXT,
    document_id INTEGER,
    reference TEXT,
    motif TEXT,
    idUtilisateur INTEGER,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit),
    FOREIGN KEY (idConditionnement) REFERENCES conditionnements(idConditionnement)
);

-- =====================================================
-- 7. UTILISATEURS
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
-- 8. CONFIGURATION ATELIER
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
-- 9. CONFIGURATION COMMERCE
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
-- 10. DONNEES PAR DEFAUT
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

INSERT OR IGNORE INTO configuration_atelier (id, nom_atelier) VALUES (1, 'MON ATELIER');

INSERT OR IGNORE INTO utilisateurs (nom, login, mot_de_passe_hash, role, est_actif) 
VALUES ('Administrateur', 'admin', '$2b$10$91kYqJYm2jZqVZyQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ', 'ADMIN', 1);

INSERT OR IGNORE INTO unites (code_unite, nom_unite, symbole, est_unite_base) VALUES
('PC', 'Pièce', 'pc', 1),
('KG', 'Kilogramme', 'kg', 1),
('M', 'Mètre', 'm', 1),
('L', 'Litre', 'l', 1);

INSERT OR IGNORE INTO config_commerce (id, id_type_commerce, modules_actifs, parametres) 
VALUES (1, 1, '[]', '{"tva_default":18,"devise":"FCFA"}');
`;

export const getDb = async (): Promise<Database> => {
  if (dbInstance) return dbInstance;
  
  try {
    dbInstance = await Database.load('sqlite:gestion-commerciale.db');
    console.log('✅ Base de données connectée');
    return dbInstance;
  } catch (error) {
    console.error('❌ Erreur de connexion:', error);
    throw error;
  }
};

// src/database/db.ts

export const initDatabase = async (): Promise<void> => {
  try {
    const db = await getDb();
    
    try {
      await db.execute("DROP TABLE IF EXISTS commande_details");
      await db.execute("DROP TABLE IF EXISTS commandes");
      console.log("✅ Anciennes tables supprimées");
    } catch (e) {
      console.log("Tables non existantes ou déjà supprimées");
    }
    
    await db.execute(SCHEMA_SQL);
    console.log('✅ Base de données initialisée avec succès');
    
    const result = await db.select<any[]>("PRAGMA table_info(commandes)");
    const hascode_commande = result && result.some((col: any) => col.name === 'code_commande');
    console.log('Colonne code_commande existe:', hascode_commande);
    
    if (!hascode_commande) {
      console.warn('⚠️ La colonne code_commande est manquante');
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('❌ Erreur initialisation:', errorMsg);
    throw error;
  }
};

export const closeDatabase = async (): Promise<void> => {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
    console.log('🔒 Base déconnectée');
  }
};

export const isDatabaseConnected = (): boolean => {
  return dbInstance !== null;
};

export default {
  getDb,
  initDatabase,
  closeDatabase,
  isDatabaseConnected
};