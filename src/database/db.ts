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

-- Table products (version complète avec toutes les colonnes)
CREATE TABLE IF NOT EXISTS products (
    idProduit INTEGER PRIMARY KEY AUTOINCREMENT,
    code_produit TEXT UNIQUE NOT NULL,
    designation TEXT NOT NULL,
    categorie TEXT,
    unite_base TEXT DEFAULT 'pièce',
    prix_achat_base REAL DEFAULT 0,
    prix_vente_detail REAL DEFAULT 0,
    prix_vente_gros REAL DEFAULT 0,
    qte_stock REAL DEFAULT 0,
    seuil_alerte REAL DEFAULT 10,
    prix_moyen_pondere REAL DEFAULT 0,
    methode_gestion_stock TEXT DEFAULT 'FIFO',
    date_entree DATETIME DEFAULT CURRENT_TIMESTAMP,
    est_supprime INTEGER DEFAULT 0
);

-- Table conditionnements
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
-- 6. DÉCOMPTES REVENDEURS (version corrigée)
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
    statut TEXT DEFAULT 'brouillon',
    observation TEXT,
    periode_debut TEXT,
    periode_fin TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idClient) REFERENCES clients(idClient)
);

CREATE TABLE IF NOT EXISTS decompte_details (
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
);

-- Index pour les décomptes
CREATE INDEX IF NOT EXISTS idx_decomptes_client ON decomptes(idClient);
CREATE INDEX IF NOT EXISTS idx_decomptes_date ON decomptes(date_decompte);
CREATE INDEX IF NOT EXISTS idx_decomptes_statut ON decomptes(statut);
CREATE INDEX IF NOT EXISTS idx_decomptes_code ON decomptes(code_decompte);
CREATE INDEX IF NOT EXISTS idx_decompte_details_decompte ON decompte_details(idDecompte);
CREATE INDEX IF NOT EXISTS idx_decompte_details_produit ON decompte_details(idProduit);

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
    FOREIGN KEY (idClient) REFERENCES clients(idClient)
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
    FOREIGN KEY (idVente) REFERENCES ventes(idVente) ON DELETE CASCADE,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit)
);

CREATE INDEX IF NOT EXISTS idx_vente_date ON ventes(date_vente);
CREATE INDEX IF NOT EXISTS idx_vente_client ON ventes(idClient);
CREATE INDEX IF NOT EXISTS idx_vente_detail_vente ON vente_details(idVente);
CREATE INDEX IF NOT EXISTS idx_vente_detail_produit ON vente_details(idProduit);

-- =====================================================
-- 8. MOUVEMENTS STOCK (version complète)
-- =====================================================

CREATE TABLE IF NOT EXISTS mouvements_stock (
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
);

-- =====================================================
-- 9. LOTS DE STOCK (GESTION FIFO)
-- =====================================================

CREATE TABLE IF NOT EXISTS lots_stock (
    idLot INTEGER PRIMARY KEY AUTOINCREMENT,
    idProduit INTEGER NOT NULL,
    code_lot TEXT UNIQUE NOT NULL,
    quantite_entree REAL NOT NULL,
    quantite_restante REAL NOT NULL,
    prix_achat_unitaire REAL NOT NULL,
    prix_vente_unitaire REAL NOT NULL,
    date_entree DATE NOT NULL,
    date_expiration DATE,
    reference_facture TEXT,
    idFournisseur INTEGER,
    notes TEXT,
    est_supprime INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit),
    FOREIGN KEY (idFournisseur) REFERENCES fournisseurs(idFournisseur)
);

-- Table des sorties de stock par lot
CREATE TABLE IF NOT EXISTS sorties_lots (
    idSortieLot INTEGER PRIMARY KEY AUTOINCREMENT,
    idLot INTEGER NOT NULL,
    idMouvement INTEGER NOT NULL,
    quantite_sortie REAL NOT NULL,
    prix_vente_unitaire REAL NOT NULL,
    FOREIGN KEY (idLot) REFERENCES lots_stock(idLot),
    FOREIGN KEY (idMouvement) REFERENCES mouvements_stock(idMouvement)
);

