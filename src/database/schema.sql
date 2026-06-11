PRAGMA foreign_keys = ON;

----------------------------------------------------
-- PRODUITS
----------------------------------------------------

CREATE TABLE IF NOT EXISTS products (
    idProduit INTEGER PRIMARY KEY AUTOINCREMENT,
    code_produit TEXT UNIQUE NOT NULL,
    designation TEXT NOT NULL,
    categorie TEXT,
    unite_base TEXT,
    prix_achat_base REAL DEFAULT 0,
    prix_vente_detail REAL DEFAULT 0,
    prix_vente_gros REAL DEFAULT 0,
    commission_pourcentage REAL DEFAULT 0,
    qte_stock REAL DEFAULT 0,
    seuil_alerte REAL DEFAULT 0,
    date_entree DATETIME DEFAULT CURRENT_TIMESTAMP,
    est_supprime INTEGER DEFAULT 0
);

----------------------------------------------------
-- CLIENTS
----------------------------------------------------

CREATE TABLE IF NOT EXISTS clients (
    idClient INTEGER PRIMARY KEY AUTOINCREMENT,
    NomComplet TEXT NOT NULL,
    Societe TEXT,
    Adresse TEXT,
    Tel TEXT,
    Email TEXT,
    Ville TEXT,
    TypeClient TEXT NOT NULL
        CHECK(TypeClient IN ('client','revendeur'))
);

----------------------------------------------------
-- COMMANDES
----------------------------------------------------

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

    FOREIGN KEY(idClient)
        REFERENCES clients(idClient)
);

----------------------------------------------------
-- DETAILS COMMANDE
----------------------------------------------------

CREATE TABLE IF NOT EXISTS commande_details (
    idDetail INTEGER PRIMARY KEY AUTOINCREMENT,
    idCommande INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    qte_commande REAL NOT NULL,
    prix_unitaire_vente REAL NOT NULL,

    FOREIGN KEY(idCommande)
        REFERENCES commandes(idCommande)
        ON DELETE CASCADE,

    FOREIGN KEY(idProduit)
        REFERENCES products(idProduit)
);

----------------------------------------------------
-- STOCK REVENDEUR
----------------------------------------------------
CREATE TABLE stock_revendeur (
    idStockRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,

    idProduit INTEGER NOT NULL,

    idRevendeur INTEGER NOT NULL,

    qte_stock REAL DEFAULT 0,

    prix_achat REAL DEFAULT 0,

    prix_vente REAL DEFAULT 0,

    commission_pourcentage REAL DEFAULT 0,

    UNIQUE(idProduit,idRevendeur)
);

----------------------------------------------------
-- DECOMPTES
----------------------------------------------------

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

    FOREIGN KEY(idClient)
        REFERENCES clients(idClient)
);

----------------------------------------------------
-- DETAILS DECOMPTE
----------------------------------------------------

CREATE TABLE IF NOT EXISTS decompte_details (

    idDetailRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,

    idDecompte INTEGER NOT NULL,

    idProduit INTEGER NOT NULL,

    qte_decompte REAL NOT NULL DEFAULT 0,

    prix_achat REAL DEFAULT 0,

    prix_vente REAL DEFAULT 0,

    commission_pourcentage REAL DEFAULT 0,

    FOREIGN KEY(idDecompte)
        REFERENCES decomptes(idDecompte)
        ON DELETE CASCADE,

    FOREIGN KEY(idProduit)
        REFERENCES products(idProduit)
);
----------------------------------------------------
-- VENTES
----------------------------------------------------

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

    FOREIGN KEY(idClient)
        REFERENCES clients(idClient)
);

----------------------------------------------------
-- DETAILS VENTE
----------------------------------------------------

