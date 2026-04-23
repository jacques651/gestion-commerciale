-- =====================================================
-- APPLICATION DE GESTION COMMERCIALE
-- Base de données SQLite
-- Version: 1.0.0
-- =====================================================

CREATE TABLE IF NOT EXISTS clients (
  idClient INTEGER PRIMARY KEY AUTOINCREMENT,
  code_client TEXT UNIQUE NOT NULL,
  nom_complet TEXT NOT NULL,
  societe TEXT,
  type_client TEXT CHECK(type_client IN ('PARTICULIER', 'REVENDEUR', 'ENTREPRISE')) DEFAULT 'PARTICULIER',
  adresse TEXT,
  ville TEXT,
  telephone TEXT,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  est_actif INTEGER DEFAULT 1,
  est_supprime INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  idProduit INTEGER PRIMARY KEY AUTOINCREMENT,
  code_produit TEXT UNIQUE NOT NULL,
  categorie TEXT NOT NULL,
  designation TEXT NOT NULL,
  unite_base TEXT DEFAULT 'pièce',
  prix_achat_base REAL DEFAULT 0,
  prix_vente_detail REAL DEFAULT 0,
  prix_vente_gros REAL DEFAULT 0,
  seuil_alerte REAL DEFAULT 0,
  commission_pourcentage REAL DEFAULT 0,
  qte_stock REAL DEFAULT 0,
  date_entree DATETIME DEFAULT CURRENT_TIMESTAMP,
  est_supprime INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS commandes (
  idCommande INTEGER PRIMARY KEY AUTOINCREMENT,
  code_commande TEXT UNIQUE NOT NULL,
  idClient INTEGER NOT NULL,
  type_commande TEXT CHECK(type_commande IN ('SIMPLE', 'REVENDEUR')) NOT NULL,
  date_commande DATETIME DEFAULT CURRENT_TIMESTAMP,
  objet TEXT,
  montant_ht REAL DEFAULT 0,
  montant_ttc REAL DEFAULT 0,
  statut TEXT DEFAULT 'CONFIRMEE',
  code_facture TEXT,
  date_facture DATE,
  FOREIGN KEY (idClient) REFERENCES clients(idClient)
);

CREATE TABLE IF NOT EXISTS commande_details (
  idCommande INTEGER NOT NULL,
  idProduit INTEGER NOT NULL,
  qte_commande REAL NOT NULL,
  prix_unitaire_vente REAL NOT NULL,
  FOREIGN KEY (idCommande) REFERENCES commandes(idCommande) ON DELETE CASCADE,
  FOREIGN KEY (idProduit) REFERENCES products(idProduit),
  PRIMARY KEY (idCommande, idProduit)
);

CREATE TABLE IF NOT EXISTS decomptes (
  idDecompte INTEGER PRIMARY KEY AUTOINCREMENT,
  code_decompte TEXT UNIQUE NOT NULL,
  idClient INTEGER NOT NULL,
  date_decompte DATETIME DEFAULT CURRENT_TIMESTAMP,
  montant_ht REAL DEFAULT 0,
  montant_ttc REAL DEFAULT 0,
  statut TEXT DEFAULT 'EN_ATTENTE',
  FOREIGN KEY (idClient) REFERENCES clients(idClient)
);

CREATE TABLE IF NOT EXISTS decompte_details (
  idDetail INTEGER PRIMARY KEY AUTOINCREMENT,
  idDecompte INTEGER NOT NULL,
  idProduit INTEGER NOT NULL,
  quantite_vendue REAL NOT NULL,
  prix_vente REAL NOT NULL,
  prix_achat REAL NOT NULL,
  commission REAL DEFAULT 0,
  FOREIGN KEY (idDecompte) REFERENCES decomptes(idDecompte) ON DELETE CASCADE,
  FOREIGN KEY (idProduit) REFERENCES products(idProduit)
);

CREATE TABLE IF NOT EXISTS ventes (
  idVente INTEGER PRIMARY KEY AUTOINCREMENT,
  code_vente TEXT UNIQUE NOT NULL,
  idClient INTEGER,
  nom_prenom TEXT NOT NULL,
  contact TEXT,
  date_vente DATETIME DEFAULT CURRENT_TIMESTAMP,
  montant_total REAL DEFAULT 0,
  type_vente TEXT DEFAULT 'COMPTOIR',
  observation TEXT,
  FOREIGN KEY (idClient) REFERENCES clients(idClient)
);

CREATE TABLE IF NOT EXISTS reglements (
  idReglement INTEGER PRIMARY KEY AUTOINCREMENT,
  code_reglement TEXT UNIQUE NOT NULL,
  idClient INTEGER,
  idFacture INTEGER,
  idDecompte INTEGER,
  date_reglement DATETIME DEFAULT CURRENT_TIMESTAMP,
  montant_regle REAL NOT NULL,
  mode_reglement TEXT,
  reference TEXT,
  observation TEXT,
  FOREIGN KEY (idClient) REFERENCES clients(idClient),
  FOREIGN KEY (idFacture) REFERENCES factures(idFacture),
  FOREIGN KEY (idDecompte) REFERENCES decomptes(idDecompte)
);

CREATE TABLE IF NOT EXISTS factures (
  idFacture INTEGER PRIMARY KEY AUTOINCREMENT,
  code_facture TEXT UNIQUE NOT NULL,
  idCommande INTEGER NOT NULL,
  date_facture DATETIME DEFAULT CURRENT_TIMESTAMP,
  montant_ht REAL NOT NULL,
  montant_ttc REAL NOT NULL,
  statut TEXT DEFAULT 'EN_ATTENTE',
  FOREIGN KEY (idCommande) REFERENCES commandes(idCommande)
);

CREATE TABLE IF NOT EXISTS stock_revendeur (
  idStock INTEGER PRIMARY KEY AUTOINCREMENT,
  idRevendeur INTEGER NOT NULL,
  idProduit INTEGER NOT NULL,
  quantite_commande REAL DEFAULT 0,
  quantite_vendue REAL DEFAULT 0,
  quantite_restante REAL GENERATED ALWAYS AS (quantite_commande - quantite_vendue) STORED,
  FOREIGN KEY (idRevendeur) REFERENCES clients(idClient),
  FOREIGN KEY (idProduit) REFERENCES products(idProduit),
  UNIQUE(idRevendeur, idProduit)
);

CREATE TABLE IF NOT EXISTS utilisateurs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  mot_de_passe_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'commercial',
  est_actif INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

CREATE INDEX IF NOT EXISTS idx_clients_code ON clients(code_client);
CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(type_client);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code_produit);
CREATE INDEX IF NOT EXISTS idx_commandes_client ON commandes(idClient);
CREATE INDEX IF NOT EXISTS idx_commandes_type ON commandes(type_commande);
CREATE INDEX IF NOT EXISTS idx_decomptes_client ON decomptes(idClient);
CREATE INDEX IF NOT EXISTS idx_reglements_client ON reglements(idClient);

INSERT OR IGNORE INTO configuration_atelier (id, nom_atelier) VALUES (1, 'MON ATELIER');