-- Table pour l'historique des prix
CREATE TABLE IF NOT EXISTS historique_prix (
    idHistorique INTEGER PRIMARY KEY AUTOINCREMENT,
    idProduit INTEGER NOT NULL,
    date_changement DATETIME DEFAULT CURRENT_TIMESTAMP,
    ancien_prix_achat REAL,
    nouveau_prix_achat REAL,
    ancien_prix_vente REAL,
    nouveau_prix_vente REAL,
    idLot INTEGER,
    motif TEXT,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit),
    FOREIGN KEY (idLot) REFERENCES lots_stock(idLot)
);

-- =====================================================
-- 10. MOUVEMENTS REVENDEUR
-- =====================================================

CREATE TABLE IF NOT EXISTS mouvements_revendeur (
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
);

-- =====================================================
-- 11. FACTURES
-- =====================================================

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

CREATE TABLE IF NOT EXISTS facture_details (
    idDetailFacture INTEGER PRIMARY KEY AUTOINCREMENT,
    idFacture INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    qte REAL NOT NULL,
    prix_unitaire REAL NOT NULL,
    FOREIGN KEY (idFacture) REFERENCES factures(idFacture) ON DELETE CASCADE,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit)
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
    taux_commission REAL DEFAULT 60,  -- ✅ Ajout de la colonne
    FOREIGN KEY (idCommande) REFERENCES commandes(idCommande),
    FOREIGN KEY (idRevendeur) REFERENCES clients(idClient)
);

-- =====================================================
-- 12. RÈGLEMENTS
-- =====================================================

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
    idUtilisateur INTEGER,
    FOREIGN KEY (idClient) REFERENCES clients(idClient),
    FOREIGN KEY (idFacture) REFERENCES factures(idFacture),
    FOREIGN KEY (idVente) REFERENCES ventes(idVente)
);

-- =====================================================
-- 13. UTILISATEURS
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
-- 14. CONFIGURATION ATELIER
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
-- 15. CONFIGURATION COMMERCE
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
-- 16. CREDITS ET REMBOURSEMENTS
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
-- 17. JOURNAL DE CAISSE
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
-- 18. VUES
-- =====================================================

-- Vue pour le calcul du PMP et stock actuel
CREATE VIEW IF NOT EXISTS vue_stock_actuel AS
SELECT 
    p.idProduit,
    p.code_produit,
    p.designation,
    p.categorie,
    p.unite_base,
    COALESCE(SUM(l.quantite_restante), 0) AS stock_actuel,
    CASE 
        WHEN COALESCE(SUM(l.quantite_restante), 0) > 0 
        THEN ROUND(SUM(l.quantite_restante * l.prix_achat_unitaire) / SUM(l.quantite_restante), 2)
        ELSE p.prix_moyen_pondere
    END AS prix_moyen_pondere,
    COALESCE(MAX(l.date_entree), p.date_entree) AS derniere_entree
FROM products p
LEFT JOIN lots_stock l ON p.idProduit = l.idProduit AND l.quantite_restante > 0 AND l.est_supprime = 0
WHERE p.est_supprime = 0
GROUP BY p.idProduit;

-- Vue pour l'historique des mouvements détaillés
CREATE VIEW IF NOT EXISTS vue_mouvements_detail AS
SELECT 
    m.idMouvement,
    m.idProduit,
    p.code_produit,
    p.designation,
    m.type_mouvement,
    m.quantite,
    m.stock_avant,
    m.stock_apres,
    m.prix_unitaire,
    m.reference,
    m.notes,
    m.date_mouvement,
    CASE 
        WHEN m.idLot IS NOT NULL THEN l.code_lot
        ELSE NULL
    END AS code_lot
FROM mouvements_stock m
LEFT JOIN products p ON m.idProduit = p.idProduit
LEFT JOIN lots_stock l ON m.idLot = l.idLot
ORDER BY m.date_mouvement DESC;

