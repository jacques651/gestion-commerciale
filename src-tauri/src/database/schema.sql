-- =====================================================
-- LOGICIEL DE GESTION COMMERCIALE UNIVERSEL
-- Base de données SQLite
-- Version: 3.0.0
-- =====================================================

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

CREATE TABLE IF NOT EXISTS config_commerce (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    id_type_commerce INTEGER NOT NULL,
    modules_actifs TEXT DEFAULT '[]',
    parametres TEXT DEFAULT '{}',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_type_commerce) REFERENCES config_types_commerce(id_type_commerce)
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
-- 2. STRUCTURE COMMERCIALE
-- =====================================================


-- =====================================================
-- 3. REFERENTIEL PRODUITS
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
    code_barres TEXT,
    idCategorie INTEGER,
    idMarque INTEGER,
    idUnite_vente INTEGER NOT NULL,
    idUnite_achat INTEGER NOT NULL,
    designation TEXT NOT NULL,
    description TEXT,
    reference_fournisseur TEXT,
    idFournisseur_principal INTEGER,
    prix_achat_ht REAL DEFAULT 0,
    prix_vente_ht REAL DEFAULT 0,
    prix_vente_ttc REAL DEFAULT 0,
    prix_promo_ht REAL DEFAULT 0,
    prix_promo_ttc REAL DEFAULT 0,
    date_debut_promo DATE,
    date_fin_promo DATE,
    stock_minimum REAL DEFAULT 0,
    stock_maximum REAL DEFAULT 0,
    stock_alerte REAL DEFAULT 0,
    stock_physique REAL DEFAULT 0,
    stock_reserve REAL DEFAULT 0,
    poids_unitaire REAL DEFAULT 0,
    volume_unitaire REAL DEFAULT 0,
    tva_id INTEGER,
    commission_pourcentage REAL DEFAULT 0,
    est_servie INTEGER DEFAULT 0,
    est_actif INTEGER DEFAULT 1,
    est_supprime INTEGER DEFAULT 0,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_modification DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idCategorie) REFERENCES categories(idCategorie),
    FOREIGN KEY (idMarque) REFERENCES marques(idMarque),
    FOREIGN KEY (idUnite_vente) REFERENCES unites(idUnite),
    FOREIGN KEY (idUnite_achat) REFERENCES unites(idUnite),
    FOREIGN KEY (idFournisseur_principal) REFERENCES fournisseurs(idFournisseur),
    FOREIGN KEY (tva_id) REFERENCES config_tva(id_tva)
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

CREATE TABLE IF NOT EXISTS prix_client (
    idPrixClient INTEGER PRIMARY KEY AUTOINCREMENT,
    idClient INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    prix_ht REAL NOT NULL,
    date_debut DATE,
    date_fin DATE,
    FOREIGN KEY (idClient) REFERENCES clients(idClient),
    FOREIGN KEY (idProduit) REFERENCES products(idProduit),
    UNIQUE(idClient, idProduit)
);


CREATE TABLE IF NOT EXISTS lots (
    idLot INTEGER PRIMARY KEY AUTOINCREMENT,
    code_lot TEXT UNIQUE NOT NULL,
    idProduit INTEGER NOT NULL,
    idFournisseur INTEGER,
    quantite_initial REAL NOT NULL,
    quantite_restante REAL NOT NULL,
    date_fabrication DATE,
    date_peremption DATE,
    date_reception DATETIME DEFAULT CURRENT_TIMESTAMP,
    prix_achat REAL,
    numero_facture_fournisseur TEXT,
    emplacement TEXT,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit),
    FOREIGN KEY (idFournisseur) REFERENCES fournisseurs(idFournisseur)
);

-- =====================================================
-- 4. CLIENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS clients (
    idClient INTEGER PRIMARY KEY AUTOINCREMENT,
    code_client TEXT UNIQUE NOT NULL,
    type_client TEXT DEFAULT 'PARTICULIER',
    civilite TEXT,
    nom TEXT,
    prenom TEXT,
    raison_sociale TEXT,
    numero_contribuable TEXT,
    adresse TEXT,
    adresse_livraison TEXT,
    ville TEXT,
    code_postal TEXT,
    pays TEXT DEFAULT 'CI',
    telephone1 TEXT,
    telephone2 TEXT,
    email TEXT,
    site_web TEXT,
    idGroupe_client INTEGER,
    idCategorie_client INTEGER,
    plafond_credit REAL DEFAULT 0,
    encours_credit REAL DEFAULT 0,
    delai_paiement_jours INTEGER DEFAULT 0,
    remise_percent REAL DEFAULT 0,
    idTarif_groupe INTEGER,
    est_actif INTEGER DEFAULT 1,
    est_supprime INTEGER DEFAULT 0,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_modification DATETIME DEFAULT CURRENT_TIMESTAMP,
    dernier_achat DATE,
    observations TEXT
);