CREATE TABLE IF NOT EXISTS vente_details (

    idDetail INTEGER PRIMARY KEY AUTOINCREMENT,

    idVente INTEGER NOT NULL,

    idProduit INTEGER NOT NULL,

    quantite REAL NOT NULL,

    prix_unitaire_ht REAL NOT NULL,

    prix_unitaire_ttc REAL NOT NULL,

    remise_percent REAL DEFAULT 0,

    tva_taux REAL DEFAULT 18,

    FOREIGN KEY(idVente)
        REFERENCES ventes(idVente)
        ON DELETE CASCADE,

    FOREIGN KEY(idProduit)
        REFERENCES products(idProduit)
);

CREATE INDEX IF NOT EXISTS idx_vente_date
ON ventes(date_vente);

CREATE INDEX IF NOT EXISTS idx_vente_client
ON ventes(idClient);

CREATE INDEX IF NOT EXISTS idx_vente_detail_vente
ON vente_details(idVente);

CREATE INDEX IF NOT EXISTS idx_vente_detail_produit
ON vente_details(idProduit);
----------------------------------------------------
-- MOUVEMENTS STOCK
----------------------------------------------------

CREATE TABLE IF NOT EXISTS mouvements_stock (
    idMouvement INTEGER PRIMARY KEY AUTOINCREMENT,
    idProduit INTEGER NOT NULL,
    type_mouvement TEXT NOT NULL,
    quantite REAL NOT NULL,
    stock_avant REAL NOT NULL,
    stock_apres REAL NOT NULL,
    date_mouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
    idCommande INTEGER,

    FOREIGN KEY(idProduit)
        REFERENCES products(idProduit)
);

----------------------------------------------------
-- MOUVEMENTS REVENDEUR
----------------------------------------------------

CREATE TABLE IF NOT EXISTS mouvements_revendeur (
    idMouvementRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
    idProduit INTEGER NOT NULL,
    idRevendeur INTEGER NOT NULL,
    idCommande INTEGER,
    idDecompte INTEGER,

    type_mouvement TEXT NOT NULL,
    qte_mouvement REAL NOT NULL,

    date_mouvement DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(idProduit)
        REFERENCES products(idProduit),

    FOREIGN KEY(idRevendeur)
        REFERENCES clients(idClient),

    FOREIGN KEY(idCommande)
        REFERENCES commandes(idCommande),

    FOREIGN KEY(idDecompte)
        REFERENCES decomptes(idDecompte)
);

----------------------------------------------------
-- FACTURES
----------------------------------------------------

CREATE TABLE IF NOT EXISTS factures (
    idFacture INTEGER PRIMARY KEY AUTOINCREMENT,
    code_facture TEXT UNIQUE NOT NULL,
    idClient INTEGER NOT NULL,
    idCommande INTEGER,
    date_facture DATETIME DEFAULT CURRENT_TIMESTAMP,
    montant_ttc REAL DEFAULT 0,
    montant_regle REAL DEFAULT 0,
    statut TEXT DEFAULT 'EN_ATTENTE',

    FOREIGN KEY(idClient)
        REFERENCES clients(idClient),

    FOREIGN KEY(idCommande)
        REFERENCES commandes(idCommande)
);

----------------------------------------------------
-- FACTURE DETAILS
----------------------------------------------------
CREATE TABLE facture_details (
    idDetailFacture INTEGER PRIMARY KEY AUTOINCREMENT,
    idFacture INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    qte REAL NOT NULL,
    prix_unitaire REAL NOT NULL,

    FOREIGN KEY(idFacture)
        REFERENCES factures(idFacture)
        ON DELETE CASCADE,

    FOREIGN KEY(idProduit)
        REFERENCES products(idProduit)
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

    FOREIGN KEY(idCommande)
        REFERENCES commandes(idCommande),

    FOREIGN KEY(idRevendeur)
        REFERENCES clients(idClient)
);

----------------------------------------------------
-- REGLEMENTS
----------------------------------------------------

CREATE TABLE IF NOT EXISTS reglements (
    idReglement INTEGER PRIMARY KEY AUTOINCREMENT,
    idFacture INTEGER NOT NULL,
    montant REAL NOT NULL,
    mode_reglement TEXT,
    date_reglement DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(idFacture)
        REFERENCES factures(idFacture)
);