-- =====================================================
-- 19. INDEX
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_products_code ON products(code_produit);
CREATE INDEX IF NOT EXISTS idx_products_categorie ON products(categorie);
CREATE INDEX IF NOT EXISTS idx_lots_produit ON lots_stock(idProduit);
CREATE INDEX IF NOT EXISTS idx_lots_date ON lots_stock(date_entree);
CREATE INDEX IF NOT EXISTS idx_lots_code ON lots_stock(code_lot);
CREATE INDEX IF NOT EXISTS idx_sorties_lot ON sorties_lots(idLot);
CREATE INDEX IF NOT EXISTS idx_historique_produit ON historique_prix(idProduit);
CREATE INDEX IF NOT EXISTS idx_mouvements_produit ON mouvements_stock(idProduit);
CREATE INDEX IF NOT EXISTS idx_mouvements_date ON mouvements_stock(date_mouvement);
CREATE INDEX IF NOT EXISTS idx_journal_caisse_date ON journal_caisse(date_journal);
CREATE INDEX IF NOT EXISTS idx_journal_caisse_type ON journal_caisse(type_mouvement);
CREATE INDEX IF NOT EXISTS idx_journal_caisse_categorie ON journal_caisse(categorie);
CREATE INDEX IF NOT EXISTS idx_charges_date ON charges_fonctionnement(date_charge);
CREATE INDEX IF NOT EXISTS idx_recap_date ON recapitulatif_journalier(date_recap);

-- =====================================================
-- 20. DONNÉES PAR DÉFAUT
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

INSERT OR IGNORE INTO categories_charges (code_categorie, libelle) VALUES
('EAU', 'Eau'),
('ELECTRICITE', 'Électricité'),
('LOYER', 'Loyer'),
('SALAIRE', 'Salaire'),
('TRANSPORT', 'Transport'),
('COMMUNICATION', 'Communication'),
('AUTRE', 'Autres charges');
`;

export const getDb = async (): Promise<Database> => {
  if (dbInstance) return dbInstance;

  try {
    dbInstance = await Database.load('sqlite:gestion-commerciale.db');

    // 🔥 IMPORTANT
    await dbInstance.execute('PRAGMA foreign_keys = ON;');
    await dbInstance.execute('PRAGMA journal_mode = WAL;');
    await dbInstance.execute('PRAGMA synchronous = NORMAL;');
    await dbInstance.execute('PRAGMA busy_timeout = 30000;');

    console.log('✅ Base de données connectée');
    return dbInstance;

  } catch (error) {
    console.error('❌ Erreur de connexion:', error);
    throw error;
  }
};
// src/database/db.ts - Ajouter cette fonction
export async function debugLocks() {
  try {
    const db = await getDb();
    const result = await db.select(`
      SELECT 
        pid,
        status,
        sql
      FROM pragma_vfs_list()
    `);
    console.log('🔍 Verrous actifs:', result);
  } catch (error) {
    console.error('Erreur debug locks:', error);
  }
}

export const initDatabase = async (): Promise<void> => {
  try {
    const db = await getDb();
    
    console.log('🚀 Initialisation de la base de données...');
    
    // Exécuter le schéma complet
    await db.execute(SCHEMA_SQL);
    console.log('✅ Schéma SQL exécuté avec succès');
    
    // Vérification des tables principales
    const tables = await db.select<any[]>(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);
    
    console.log('📊 Tables créées:', tables.map(t => t.name).join(', '));
    
    // Vérifier que la table products a bien toutes les colonnes
    const columns = await db.select<any[]>(`
      PRAGMA table_info(products)
    `);
    
    console.log('📋 Colonnes de products:', columns.map(c => c.name).join(', '));
    
    // Vérifier les tables de crédits
    const creditTables = tables.filter(t => t.name === 'credits' || t.name === 'remboursements');
    if (creditTables.length > 0) {
      console.log('✅ Tables de crédits créées:', creditTables.map(t => t.name).join(', '));
    } else {
      console.warn('⚠️ Les tables de crédits n\'ont pas été créées');
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