CREATE TABLE IF NOT EXISTS groupes_clients (
    idGroupe INTEGER PRIMARY KEY AUTOINCREMENT,
    code_groupe TEXT UNIQUE NOT NULL,
    libelle TEXT NOT NULL,
    remise_percent REAL DEFAULT 0,
    delai_paiement_jours INTEGER DEFAULT 0,
    est_actif INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS categories_clients (
    idCategorie INTEGER PRIMARY KEY AUTOINCREMENT,
    code_categorie TEXT UNIQUE NOT NULL,
    libelle TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS contacts_clients (
    idContact INTEGER PRIMARY KEY AUTOINCREMENT,
    idClient INTEGER NOT NULL,
    civilite TEXT,
    nom TEXT NOT NULL,
    prenom TEXT,
    fonction TEXT,
    telephone TEXT,
    email TEXT,
    est_principal INTEGER DEFAULT 0,
    FOREIGN KEY (idClient) REFERENCES clients(idClient)
);

-- =====================================================
-- 5. COMMANDES
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
    idFacture INTEGER,
    FOREIGN KEY (idClient) REFERENCES clients(idClient),
);

CREATE TABLE IF NOT EXISTS commande_details (
    idDetail INTEGER PRIMARY KEY AUTOINCREMENT,
    idCommande INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    idConditionnement INTEGER,
    quantite REAL NOT NULL,
    prix_unitaire_ht REAL NOT NULL,
    prix_unitaire_ttc REAL NOT NULL,
    remise_percent REAL DEFAULT 0,
    remise_montant REAL DEFAULT 0,
    tva_taux REAL DEFAULT 0,
    FOREIGN KEY (idCommande) REFERENCES commandes(idCommande) ON DELETE CASCADE,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit),
    FOREIGN KEY (idConditionnement) REFERENCES conditionnements(idConditionnement)
);

-- =====================================================
-- 6. FACTURES
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
    FOREIGN KEY (idCommande) REFERENCES commandes(idCommande),
    
);

-- =====================================================
-- 7. VENTES
-- =====================================================

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
-- 8. REGLEMENTS
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

CREATE TABLE IF NOT EXISTS lettrage_factures (
    idLettrage INTEGER PRIMARY KEY AUTOINCREMENT,
    idFacture INTEGER NOT NULL,
    idReglement INTEGER NOT NULL,
    montant_applique REAL NOT NULL,
    date_lettrage DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idFacture) REFERENCES factures(idFacture),
    FOREIGN KEY (idReglement) REFERENCES reglements(idReglement)
);

-- =====================================================
-- 9. MOUVEMENTS STOCK
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
    FOREIGN KEY (idConditionnement) REFERENCES conditionnements(idConditionnement),
    FOREIGN KEY (idLot) REFERENCES lots(idLot),
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
);


CREATE TABLE IF NOT EXISTS inventaires (
    idInventaire INTEGER PRIMARY KEY AUTOINCREMENT,
    code_inventaire TEXT UNIQUE NOT NULL,
    date_debut DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_fin DATETIME,
    statut TEXT DEFAULT 'EN_COURS',
    observations TEXT,
    idUtilisateur INTEGER,
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
);

CREATE TABLE IF NOT EXISTS inventaire_details (
    idInventaire INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    quantite_theorique REAL NOT NULL,
    quantite_reelle REAL NOT NULL,
    observation TEXT,
    FOREIGN KEY (idInventaire) REFERENCES inventaires(idInventaire),
    FOREIGN KEY (idProduit) REFERENCES products(idProduit),
    PRIMARY KEY (idInventaire, idProduit)
);

-- =====================================================
-- 10. HISTORIQUE ET AUDIT
-- =====================================================

CREATE TABLE IF NOT EXISTS historique_statuts (
    idHistorique INTEGER PRIMARY KEY AUTOINCREMENT,
    entite_type TEXT NOT NULL,
    entite_id INTEGER NOT NULL,
    ancien_statut TEXT,
    nouveau_statut TEXT NOT NULL,
    commentaire TEXT,
    date_changement DATETIME DEFAULT CURRENT_TIMESTAMP,
    idUtilisateur INTEGER,
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
);

CREATE TABLE IF NOT EXISTS historique_prix (
    idHistoriquePrix INTEGER PRIMARY KEY AUTOINCREMENT,
    idProduit INTEGER NOT NULL,
    idConditionnement INTEGER,
    type_prix TEXT,
    ancien_prix REAL NOT NULL,
    nouveau_prix REAL NOT NULL,
    date_changement DATETIME DEFAULT CURRENT_TIMESTAMP,
    motif TEXT,
    idUtilisateur INTEGER,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit),
    FOREIGN KEY (idConditionnement) REFERENCES conditionnements(idConditionnement),
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
);

CREATE TABLE IF NOT EXISTS journal_connexions (
    idConnexion INTEGER PRIMARY KEY AUTOINCREMENT,
    idUtilisateur INTEGER,
    login TEXT,
    date_connexion DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    statut TEXT,
    message TEXT,
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
);

-- =====================================================
-- 11. UTILISATEURS ET SECURITE
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
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
);

CREATE TABLE IF NOT EXISTS permissions (
    idPermission INTEGER PRIMARY KEY AUTOINCREMENT,
    code_permission TEXT UNIQUE NOT NULL,
    libelle TEXT NOT NULL,
    categorie TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
    idRole INTEGER PRIMARY KEY AUTOINCREMENT,
    code_role TEXT UNIQUE NOT NULL,
    libelle TEXT NOT NULL,
    niveau INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS role_permissions (
    idRole INTEGER NOT NULL,
    idPermission INTEGER NOT NULL,
    PRIMARY KEY (idRole, idPermission),
    FOREIGN KEY (idRole) REFERENCES roles(idRole),
    FOREIGN KEY (idPermission) REFERENCES permissions(idPermission)
);

CREATE TABLE IF NOT EXISTS utilisateur_roles (
    idUtilisateur INTEGER NOT NULL,
    idRole INTEGER NOT NULL,
    PRIMARY KEY (idUtilisateur, idRole),
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id),
    FOREIGN KEY (idRole) REFERENCES roles(idRole)
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
-- 13. DONNEES INITIALES
-- =====================================================

INSERT OR IGNORE INTO config_generale (id_config, nom_application, devise, taux_tva_default) 
VALUES (1, 'Gestion Commerciale Pro', 'FCFA', 18);

INSERT OR IGNORE INTO config_modules (code_module, nom_module, ordre_affichage) VALUES
('VENTES', 'Ventes', 1),
('STOCK', 'Gestion de stock', 2),
('CLIENTS', 'Clients', 3),
('PRODUITS', 'Produits', 4),
('FINANCES', 'Finances', 5),
('RAPPORTS', 'Rapports', 6),
('CONFIGURATION', 'Configuration', 7);

INSERT OR IGNORE INTO config_types_commerce (code_type, libelle, description, parametres_par_defaut) VALUES
('DETAIL', 'Commerce de détail', 'Boutique, supermarché, commerce de proximité', 
 '{"tva_default":18,"devise":"FCFA","gestion_stock":true,"gestion_commandes":false,"gestion_factures":true,"gestion_reglements":true,"multi_magasins":false,"lots_tracabilite":false,"remises_auto":false}'),
('GROS', 'Commerce de gros', 'Distribution, semi-gros, fournisseur',
 '{"tva_default":18,"devise":"FCFA","gestion_stock":true,"gestion_commandes":true,"gestion_factures":true,"gestion_reglements":true,"multi_magasins":false,"lots_tracabilite":true,"remises_auto":true}'),
('MIXTE', 'Commerce mixte', 'Détail + gros, hybride',
 '{"tva_default":18,"devise":"FCFA","gestion_stock":true,"gestion_commandes":true,"gestion_factures":true,"gestion_reglements":true,"multi_magasins":true,"lots_tracabilite":true,"remises_auto":true}'),
('SERVICE', 'Prestation de services', 'Atelier, réparation, service',
 '{"tva_default":18,"devise":"FCFA","gestion_stock":false,"gestion_commandes":true,"gestion_factures":true,"gestion_reglements":true,"multi_magasins":false,"lots_tracabilite":false,"remises_auto":false}'),
('E_COMMERCE', 'E-commerce', 'Vente en ligne, livraison',
 '{"tva_default":18,"devise":"FCFA","gestion_stock":true,"gestion_commandes":true,"gestion_factures":true,"gestion_reglements":true,"multi_magasins":false,"lots_tracabilite":false,"remises_auto":true}');

INSERT OR IGNORE INTO config_statuts (entite_type, code_statut, libelle, couleur, ordre, est_initial, est_final) VALUES
('COMMANDE', 'BROUILLON', 'Brouillon', '#808080', 1, 1, 0),
('COMMANDE', 'CONFIRMEE', 'Confirmée', '#3498db', 2, 0, 0),
('COMMANDE', 'EN_PREPARATION', 'En préparation', '#e67e22', 3, 0, 0),
('COMMANDE', 'EXPEDIEE', 'Expediée', '#9b59b6', 4, 0, 0),
('COMMANDE', 'LIVREE', 'Livrée', '#27ae60', 5, 0, 0),
('COMMANDE', 'ANNULEE', 'Annulée', '#e74c3c', 6, 0, 1),
('FACTURE', 'EN_ATTENTE', 'En attente', '#f39c12', 1, 1, 0),
('FACTURE', 'PARTIELLEMENT_REGLEE', 'Partiellement réglée', '#3498db', 2, 0, 0),
('FACTURE', 'REGLEE', 'Réglée', '#27ae60', 3, 0, 1),
('FACTURE', 'ANNULEE', 'Annulée', '#e74c3c', 4, 0, 1);

INSERT OR IGNORE INTO config_modes_reglement (code_mode, libelle, necessite_reference) VALUES
('ESPECES', 'Espèces', 0),
('CHEQUE', 'Chèque', 1),
('VIREMENT', 'Virement bancaire', 1),
('CARTE', 'Carte bancaire', 1),
('MOBILE_MONEY', 'Mobile Money', 1),
('CREDIT', 'Crédit client', 0);

INSERT OR IGNORE INTO config_tva (code_tva, taux, libelle, est_defaut) VALUES
('TVA0', 0, 'TVA 0%', 0),
('TVA18', 18, 'TVA 18%', 1),
('EXONERE', 0, 'Exonéré', 0);

INSERT OR IGNORE INTO unites (code_unite, nom_unite, symbole, categorie_unite, est_unite_base) VALUES
('PC', 'Pièce', 'pc', 'QUANTITE', 1),
('KG', 'Kilogramme', 'kg', 'POIDS', 1),
('G', 'Gramme', 'g', 'POIDS', 0),
('M', 'Mètre', 'm', 'LONGUEUR', 1),
('CM', 'Centimètre', 'cm', 'LONGUEUR', 0),
('L', 'Litre', 'l', 'VOLUME', 1),
('ML', 'Millilitre', 'ml', 'VOLUME', 0),
('HEURE', 'Heure', 'h', 'DUREE', 1),
('JOUR', 'Jour', 'j', 'DUREE', 0),
('LOT10', 'Lot de 10', 'lot10', 'QUANTITE', 0),
('LOT25', 'Lot de 25', 'lot25', 'QUANTITE', 0),
('LOT50', 'Lot de 50', 'lot50', 'QUANTITE', 0),
('LOT100', 'Lot de 100', 'lot100', 'QUANTITE', 0),
('DOUZAINE', 'Douzaine', 'douz', 'QUANTITE', 0),
('BOITE', 'Boîte', 'bt', 'QUANTITE', 0),
('CARTON', 'Carton', 'ctn', 'QUANTITE', 0),
('CAISSE', 'Caisse', 'cse', 'QUANTITE', 0),
('PACK', 'Pack', 'pck', 'QUANTITE', 0),
('ROULEAU', 'Rouleau', 'rl', 'QUANTITE', 0);

INSERT OR IGNORE INTO roles (code_role, libelle, niveau) VALUES
('ADMIN', 'Administrateur', 100),
('MANAGER', 'Gestionnaire', 80),
('COMMERCIAL', 'Commercial', 50),
('CAISSIER', 'Caissier', 30),
('STOCKISTE', 'Stockiste', 30),
('COMPTABLE', 'Comptable', 70),
('INVITE', 'Invité', 10);

INSERT OR IGNORE INTO utilisateurs (nom, login, mot_de_passe_hash, role, est_actif) 
VALUES ('Administrateur', 'admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ADMIN', 1);

INSERT OR IGNORE INTO magasins (code_magasin, nom_magasin, est_principal, est_actif) 
VALUES ('MAG-001', 'Magasin Principal', 1, 1);

INSERT OR IGNORE INTO config_commerce (id, id_type_commerce, modules_actifs, parametres) 
VALUES (1, 1, '[]', '{"tva_default":18,"devise":"FCFA"}');

INSERT OR IGNORE INTO configuration_atelier (id, nom_atelier) VALUES (1, 'MON ATELIER');

-- =====================================================
-- 14. INDEX
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_products_code ON products(code_produit);
CREATE INDEX IF NOT EXISTS idx_products_code_barres ON products(code_barres);
CREATE INDEX IF NOT EXISTS idx_products_categorie ON products(idCategorie);
CREATE INDEX IF NOT EXISTS idx_products_marque ON products(idMarque);
CREATE INDEX IF NOT EXISTS idx_products_actif ON products(est_actif);
CREATE INDEX IF NOT EXISTS idx_clients_code ON clients(code_client);
CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(type_client);
CREATE INDEX IF NOT EXISTS idx_clients_nom ON clients(nom);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_commandes_client ON commandes(idClient);
CREATE INDEX IF NOT EXISTS idx_commandes_date ON commandes(date_commande);
CREATE INDEX IF NOT EXISTS idx_commandes_statut ON commandes(statut);
CREATE INDEX IF NOT EXISTS idx_ventes_date ON ventes(date_vente);
CREATE INDEX IF NOT EXISTS idx_ventes_client ON ventes(idClient);
CREATE INDEX IF NOT EXISTS idx_factures_client ON factures(idClient);
CREATE INDEX IF NOT EXISTS idx_factures_date ON factures(date_facture);
CREATE INDEX IF NOT EXISTS idx_factures_statut ON factures(statut);
CREATE INDEX IF NOT EXISTS idx_factures_echeance ON factures(date_echeance);
CREATE INDEX IF NOT EXISTS idx_reglements_client ON reglements(idClient);
CREATE INDEX IF NOT EXISTS idx_reglements_date ON reglements(date_reglement);
CREATE INDEX IF NOT EXISTS idx_reglements_facture ON reglements(idFacture);
CREATE INDEX IF NOT EXISTS idx_mouvements_produit ON mouvements_stock(idProduit);
CREATE INDEX IF NOT EXISTS idx_mouvements_date ON mouvements_stock(date_mouvement);
CREATE INDEX IF NOT EXISTS idx_mouvements_type ON mouvements_stock(type_mouvement);
CREATE INDEX IF NOT EXISTS idx_lots_produit ON lots(idProduit);
CREATE INDEX IF NOT EXISTS idx_lots_peremption ON lots(date_peremption);
CREATE INDEX IF NOT EXISTS idx_lots_code ON lots(code_lot);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_chemin ON categories(chemin);

-- =====================================================
-- 15. TRIGGERS
-- =====================================================

CREATE TRIGGER IF NOT EXISTS trigger_update_product_date 
AFTER UPDATE ON products
BEGIN
    UPDATE products SET date_modification = CURRENT_TIMESTAMP 
    WHERE idProduit = NEW.idProduit;
END;

CREATE TRIGGER IF NOT EXISTS trigger_update_stock_after_mouvement
AFTER INSERT ON mouvements_stock
BEGIN
    UPDATE products 
    SET stock_physique = NEW.stock_apres
    WHERE idProduit = NEW.idProduit;
END;

CREATE TRIGGER IF NOT EXISTS trigger_update_client_encours
AFTER INSERT ON reglements
WHEN NEW.idClient IS NOT NULL
BEGIN
    UPDATE clients 
    SET encours_credit = (
        SELECT COALESCE(SUM(montant_ttc - montant_regle), 0)
        FROM factures 
        WHERE idClient = NEW.idClient AND statut NOT IN ('REGLEE', 'ANNULEE')
    )
    WHERE idClient = NEW.idClient;
END;

CREATE TRIGGER IF NOT EXISTS trigger_check_client_credit
BEFORE INSERT ON commandes
WHEN NEW.idClient IS NOT NULL
BEGIN
    SELECT CASE
        WHEN (
            SELECT (c.encours_credit + NEW.montant_ttc) > c.plafond_credit
            FROM clients c 
            WHERE c.idClient = NEW.idClient AND c.plafond_credit > 0
        ) 
        THEN RAISE(ABORT, 'Dépassement du plafond de crédit client')
    END;
END;