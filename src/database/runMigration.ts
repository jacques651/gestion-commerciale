// src/database/runMigration.ts
import { getDb } from './db';

// ==================== FONCTION LOG ====================
const log = (message: string) => {
  console.log(`[Migration] ${message}`);
};

// ==================== SCHEMA SQL COMPLET ====================
const SCHEMA_SQL = `
  -- ============================================================
  -- TABLE : config_generale
  -- ============================================================
  CREATE TABLE IF NOT EXISTS config_generale (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nom_application TEXT,
    version TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ============================================================
  -- TABLE : clients
  -- ============================================================
  CREATE TABLE IF NOT EXISTS clients (
    idClient INTEGER PRIMARY KEY AUTOINCREMENT,
    code_client TEXT UNIQUE NOT NULL,
    raison_sociale TEXT NOT NULL,
    telephone TEXT,
    email TEXT,
    adresse TEXT,
    ifu TEXT,
    rccm TEXT,
    adresse_postale TEXT,
    type_client TEXT DEFAULT 'STANDARD',
    est_revendeur INTEGER DEFAULT 0,
    est_actif INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ============================================================
  -- TABLE : products
  -- ============================================================
  CREATE TABLE IF NOT EXISTS products (
    idProduit INTEGER PRIMARY KEY AUTOINCREMENT,
    code_produit TEXT UNIQUE NOT NULL,
    designation TEXT NOT NULL,
    description TEXT,
    prix_achat REAL DEFAULT 0,
    prix_vente REAL DEFAULT 0,
    prix_vente_ht REAL DEFAULT 0,
    stock_actuel REAL DEFAULT 0,
    seuil_alerte REAL DEFAULT 0,
    unite_mesure TEXT DEFAULT 'UNITE',
    methode_gestion_stock TEXT DEFAULT 'FIFO',
    commission_pourcentage REAL DEFAULT 0,
    est_actif INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ============================================================
  -- TABLE : commandes
  -- ============================================================
  CREATE TABLE IF NOT EXISTS commandes (
    idCommande INTEGER PRIMARY KEY AUTOINCREMENT,
    code_commande TEXT UNIQUE NOT NULL,
    idClient INTEGER NOT NULL,
    date_commande DATETIME DEFAULT CURRENT_TIMESTAMP,
    montant_ht REAL DEFAULT 0,
    montant_tva REAL DEFAULT 0,
    montant_remise REAL DEFAULT 0,
    montant_net REAL DEFAULT 0,
    statut TEXT DEFAULT 'EN_ATTENTE',
    type_commande TEXT DEFAULT 'STANDARD',
    adresse_livraison TEXT,
    source TEXT DEFAULT 'DIRECT',
    notes TEXT,
    signature_base64 TEXT,
    date_facture DATE,
    idUtilisateur INTEGER,
    taux_commission REAL DEFAULT 60,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idClient) REFERENCES clients(idClient),
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
  );

  -- ============================================================
  -- TABLE : commande_details
  -- ============================================================
  CREATE TABLE IF NOT EXISTS commande_details (
    idDetailCommande INTEGER PRIMARY KEY AUTOINCREMENT,
    idCommande INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    quantite REAL NOT NULL,
    prix_unitaire REAL NOT NULL,
    remise REAL DEFAULT 0,
    total REAL DEFAULT 0,
    idConditionnement INTEGER,
    FOREIGN KEY (idCommande) REFERENCES commandes(idCommande) ON DELETE CASCADE,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit)
  );

  -- ============================================================
  -- TABLE : factures
  -- ============================================================
  CREATE TABLE IF NOT EXISTS factures (
    idFacture INTEGER PRIMARY KEY AUTOINCREMENT,
    code_facture TEXT UNIQUE NOT NULL,
    idClient INTEGER NOT NULL,
    idCommande INTEGER,
    date_facture DATETIME DEFAULT CURRENT_TIMESTAMP,
    montant_ht REAL DEFAULT 0,
    montant_tva REAL DEFAULT 0,
    montant_ttc REAL DEFAULT 0,
    montant_regle REAL DEFAULT 0,
    statut TEXT DEFAULT 'EN_ATTENTE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idClient) REFERENCES clients(idClient),
    FOREIGN KEY (idCommande) REFERENCES commandes(idCommande)
  );

  -- ============================================================
  -- TABLE : facture_details
  -- ============================================================
  CREATE TABLE IF NOT EXISTS facture_details (
    idDetailFacture INTEGER PRIMARY KEY AUTOINCREMENT,
    idFacture INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    qte REAL NOT NULL,
    prix_unitaire REAL NOT NULL,
    FOREIGN KEY (idFacture) REFERENCES factures(idFacture) ON DELETE CASCADE,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit)
  );

  -- ============================================================
  -- TABLE : reglements
  -- ============================================================
  CREATE TABLE IF NOT EXISTS reglements (
    idReglement INTEGER PRIMARY KEY AUTOINCREMENT,
    idFacture INTEGER NOT NULL,
    idClient INTEGER,
    idVente INTEGER,
    montant REAL NOT NULL,
    mode_reglement TEXT,
    code_reglement TEXT,
    reference TEXT,
    banque TEXT,
    numero_cheque TEXT,
    date_valeur DATE,
    est_lettrage INTEGER DEFAULT 0,
    observation TEXT,
    date_reglement DATETIME DEFAULT CURRENT_TIMESTAMP,
    idUtilisateur INTEGER,
    idDecompte INTEGER,
    FOREIGN KEY (idFacture) REFERENCES factures(idFacture),
    FOREIGN KEY (idClient) REFERENCES clients(idClient)
  );

  -- ============================================================
  -- TABLE : utilisateurs
  -- ============================================================
  CREATE TABLE IF NOT EXISTS utilisateurs (
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
  );

  -- ============================================================
  -- TABLE : configuration_atelier
  -- ============================================================
  CREATE TABLE IF NOT EXISTS configuration_atelier (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nom_atelier TEXT,
    telephone TEXT,
    adresse TEXT,
    email TEXT,
    nif TEXT,
    ifu TEXT,
    rccm TEXT,
    adresse_postale TEXT,
    adresse_cadastrale TEXT,
    compte_bancaire TEXT,
    regime_fiscal TEXT,
    service_impots TEXT,
    forme_juridique TEXT,
    tva_active INTEGER DEFAULT 0,
    message_facture TEXT,
    logo_base64 TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ============================================================
  -- TABLE : config_commerce
  -- ============================================================
  CREATE TABLE IF NOT EXISTS config_commerce (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    id_type_commerce INTEGER NOT NULL DEFAULT 1,
    modules_actifs TEXT DEFAULT '[]',
    parametres TEXT DEFAULT '{}',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ============================================================
  -- TABLE : licence_application
  -- ============================================================
  CREATE TABLE IF NOT EXISTS licence_application (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    first_launch_date TEXT NOT NULL,
    licence_key TEXT,
    valid_activation_key TEXT,
    licence_type TEXT DEFAULT 'BETA' CHECK(licence_type IN ('BETA', 'DEFINITIF')),
    statut TEXT DEFAULT 'ACTIF' CHECK(statut IN ('ACTIF', 'EXPIRE')),
    trial_days INTEGER DEFAULT 60,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ============================================================
  -- TABLE : mouvements_stock
  -- ============================================================
  CREATE TABLE IF NOT EXISTS mouvements_stock (
    idMouvement INTEGER PRIMARY KEY AUTOINCREMENT,
    idProduit INTEGER NOT NULL,
    type_mouvement TEXT NOT NULL,
    quantite REAL NOT NULL,
    stock_avant REAL NOT NULL,
    stock_apres REAL NOT NULL,
    date_mouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
    idCommande INTEGER,
    prix_unitaire REAL,
    reference TEXT,
    notes TEXT,
    idLot INTEGER,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit)
  );

  -- ============================================================
  -- TABLE : lots_stock
  -- ============================================================
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
    FOREIGN KEY (idProduit) REFERENCES products(idProduit)
  );

  -- ============================================================
  -- TABLE : sorties_lots
  -- ============================================================
  CREATE TABLE IF NOT EXISTS sorties_lots (
    idSortieLot INTEGER PRIMARY KEY AUTOINCREMENT,
    idLot INTEGER NOT NULL,
    idMouvement INTEGER NOT NULL,
    quantite_sortie REAL NOT NULL,
    prix_vente_unitaire REAL NOT NULL,
    FOREIGN KEY (idLot) REFERENCES lots_stock(idLot),
    FOREIGN KEY (idMouvement) REFERENCES mouvements_stock(idMouvement)
  );

  -- ============================================================
  -- TABLE : historique_prix
  -- ============================================================
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
    FOREIGN KEY (idProduit) REFERENCES products(idProduit)
  );

  -- ============================================================
  -- TABLE : mouvements_revendeur
  -- ============================================================
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

  -- ============================================================
  -- TABLE : decomptes
  -- ============================================================
  CREATE TABLE IF NOT EXISTS decomptes (
    idDecompte INTEGER PRIMARY KEY AUTOINCREMENT,
    code_decompte TEXT UNIQUE NOT NULL,
    idRevendeur INTEGER NOT NULL,
    date_decompte DATETIME DEFAULT CURRENT_TIMESTAMP,
    periode_debut TEXT,
    periode_fin TEXT,
    montant_ht REAL DEFAULT 0,
    montant_commission REAL DEFAULT 0,
    montant_net REAL DEFAULT 0,
    taux_commission REAL DEFAULT 60,
    idFactureRevendeur INTEGER,
    id_facture_approvisionnement INTEGER,
    statut TEXT DEFAULT 'EN_ATTENTE',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idRevendeur) REFERENCES clients(idClient)
  );

  -- ============================================================
  -- TABLE : decompte_details
  -- ============================================================
  CREATE TABLE IF NOT EXISTS decompte_details (
    idDetailDecompte INTEGER PRIMARY KEY AUTOINCREMENT,
    idDecompte INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    designation TEXT,
    qte_avant_decompte REAL DEFAULT 0,
    qte_reappro REAL DEFAULT 0,
    prix_unitaire REAL DEFAULT 0,
    total REAL DEFAULT 0,
    benefice REAL DEFAULT 0,
    commission REAL DEFAULT 0,
    commission_pourcentage REAL DEFAULT 0,
    FOREIGN KEY (idDecompte) REFERENCES decomptes(idDecompte) ON DELETE CASCADE,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit)
  );

  -- ============================================================
  -- TABLE : factures_revendeur
  -- ============================================================
  CREATE TABLE IF NOT EXISTS factures_revendeur (
    idFactureRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
    idCommande INTEGER NOT NULL,
    idRevendeur INTEGER NOT NULL,
    code_facture TEXT UNIQUE,
    date_facture DATETIME DEFAULT CURRENT_TIMESTAMP,
    montant_ht REAL DEFAULT 0,
    montant_ttc REAL DEFAULT 0,
    commission REAL DEFAULT 0,
    taux_commission REAL DEFAULT 60,
    statut TEXT DEFAULT 'EN_ATTENTE',
    FOREIGN KEY (idCommande) REFERENCES commandes(idCommande),
    FOREIGN KEY (idRevendeur) REFERENCES clients(idClient)
  );

  -- ============================================================
  -- TABLE : factures_revendeur_details
  -- ============================================================
  CREATE TABLE IF NOT EXISTS factures_revendeur_details (
    idDetailFactureRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
    idFactureRevendeur INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    qte_commande REAL NOT NULL,
    prix_achat_base REAL DEFAULT 0,
    prix_unitaire_vente REAL NOT NULL,
    FOREIGN KEY (idFactureRevendeur) REFERENCES factures_revendeur(idFactureRevendeur) ON DELETE CASCADE,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit)
  );

  -- ============================================================
  -- TABLE : reglements_revendeur
  -- ============================================================
  CREATE TABLE IF NOT EXISTS reglements_revendeur (
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
  );

  -- ============================================================
  -- TABLE : factures_approvisionnement
  -- ============================================================
  CREATE TABLE IF NOT EXISTS factures_approvisionnement (
    idFactureAppro INTEGER PRIMARY KEY AUTOINCREMENT,
    code_facture TEXT UNIQUE NOT NULL,
    idRevendeur INTEGER NOT NULL,
    idDecompte INTEGER NOT NULL,
    date_facture DATETIME DEFAULT CURRENT_TIMESTAMP,
    montant_ht REAL DEFAULT 0,
    montant_ttc REAL DEFAULT 0,
    statut TEXT DEFAULT 'EN_ATTENTE',
    reference_decompte TEXT,
    notes TEXT,
    FOREIGN KEY (idRevendeur) REFERENCES clients(idClient),
    FOREIGN KEY (idDecompte) REFERENCES decomptes(idDecompte)
  );

  -- ============================================================
  -- TABLE : factures_approvisionnement_details
  -- ============================================================
  CREATE TABLE IF NOT EXISTS factures_approvisionnement_details (
    idDetailAppro INTEGER PRIMARY KEY AUTOINCREMENT,
    idFactureAppro INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    quantite REAL NOT NULL,
    prix_achat REAL NOT NULL,
    prix_vente REAL NOT NULL,
    total_ht REAL NOT NULL,
    total_ttc REAL NOT NULL,
    FOREIGN KEY (idFactureAppro) REFERENCES factures_approvisionnement(idFactureAppro) ON DELETE CASCADE,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit)
  );

  -- ============================================================
  -- TABLE : conditionnements
  -- ============================================================
  CREATE TABLE IF NOT EXISTS conditionnements (
    idConditionnement INTEGER PRIMARY KEY AUTOINCREMENT,
    idProduit INTEGER NOT NULL,
    libelle TEXT NOT NULL,
    quantite_par_unite_base REAL DEFAULT 1,
    prix_vente_ttc REAL DEFAULT 0,
    prix_vente_ht REAL DEFAULT 0,
    code_conditionnement TEXT,
    est_conditionnement_par_defaut INTEGER DEFAULT 0,
    est_actif INTEGER DEFAULT 1,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit)
  );

  -- ============================================================
  -- TABLE : vente_details
  -- ============================================================
  CREATE TABLE IF NOT EXISTS vente_details (
    idDetailVente INTEGER PRIMARY KEY AUTOINCREMENT,
    idVente INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    quantite REAL NOT NULL,
    prix_unitaire REAL NOT NULL,
    idConditionnement INTEGER,
    quantite_pieces REAL DEFAULT 0,
    libelle_conditionnement TEXT,
    FOREIGN KEY (idVente) REFERENCES ventes(idVente) ON DELETE CASCADE,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit)
  );

  -- ============================================================
  -- TABLE : ventes
  -- ============================================================
  CREATE TABLE IF NOT EXISTS ventes (
    idVente INTEGER PRIMARY KEY AUTOINCREMENT,
    code_vente TEXT UNIQUE NOT NULL,
    idClient INTEGER,
    date_vente DATETIME DEFAULT CURRENT_TIMESTAMP,
    montant_ht REAL DEFAULT 0,
    montant_tva REAL DEFAULT 0,
    montant_ttc REAL DEFAULT 0,
    statut TEXT DEFAULT 'EN_ATTENTE',
    type_vente TEXT DEFAULT 'COMPTOIR',
    idUtilisateur INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idClient) REFERENCES clients(idClient),
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
  );

  -- ============================================================
  -- TABLE : credits
  -- ============================================================
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
    date_echeance TEXT,
    statut TEXT NOT NULL DEFAULT 'EN_COURS' CHECK (statut IN ('EN_COURS', 'TERMINE', 'ANNULE')),
    idJournal INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal)
  );

  -- ============================================================
  -- TABLE : remboursements
  -- ============================================================
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

  -- ============================================================
  -- TABLE : journal_caisse
  -- ============================================================
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
    idSession INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id),
    FOREIGN KEY (idSession) REFERENCES sessions_caisse(idSession)
  );

  -- ============================================================
  -- TABLE : charges_fonctionnement
  -- ============================================================
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
    idSession INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal),
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
  );

  -- ============================================================
  -- TABLE : categories_charges
  -- ============================================================
  CREATE TABLE IF NOT EXISTS categories_charges (
    idCategorie INTEGER PRIMARY KEY AUTOINCREMENT,
    code_categorie TEXT UNIQUE NOT NULL,
    libelle TEXT NOT NULL,
    description TEXT,
    est_actif INTEGER DEFAULT 1
  );

  -- ============================================================
  -- TABLE : recapitulatif_journalier
  -- ============================================================
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

  -- ============================================================
  -- TABLE : sessions_caisse
  -- ============================================================
  CREATE TABLE IF NOT EXISTS sessions_caisse (
    idSession INTEGER PRIMARY KEY AUTOINCREMENT,
    code_session TEXT UNIQUE NOT NULL,
    nom_operateur TEXT NOT NULL,
    date_ouverture DATETIME DEFAULT CURRENT_TIMESTAMP,
    solde_initial REAL DEFAULT 0,
    solde_ouverture REAL DEFAULT 0,
    date_fermeture DATETIME,
    solde_calcule REAL,
    solde_declare REAL,
    ecart REAL DEFAULT 0,
    total_entrees REAL DEFAULT 0,
    total_sorties REAL DEFAULT 0,
    total_ventes REAL DEFAULT 0,
    total_reglements REAL DEFAULT 0,
    total_decomptes REAL DEFAULT 0,
    total_charges REAL DEFAULT 0,
    statut TEXT DEFAULT 'OUVERTE' CHECK(statut IN ('OUVERTE', 'FERMEE', 'BLOQUEE')),
    notes_ouverture TEXT,
    notes_fermeture TEXT,
    idUtilisateur INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
  );

  -- ============================================================
  -- TABLE : debug_logs
  -- ============================================================
  CREATE TABLE IF NOT EXISTS debug_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    level TEXT NOT NULL,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    stack TEXT,
    app_version TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ============================================================
  -- TABLE : revendeurs_ponctuels
  -- ============================================================
  CREATE TABLE IF NOT EXISTS revendeurs_ponctuels (
    idRevendeurPonctuel INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_complet TEXT NOT NULL,
    telephone TEXT NOT NULL,
    email TEXT,
    adresse TEXT,
    piece_identite TEXT,
    numero_piece TEXT,
    date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP,
    est_actif INTEGER DEFAULT 1,
    notes TEXT
  );

  -- ============================================================
  -- TABLE : mouvements_revendeurs (NOUVEAU - Cycle de vie)
  -- ============================================================
  CREATE TABLE IF NOT EXISTS mouvements_revendeurs (
    idMouvement INTEGER PRIMARY KEY AUTOINCREMENT,
    code_mouvement TEXT UNIQUE NOT NULL,
    idRevendeurPonctuel INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    date_sortie DATETIME DEFAULT CURRENT_TIMESTAMP,
    quantite_sortie REAL NOT NULL,
    prix_unitaire REAL NOT NULL,
    montant_total REAL NOT NULL,
    destination TEXT NOT NULL CHECK(destination IN ('PRESENTATION', 'VENTE')),
    statut TEXT DEFAULT 'EN_COURS' CHECK(statut IN ('EN_COURS', 'RETOURNE', 'VENDU', 'PARTIELLEMENT_RETOURNE', 'PARTIELLEMENT_VENDU', 'CLOTURE')),
    stock_avant_sortie REAL NOT NULL,
    stock_apres_sortie REAL NOT NULL,
    notes TEXT,
    idUtilisateur INTEGER,
    date_cloture DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idRevendeurPonctuel) REFERENCES revendeurs_ponctuels(idRevendeurPonctuel),
    FOREIGN KEY (idProduit) REFERENCES products(idProduit),
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
  );

  -- ============================================================
  -- TABLE : mouvement_evenements
  -- ============================================================
  CREATE TABLE IF NOT EXISTS mouvement_evenements (
    idEvenement INTEGER PRIMARY KEY AUTOINCREMENT,
    idMouvement INTEGER NOT NULL,
    type_evenement TEXT NOT NULL CHECK(type_evenement IN ('RETOUR', 'VENTE', 'PERTE', 'ECHANGE', 'AJUSTEMENT')),
    date_evenement DATETIME DEFAULT CURRENT_TIMESTAMP,
    quantite REAL NOT NULL,
    prix_unitaire REAL,
    montant REAL,
    etat TEXT CHECK(etat IN ('BON', 'ABIME', 'PERDU')),
    client_nom TEXT,
    client_contact TEXT,
    stock_avant REAL NOT NULL,
    stock_apres REAL NOT NULL,
    notes TEXT,
    idUtilisateur INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idMouvement) REFERENCES mouvements_revendeurs(idMouvement) ON DELETE CASCADE,
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
  );

  -- ============================================================
  -- TABLE : mouvement_etats
  -- ============================================================
  CREATE TABLE IF NOT EXISTS mouvement_etats (
    idEtat INTEGER PRIMARY KEY AUTOINCREMENT,
    idMouvement INTEGER NOT NULL,
    ancien_statut TEXT NOT NULL,
    nouveau_statut TEXT NOT NULL,
    date_changement DATETIME DEFAULT CURRENT_TIMESTAMP,
    raison TEXT,
    idUtilisateur INTEGER,
    FOREIGN KEY (idMouvement) REFERENCES mouvements_revendeurs(idMouvement) ON DELETE CASCADE,
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
  );

  -- ============================================================
  -- INDEX
  -- ============================================================
  CREATE INDEX IF NOT EXISTS idx_commandes_client ON commandes(idClient);
  CREATE INDEX IF NOT EXISTS idx_commandes_date ON commandes(date_commande);
  CREATE INDEX IF NOT EXISTS idx_commandes_statut ON commandes(statut);
  CREATE INDEX IF NOT EXISTS idx_factures_client ON factures(idClient);
  CREATE INDEX IF NOT EXISTS idx_factures_date ON factures(date_facture);
  CREATE INDEX IF NOT EXISTS idx_factures_statut ON factures(statut);
  CREATE INDEX IF NOT EXISTS idx_reglements_facture ON reglements(idFacture);
  CREATE INDEX IF NOT EXISTS idx_reglements_date ON reglements(date_reglement);
  CREATE INDEX IF NOT EXISTS idx_mouvements_stock_produit ON mouvements_stock(idProduit);
  CREATE INDEX IF NOT EXISTS idx_mouvements_stock_date ON mouvements_stock(date_mouvement);
  CREATE INDEX IF NOT EXISTS idx_lots_produit ON lots_stock(idProduit);
  CREATE INDEX IF NOT EXISTS idx_lots_date ON lots_stock(date_entree);
  CREATE INDEX IF NOT EXISTS idx_sorties_lot ON sorties_lots(idLot);
  CREATE INDEX IF NOT EXISTS idx_historique_produit ON historique_prix(idProduit);
  CREATE INDEX IF NOT EXISTS idx_mvt_rev_produit ON mouvements_revendeur(idProduit);
  CREATE INDEX IF NOT EXISTS idx_mvt_rev_revendeur ON mouvements_revendeur(idRevendeur);
  CREATE INDEX IF NOT EXISTS idx_credits_beneficiaire ON credits(beneficiaire);
  CREATE INDEX IF NOT EXISTS idx_credits_statut ON credits(statut);
  CREATE INDEX IF NOT EXISTS idx_credits_date ON credits(date_credit);
  CREATE INDEX IF NOT EXISTS idx_remboursements_idCredit ON remboursements(idCredit);
  CREATE INDEX IF NOT EXISTS idx_remboursements_date ON remboursements(date_remboursement);
  CREATE INDEX IF NOT EXISTS idx_journal_caisse_date ON journal_caisse(date_journal);
  CREATE INDEX IF NOT EXISTS idx_journal_caisse_type ON journal_caisse(type_mouvement);
  CREATE INDEX IF NOT EXISTS idx_journal_caisse_categorie ON journal_caisse(categorie);
  CREATE INDEX IF NOT EXISTS idx_charges_date ON charges_fonctionnement(date_charge);
  CREATE INDEX IF NOT EXISTS idx_recap_date ON recapitulatif_journalier(date_recap);
  CREATE INDEX IF NOT EXISTS idx_sessions_statut ON sessions_caisse(statut);
  CREATE INDEX IF NOT EXISTS idx_debug_logs_timestamp ON debug_logs(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_debug_logs_level ON debug_logs(level);
  
  -- Index pour les revendeurs ponctuels
  CREATE INDEX IF NOT EXISTS idx_mouvements_revendeur ON mouvements_revendeurs(idRevendeurPonctuel);
  CREATE INDEX IF NOT EXISTS idx_mouvements_produit ON mouvements_revendeurs(idProduit);
  CREATE INDEX IF NOT EXISTS idx_mouvements_date_sortie ON mouvements_revendeurs(date_sortie);
  CREATE INDEX IF NOT EXISTS idx_mouvements_statut ON mouvements_revendeurs(statut);
  CREATE INDEX IF NOT EXISTS idx_mouvements_code ON mouvements_revendeurs(code_mouvement);
  CREATE INDEX IF NOT EXISTS idx_evenements_mouvement ON mouvement_evenements(idMouvement);
  CREATE INDEX IF NOT EXISTS idx_evenements_date ON mouvement_evenements(date_evenement);
  CREATE INDEX IF NOT EXISTS idx_evenements_type ON mouvement_evenements(type_evenement);
  CREATE INDEX IF NOT EXISTS idx_etats_mouvement ON mouvement_etats(idMouvement);

  -- ============================================================
  -- DONNEES INITIALES
  -- ============================================================
  INSERT OR IGNORE INTO config_generale (id_config, nom_application, version) 
  VALUES (1, 'Gestion Commerciale Pro', '1.0.0');

  INSERT OR IGNORE INTO configuration_atelier (id, nom_atelier) 
  VALUES (1, 'MON COMMERCE');

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

  INSERT OR IGNORE INTO licence_application (id, first_launch_date, licence_type, statut, trial_days)
  VALUES (1, datetime('now'), 'BETA', 'ACTIF', 60);
`;

// ==================== FONCTION PRINCIPALE ====================
export const runSchemaMigration = async (): Promise<void> => {
  let db: any = null;
  
  try {
    log('🚀 Début de l\'exécution...');
    log('🔄 Connexion à la base de données...');
    
    db = await getDb();
    log('✅ Base de données connectée');

    // Vérifier si la table config_generale existe
    log('🔍 Vérification des tables existantes...');
    const tables = await db.select(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `) as { name: string }[];
    const tableNames = tables.map(t => t.name);
    log(`📊 Tables existantes: ${tableNames.join(', ')}`);

    const hasConfigGenerale = tableNames.includes('config_generale');

    if (!hasConfigGenerale) {
      log('⚠️ Schéma incomplet, exécution du schéma complet...');
      await db.execute(SCHEMA_SQL);
      log('✅ Schéma SQL exécuté avec succès');
    }

    // Vérifier et créer les tables manquantes spécifiquement
    const tablesToCreate = [
      'licence_application',
      'reglements_revendeur',
      'factures_revendeur_details',
      'factures_revendeur',
      'factures_approvisionnement',
      'factures_approvisionnement_details',
      'decomptes',
      'decompte_details',
      'credits',
      'remboursements',
      'journal_caisse',
      'charges_fonctionnement',
      'categories_charges',
      'recapitulatif_journalier',
      'sessions_caisse',
      'missions_revendeur',
      'mission_articles',
      'revendeurs_ponctuels',
      'mouvements_revendeurs',
      'mouvement_evenements',
      'mouvement_etats'
    ];

    for (const tableName of tablesToCreate) {
      if (!tableNames.includes(tableName)) {
        log(`⚠️ Table ${tableName} manquante, création...`);
        await createMissingTable(db, tableName);
      }
    }

    // Supprimer les anciennes tables si elles existent
    try {
      await db.execute(`DROP TABLE IF EXISTS emprunts_revendeurs`);
      await db.execute(`DROP TABLE IF EXISTS emprunt_details`);
      await db.execute(`DROP TABLE IF EXISTS mouvements_revendeurs_ponctuels`);
      log('✅ Anciennes tables des revendeurs ponctuels supprimées');
    } catch (e) {
      log('ℹ️ Les anciennes tables n\'existent pas');
    }

    // Exécuter les migrations
    log('🔄 Exécution des migrations complémentaires...');
    const migrationCount = await runMigrations(db);
    log(`✅ ${migrationCount} migration(s) appliquée(s)`);

    log('✅ Migration terminée avec succès');

  } catch (error) {
    log(`❌ Erreur: ${error}`);
    throw error;
  }
};

// ==================== FONCTION POUR CRÉER LES TABLES MANQUANTES ====================
const createMissingTable = async (db: any, tableName: string): Promise<void> => {
  const createQueries: Record<string, string> = {
    'reglements_revendeur': `
      CREATE TABLE IF NOT EXISTS reglements_revendeur (
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
    `,
    'factures_revendeur_details': `
      CREATE TABLE IF NOT EXISTS factures_revendeur_details (
        idDetailFactureRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
        idFactureRevendeur INTEGER NOT NULL,
        idProduit INTEGER NOT NULL,
        qte_commande REAL NOT NULL,
        prix_achat_base REAL DEFAULT 0,
        prix_unitaire_vente REAL NOT NULL,
        FOREIGN KEY (idFactureRevendeur) REFERENCES factures_revendeur(idFactureRevendeur) ON DELETE CASCADE,
        FOREIGN KEY (idProduit) REFERENCES products(idProduit)
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
        taux_commission REAL DEFAULT 60,
        statut TEXT DEFAULT 'EN_ATTENTE',
        FOREIGN KEY (idCommande) REFERENCES commandes(idCommande),
        FOREIGN KEY (idRevendeur) REFERENCES clients(idClient)
      )
    `,
    'factures_approvisionnement': `
      CREATE TABLE IF NOT EXISTS factures_approvisionnement (
        idFactureAppro INTEGER PRIMARY KEY AUTOINCREMENT,
        code_facture TEXT UNIQUE NOT NULL,
        idRevendeur INTEGER NOT NULL,
        idDecompte INTEGER NOT NULL,
        date_facture DATETIME DEFAULT CURRENT_TIMESTAMP,
        montant_ht REAL DEFAULT 0,
        montant_ttc REAL DEFAULT 0,
        statut TEXT DEFAULT 'EN_ATTENTE',
        reference_decompte TEXT,
        notes TEXT,
        FOREIGN KEY (idRevendeur) REFERENCES clients(idClient),
        FOREIGN KEY (idDecompte) REFERENCES decomptes(idDecompte)
      )
    `,
    'factures_approvisionnement_details': `
      CREATE TABLE IF NOT EXISTS factures_approvisionnement_details (
        idDetailAppro INTEGER PRIMARY KEY AUTOINCREMENT,
        idFactureAppro INTEGER NOT NULL,
        idProduit INTEGER NOT NULL,
        quantite REAL NOT NULL,
        prix_achat REAL NOT NULL,
        prix_vente REAL NOT NULL,
        total_ht REAL NOT NULL,
        total_ttc REAL NOT NULL,
        FOREIGN KEY (idFactureAppro) REFERENCES factures_approvisionnement(idFactureAppro) ON DELETE CASCADE,
        FOREIGN KEY (idProduit) REFERENCES products(idProduit)
      )
    `,
    'decomptes': `
      CREATE TABLE IF NOT EXISTS decomptes (
        idDecompte INTEGER PRIMARY KEY AUTOINCREMENT,
        code_decompte TEXT UNIQUE NOT NULL,
        idRevendeur INTEGER NOT NULL,
        date_decompte DATETIME DEFAULT CURRENT_TIMESTAMP,
        periode_debut TEXT,
        periode_fin TEXT,
        montant_ht REAL DEFAULT 0,
        montant_commission REAL DEFAULT 0,
        montant_net REAL DEFAULT 0,
        taux_commission REAL DEFAULT 60,
        idFactureRevendeur INTEGER,
        id_facture_approvisionnement INTEGER,
        statut TEXT DEFAULT 'EN_ATTENTE',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (idRevendeur) REFERENCES clients(idClient)
      )
    `,
    'decompte_details': `
      CREATE TABLE IF NOT EXISTS decompte_details (
        idDetailDecompte INTEGER PRIMARY KEY AUTOINCREMENT,
        idDecompte INTEGER NOT NULL,
        idProduit INTEGER NOT NULL,
        designation TEXT,
        qte_avant_decompte REAL DEFAULT 0,
        qte_reappro REAL DEFAULT 0,
        prix_unitaire REAL DEFAULT 0,
        total REAL DEFAULT 0,
        benefice REAL DEFAULT 0,
        commission REAL DEFAULT 0,
        commission_pourcentage REAL DEFAULT 0,
        FOREIGN KEY (idDecompte) REFERENCES decomptes(idDecompte) ON DELETE CASCADE,
        FOREIGN KEY (idProduit) REFERENCES products(idProduit)
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
        date_echeance TEXT,
        statut TEXT NOT NULL DEFAULT 'EN_COURS' CHECK (statut IN ('EN_COURS', 'TERMINE', 'ANNULE')),
        idJournal INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal)
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
        created_at TEXT NOT NULL,
        FOREIGN KEY (idCredit) REFERENCES credits(idCredit) ON DELETE CASCADE,
        FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal)
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
        idSession INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id),
        FOREIGN KEY (idSession) REFERENCES sessions_caisse(idSession)
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
        idSession INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal),
        FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
      )
    `,
    'categories_charges': `
      CREATE TABLE IF NOT EXISTS categories_charges (
        idCategorie INTEGER PRIMARY KEY AUTOINCREMENT,
        code_categorie TEXT UNIQUE NOT NULL,
        libelle TEXT NOT NULL,
        description TEXT,
        est_actif INTEGER DEFAULT 1
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
    `,
    'sessions_caisse': `
      CREATE TABLE IF NOT EXISTS sessions_caisse (
        idSession INTEGER PRIMARY KEY AUTOINCREMENT,
        code_session TEXT UNIQUE NOT NULL,
        nom_operateur TEXT NOT NULL,
        date_ouverture DATETIME DEFAULT CURRENT_TIMESTAMP,
        solde_initial REAL DEFAULT 0,
        solde_ouverture REAL DEFAULT 0,
        date_fermeture DATETIME,
        solde_calcule REAL,
        solde_declare REAL,
        ecart REAL DEFAULT 0,
        total_entrees REAL DEFAULT 0,
        total_sorties REAL DEFAULT 0,
        total_ventes REAL DEFAULT 0,
        total_reglements REAL DEFAULT 0,
        total_decomptes REAL DEFAULT 0,
        total_charges REAL DEFAULT 0,
        statut TEXT DEFAULT 'OUVERTE' CHECK(statut IN ('OUVERTE', 'FERMEE', 'BLOQUEE')),
        notes_ouverture TEXT,
        notes_fermeture TEXT,
        idUtilisateur INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
      )
    `,
    'licence_application': `
      CREATE TABLE IF NOT EXISTS licence_application (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        first_launch_date TEXT NOT NULL,
        licence_key TEXT,
        valid_activation_key TEXT,
        licence_type TEXT DEFAULT 'BETA' CHECK(licence_type IN ('BETA', 'DEFINITIF')),
        statut TEXT DEFAULT 'ACTIF' CHECK(statut IN ('ACTIF', 'EXPIRE')),
        trial_days INTEGER DEFAULT 60,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    
    'revendeurs_ponctuels': `
      CREATE TABLE IF NOT EXISTS revendeurs_ponctuels (
        idRevendeurPonctuel INTEGER PRIMARY KEY AUTOINCREMENT,
        nom_complet TEXT NOT NULL,
        telephone TEXT NOT NULL,
        email TEXT,
        adresse TEXT,
        piece_identite TEXT,
        numero_piece TEXT,
        date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP,
        est_actif INTEGER DEFAULT 1,
        notes TEXT
      )
    `,
    'mouvements_revendeurs': `
      CREATE TABLE IF NOT EXISTS mouvements_revendeurs (
        idMouvement INTEGER PRIMARY KEY AUTOINCREMENT,
        code_mouvement TEXT UNIQUE NOT NULL,
        idRevendeurPonctuel INTEGER NOT NULL,
        idProduit INTEGER NOT NULL,
        date_sortie DATETIME DEFAULT CURRENT_TIMESTAMP,
        quantite_sortie REAL NOT NULL,
        prix_unitaire REAL NOT NULL,
        montant_total REAL NOT NULL,
        destination TEXT NOT NULL CHECK(destination IN ('PRESENTATION', 'VENTE')),
        statut TEXT DEFAULT 'EN_COURS' CHECK(statut IN ('EN_COURS', 'RETOURNE', 'VENDU', 'PARTIELLEMENT_RETOURNE', 'PARTIELLEMENT_VENDU', 'CLOTURE')),
        stock_avant_sortie REAL NOT NULL,
        stock_apres_sortie REAL NOT NULL,
        notes TEXT,
        idUtilisateur INTEGER,
        date_cloture DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (idRevendeurPonctuel) REFERENCES revendeurs_ponctuels(idRevendeurPonctuel),
        FOREIGN KEY (idProduit) REFERENCES products(idProduit),
        FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
      )
    `,
    'mouvement_evenements': `
      CREATE TABLE IF NOT EXISTS mouvement_evenements (
        idEvenement INTEGER PRIMARY KEY AUTOINCREMENT,
        idMouvement INTEGER NOT NULL,
        type_evenement TEXT NOT NULL CHECK(type_evenement IN ('RETOUR', 'VENTE', 'PERTE', 'ECHANGE', 'AJUSTEMENT')),
        date_evenement DATETIME DEFAULT CURRENT_TIMESTAMP,
        quantite REAL NOT NULL,
        prix_unitaire REAL,
        montant REAL,
        etat TEXT CHECK(etat IN ('BON', 'ABIME', 'PERDU')),
        client_nom TEXT,
        client_contact TEXT,
        stock_avant REAL NOT NULL,
        stock_apres REAL NOT NULL,
        notes TEXT,
        idUtilisateur INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (idMouvement) REFERENCES mouvements_revendeurs(idMouvement) ON DELETE CASCADE,
        FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
      )
    `,
    'mouvement_etats': `
      CREATE TABLE IF NOT EXISTS mouvement_etats (
        idEtat INTEGER PRIMARY KEY AUTOINCREMENT,
        idMouvement INTEGER NOT NULL,
        ancien_statut TEXT NOT NULL,
        nouveau_statut TEXT NOT NULL,
        date_changement DATETIME DEFAULT CURRENT_TIMESTAMP,
        raison TEXT,
        idUtilisateur INTEGER,
        FOREIGN KEY (idMouvement) REFERENCES mouvements_revendeurs(idMouvement) ON DELETE CASCADE,
        FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
      )
    `
  };

  if (createQueries[tableName]) {
    try {
      await db.execute(createQueries[tableName]);
      log(`✅ Table ${tableName} créée avec succès`);
      
      // Insertion des données initiales pour certaines tables
      if (tableName === 'licence_application') {
        await db.execute(`
          INSERT OR IGNORE INTO licence_application (id, first_launch_date, licence_type, statut, trial_days)
          VALUES (1, datetime('now'), 'BETA', 'ACTIF', 60)
        `);
      }
      
      if (tableName === 'categories_charges') {
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
      log(`❌ Erreur création table ${tableName}: ${error}`);
    }
  } else {
    log(`⚠️ Aucune requête de création définie pour ${tableName}`);
  }
};

// ==================== FONCTION DE MIGRATION ====================
export const runMigrations = async (db: any): Promise<number> => {
  let migrationCount = 0;

  try {
    // ====================================================================
    // 0. Colonnes ajoutées pour : annulation en cascade des commandes,
    //    mode de paiement au journal de caisse, format d'impression.
    // ====================================================================
    const ajouterColonnes = async (table: string, cols: [string, string][]) => {
      try {
        const info = await db.select(`PRAGMA table_info(${table})`);
        if (!info || info.length === 0) return;
        const existantes = info.map((c: any) => c.name);
        for (const [col, def] of cols) {
          if (!existantes.includes(col)) {
            await db.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
            log(`   ➕ ${table}.${col} ajoutée`);
            migrationCount++;
          }
        }
      } catch (error) {
        log(`⚠️ Erreur ajout colonnes sur ${table}: ${error}`);
      }
    };

    log('📋 Vérification des colonnes d\'annulation et de paiement...');

    // Annulation des factures (propagée depuis l'annulation de commande)
    await ajouterColonnes('factures', [
      ['est_annule', 'INTEGER DEFAULT 0'],
      ['date_annulation', 'DATETIME'],
      ['annule_par', 'TEXT'],
      ['motif_annulation', 'TEXT'],
    ]);

    // Annulation des règlements (circuit standard)
    await ajouterColonnes('reglements', [
      ['statut', "TEXT DEFAULT 'VALIDE'"],
      ['est_annule', 'INTEGER DEFAULT 0'],
      ['date_annulation', 'DATETIME'],
      ['annule_par', 'TEXT'],
    ]);

    // Annulation des règlements revendeur (même principe)
    await ajouterColonnes('reglements_revendeur', [
      ['statut', "TEXT DEFAULT 'VALIDE'"],
      ['est_annule', 'INTEGER DEFAULT 0'],
      ['date_annulation', 'DATETIME'],
      ['annule_par', 'TEXT'],
    ]);

    // Annulation des factures revendeur
    await ajouterColonnes('factures_revendeur', [
      ['est_annule', 'INTEGER DEFAULT 0'],
      ['date_annulation', 'DATETIME'],
      ['annule_par', 'TEXT'],
      ['motif_annulation', 'TEXT'],
    ]);

    // Mode de paiement au journal de caisse.
    // NULL = « Non précisé » : les opérations antérieures à cette migration
    // n'ont pas cette information et ne sont donc pas comptées à tort
    // en espèces lors du point de caisse.
    await ajouterColonnes('journal_caisse', [
      ['mode_paiement', 'TEXT'],
    ]);

    // 1. Vérifier les colonnes de decomptes
    log('📋 Vérification de la table decomptes...');
    try {
      const tableInfo = await db.select(`PRAGMA table_info(decomptes)`);
      if (tableInfo && tableInfo.length > 0) {
        const columns = tableInfo.map((c: any) => c.name);
        log(`   Colonnes existantes: ${columns.join(', ')}`);

        const colsToAdd: [string, string][] = [
          ['taux_commission', 'REAL DEFAULT 60'],
          ['idFactureRevendeur', 'INTEGER'],
          ['periode_debut', 'TEXT'],
          ['periode_fin', 'TEXT'],
          ['notes', 'TEXT'],
          ['id_facture_approvisionnement', 'INTEGER']
        ];
        
        for (const [col, def] of colsToAdd) {
          if (!columns.includes(col)) {
            await db.execute(`ALTER TABLE decomptes ADD COLUMN ${col} ${def}`);
            migrationCount++;
          }
        }
      }
    } catch (error) {
      log(`⚠️ Erreur sur decomptes: ${error}`);
    }

    // 2. Vérifier les colonnes de decompte_details
    log('📋 Vérification de la table decompte_details...');
    try {
      const detailsInfo = await db.select(`PRAGMA table_info(decompte_details)`);
      if (detailsInfo && detailsInfo.length > 0) {
        const detailsColumns = detailsInfo.map((c: any) => c.name);
        log(`   Colonnes existantes: ${detailsColumns.join(', ')}`);

        const detailsCols: [string, string][] = [
          ['benefice', 'REAL DEFAULT 0'],
          ['commission', 'REAL DEFAULT 0'],
          ['qte_avant_decompte', 'REAL DEFAULT 0'],
          ['commission_pourcentage', 'REAL DEFAULT 0'],
          ['designation', 'TEXT'],
          ['total', 'REAL DEFAULT 0'],
          ['qte_reappro', 'REAL DEFAULT 0'],
        ];
        for (const [col, def] of detailsCols) {
          if (!detailsColumns.includes(col)) {
            await db.execute(`ALTER TABLE decompte_details ADD COLUMN ${col} ${def}`);
            migrationCount++;
          }
        }
      }
    } catch (error) {
      log(`⚠️ Erreur sur decompte_details: ${error}`);
    }

    // 3. Vérifier products — colonnes manquantes
    log('📋 Vérification de la table products...');
    try {
      const productsInfo = await db.select(`PRAGMA table_info(products)`);
      if (productsInfo && productsInfo.length > 0) {
        const productsColumns = productsInfo.map((c: any) => c.name);
        log(`   Colonnes existantes: ${productsColumns.join(', ')}`);

        const prodCols: [string, string][] = [
          ['methode_gestion_stock', "TEXT DEFAULT 'FIFO'"],
          ['idUniteStockage', 'INTEGER'],
          ['commission_pourcentage', 'REAL DEFAULT 0'],
          ['seuil_alerte', 'REAL DEFAULT 0'],
        ];
        for (const [col, def] of prodCols) {
          if (!productsColumns.includes(col)) {
            await db.execute(`ALTER TABLE products ADD COLUMN ${col} ${def}`);
            migrationCount++;
          }
        }
      }
    } catch (error) {
      log(`⚠️ Erreur sur products: ${error}`);
    }

    // 4. Vérifier commandes — colonnes manquantes
    log('📋 Vérification de la table commandes...');
    try {
      const commandesInfo = await db.select(`PRAGMA table_info(commandes)`);
      if (commandesInfo && commandesInfo.length > 0) {
        const commandesColumns = commandesInfo.map((c: any) => c.name);

        const commandesMissingCols: [string, string][] = [
          ['adresse_livraison', 'TEXT'],
          ['montant_tva', 'REAL DEFAULT 0'],
          ['montant_remise', 'REAL DEFAULT 0'],
          ['montant_net', 'REAL DEFAULT 0'],
          ['source', "TEXT DEFAULT 'DIRECT'"],
          ['notes', 'TEXT'],
          ['signature_base64', 'TEXT'],
          ['date_facture', 'DATE'],
          ['taux_commission', 'REAL DEFAULT 60'],
        ];
        for (const [col, def] of commandesMissingCols) {
          if (!commandesColumns.includes(col)) {
            await db.execute(`ALTER TABLE commandes ADD COLUMN ${col} ${def}`);
            migrationCount++;
          }
        }
      }
    } catch (error) {
      log(`⚠️ Erreur sur commandes: ${error}`);
    }

    // 5. Vérifier utilisateurs — permissions
    log('📋 Vérification de la table utilisateurs...');
    try {
      const utilisateursInfo = await db.select(`PRAGMA table_info(utilisateurs)`);
      if (utilisateursInfo && utilisateursInfo.length > 0) {
        const utilisateursColumns = utilisateursInfo.map((c: any) => c.name);

        if (!utilisateursColumns.includes('permissions')) {
          log('🔄 Ajout de la colonne permissions à utilisateurs...');
          await db.execute(`ALTER TABLE utilisateurs ADD COLUMN permissions TEXT DEFAULT '{}'`);
          migrationCount++;
        }
      }
    } catch (error) {
      log(`⚠️ Erreur sur utilisateurs: ${error}`);
    }

    // 6. Vérifier commande_details
    try {
      const cmdDetailsInfo = await db.select(`PRAGMA table_info(commande_details)`);
      if (cmdDetailsInfo && cmdDetailsInfo.length > 0) {
        const cmdDetailsCols = cmdDetailsInfo.map((c: any) => c.name);
        if (!cmdDetailsCols.includes('remise')) {
          await db.execute(`ALTER TABLE commande_details ADD COLUMN remise REAL DEFAULT 0`);
          migrationCount++;
        }
        if (!cmdDetailsCols.includes('idConditionnement')) {
          await db.execute(`ALTER TABLE commande_details ADD COLUMN idConditionnement INTEGER`);
          migrationCount++;
        }
        if (!cmdDetailsCols.includes('total')) {
          await db.execute(`ALTER TABLE commande_details ADD COLUMN total REAL DEFAULT 0`);
          migrationCount++;
        }
      }
    } catch (error) {
      log(`⚠️ Erreur sur commande_details: ${error}`);
    }

    // 7. Vérifier vente_details
    try {
      const vdInfo = await db.select(`PRAGMA table_info(vente_details)`);
      if (vdInfo && vdInfo.length > 0) {
        const vdCols = vdInfo.map((c: any) => c.name);
        if (!vdCols.includes('idConditionnement')) {
          await db.execute(`ALTER TABLE vente_details ADD COLUMN idConditionnement INTEGER`);
          migrationCount++;
        }
        if (!vdCols.includes('quantite_pieces')) {
          await db.execute(`ALTER TABLE vente_details ADD COLUMN quantite_pieces REAL DEFAULT 0`);
          migrationCount++;
        }
        if (!vdCols.includes('libelle_conditionnement')) {
          await db.execute(`ALTER TABLE vente_details ADD COLUMN libelle_conditionnement TEXT`);
          migrationCount++;
        }
      }
    } catch (error) {
      log(`⚠️ Erreur sur vente_details: ${error}`);
    }

    // 8. Vérifier factures_revendeur
    try {
      const factRevInfo = await db.select(`PRAGMA table_info(factures_revendeur)`);
      if (factRevInfo && factRevInfo.length > 0) {
        const factRevCols = factRevInfo.map((c: any) => c.name);
        if (!factRevCols.includes('taux_commission')) {
          await db.execute(`ALTER TABLE factures_revendeur ADD COLUMN taux_commission REAL DEFAULT 60`);
          migrationCount++;
        }
      }
    } catch (error) {
      log(`⚠️ Erreur sur factures_revendeur: ${error}`);
    }

    // 9. Vérifier reglements
    try {
      const reglementsInfo = await db.select(`PRAGMA table_info(reglements)`);
      if (reglementsInfo && reglementsInfo.length > 0) {
        const reglementsColumns = reglementsInfo.map((c: any) => c.name);

        const regCols: [string, string][] = [
          ['code_reglement', 'TEXT'],
          ['idClient', 'INTEGER'],
          ['idVente', 'INTEGER'],
          ['reference', 'TEXT'],
          ['banque', 'TEXT'],
          ['numero_cheque', 'TEXT'],
          ['date_valeur', 'DATE'],
          ['est_lettrage', 'INTEGER DEFAULT 0'],
          ['observation', 'TEXT'],
          ['idUtilisateur', 'INTEGER'],
          ['idDecompte', 'INTEGER'],
        ];
        for (const [col, def] of regCols) {
          if (!reglementsColumns.includes(col)) {
            await db.execute(`ALTER TABLE reglements ADD COLUMN ${col} ${def}`);
            migrationCount++;
          }
        }
      }
    } catch (error) {
      log(`⚠️ Erreur sur reglements: ${error}`);
    }

    // 10. Vérifier credits pour date_echeance
    try {
      const creditsCols = (await db.select(`PRAGMA table_info(credits)`)).map((c: any) => c.name);
      if (!creditsCols.includes('date_echeance')) {
        await db.execute(`ALTER TABLE credits ADD COLUMN date_echeance TEXT`);
        migrationCount++;
        log('✅ Colonne date_echeance ajoutée à credits');
      }
    } catch (error) {
      log(`⚠️ Erreur sur credits: ${error}`);
    }

    // 11. Vérifier configuration_atelier
    try {
      const atelierInfo = await db.select(`PRAGMA table_info(configuration_atelier)`);
      if (atelierInfo && atelierInfo.length > 0) {
        const atelierCols = atelierInfo.map((c: any) => c.name);
        
        const atelierColsToAdd: [string, string][] = [
          ['ifu', 'TEXT'],
          ['rccm', 'TEXT'],
          ['adresse_postale', 'TEXT'],
          ['adresse_cadastrale', 'TEXT'],
          ['compte_bancaire', 'TEXT'],
          ['regime_fiscal', 'TEXT'],
          ['service_impots', 'TEXT'],
          ['forme_juridique', 'TEXT'],
          ['tva_active', 'INTEGER DEFAULT 0'],
        ];
        
        for (const [col, def] of atelierColsToAdd) {
          if (!atelierCols.includes(col)) {
            await db.execute(`ALTER TABLE configuration_atelier ADD COLUMN ${col} ${def}`);
            migrationCount++;
            log(`✅ Colonne ${col} ajoutée à configuration_atelier`);
          }
        }
      }
    } catch (error) {
      log(`⚠️ Erreur sur configuration_atelier: ${error}`);
    }

    // 12. Vérifier clients pour IFU/RCCM
    try {
      const clientsInfo = await db.select(`PRAGMA table_info(clients)`);
      if (clientsInfo && clientsInfo.length > 0) {
        const clientsCols = clientsInfo.map((c: any) => c.name);
        
        const clientsColsToAdd: [string, string][] = [
          ['ifu', 'TEXT'],
          ['rccm', 'TEXT'],
          ['adresse_postale', 'TEXT'],
          ['code_client', 'TEXT'],
        ];
        
        for (const [col, def] of clientsColsToAdd) {
          if (!clientsCols.includes(col)) {
            try {
              await db.execute(`ALTER TABLE clients ADD COLUMN ${col} ${def}`);
              migrationCount++;
            } catch (e) {
              log(`⚠️ Impossible d'ajouter ${col} à clients: ${e}`);
            }
          }
        }
      }
    } catch (error) {
      log(`⚠️ Erreur sur clients: ${error}`);
    }

    // 13. Vérifier licence_application pour valid_activation_key
    try {
      const licInfo = await db.select(`PRAGMA table_info(licence_application)`);
      if (licInfo && licInfo.length > 0) {
        const licCols = licInfo.map((c: any) => c.name);
        
        if (!licCols.includes('valid_activation_key')) {
          await db.execute(`ALTER TABLE licence_application ADD COLUMN valid_activation_key TEXT`);
          migrationCount++;
        }
        if (!licCols.includes('trial_days')) {
          await db.execute(`ALTER TABLE licence_application ADD COLUMN trial_days INTEGER DEFAULT 60`);
          migrationCount++;
        }
      }
    } catch (error) {
      log(`⚠️ Erreur sur licence_application: ${error}`);
    }

    // 14. Vérifier journal_caisse pour idSession
    try {
      const journalInfo = await db.select(`PRAGMA table_info(journal_caisse)`);
      if (journalInfo && journalInfo.length > 0) {
        const journalCols = journalInfo.map((c: any) => c.name);
        if (!journalCols.includes('idSession')) {
          await db.execute(`ALTER TABLE journal_caisse ADD COLUMN idSession INTEGER REFERENCES sessions_caisse(idSession)`);
          migrationCount++;
          log('✅ Colonne idSession ajoutée à journal_caisse');
        }
      }
    } catch (error) {
      log(`⚠️ Erreur sur journal_caisse: ${error}`);
    }

    // 15. Vérifier charges_fonctionnement pour idSession
    try {
      const chargesInfo = await db.select(`PRAGMA table_info(charges_fonctionnement)`);
      if (chargesInfo && chargesInfo.length > 0) {
        const chargesCols = chargesInfo.map((c: any) => c.name);
        if (!chargesCols.includes('idSession')) {
          await db.execute(`ALTER TABLE charges_fonctionnement ADD COLUMN idSession INTEGER REFERENCES sessions_caisse(idSession)`);
          migrationCount++;
          log('✅ Colonne idSession ajoutée à charges_fonctionnement');
        }
      }
    } catch (error) {
      log(`⚠️ Erreur sur charges_fonctionnement: ${error}`);
    }

    // 16. Vérifier ventes pour idUtilisateur et notes
    try {
      const ventesInfo = await db.select(`PRAGMA table_info(ventes)`);
      if (ventesInfo && ventesInfo.length > 0) {
        const ventesCols = ventesInfo.map((c: any) => c.name);
        if (!ventesCols.includes('idUtilisateur')) {
          await db.execute(`ALTER TABLE ventes ADD COLUMN idUtilisateur INTEGER REFERENCES utilisateurs(id)`);
          migrationCount++;
        }
        if (!ventesCols.includes('notes')) {
          await db.execute(`ALTER TABLE ventes ADD COLUMN notes TEXT`);
          migrationCount++;
        }
        if (!ventesCols.includes('statut')) {
          await db.execute(`ALTER TABLE ventes ADD COLUMN statut TEXT DEFAULT 'EN_ATTENTE'`);
          migrationCount++;
        }
        if (!ventesCols.includes('created_at')) {
          await db.execute(`ALTER TABLE ventes ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
          migrationCount++;
        }
      }
    } catch (error) {
      log(`⚠️ Erreur sur ventes: ${error}`);
    }

    // 17. Vérifier les colonnes de mouvements_revendeurs
    try {
      const mvInfo = await db.select(`PRAGMA table_info(mouvements_revendeurs)`);
      if (mvInfo && mvInfo.length > 0) {
        const mvCols = mvInfo.map((c: any) => c.name);
        log(`   Colonnes mouvements_revendeurs: ${mvCols.join(', ')}`);

        // Ajouter date_cloture si manquant
        if (!mvCols.includes('date_cloture')) {
          await db.execute(`ALTER TABLE mouvements_revendeurs ADD COLUMN date_cloture DATETIME`);
          migrationCount++;
          log('✅ Colonne date_cloture ajoutée à mouvements_revendeurs');
        }

        // Vérifier les statuts
        const checkConstraint = await db.select(`
          SELECT sql FROM sqlite_master WHERE type='table' AND name='mouvements_revendeurs'
        `);
        if (checkConstraint.length > 0) {
          const sql = checkConstraint[0].sql;
          if (sql && !sql.includes("'RETOURNE'")) {
            // Recréer la table avec les bons statuts
            log('🔄 Mise à jour des statuts de mouvements_revendeurs...');
            await db.execute(`
              CREATE TABLE mouvements_revendeurs_new (
                idMouvement INTEGER PRIMARY KEY AUTOINCREMENT,
                code_mouvement TEXT UNIQUE NOT NULL,
                idRevendeurPonctuel INTEGER NOT NULL,
                idProduit INTEGER NOT NULL,
                date_sortie DATETIME DEFAULT CURRENT_TIMESTAMP,
                quantite_sortie REAL NOT NULL,
                prix_unitaire REAL NOT NULL,
                montant_total REAL NOT NULL,
                destination TEXT NOT NULL CHECK(destination IN ('PRESENTATION', 'VENTE')),
                statut TEXT DEFAULT 'EN_COURS' CHECK(statut IN ('EN_COURS', 'RETOURNE', 'VENDU', 'PARTIELLEMENT_RETOURNE', 'PARTIELLEMENT_VENDU', 'CLOTURE')),
                stock_avant_sortie REAL NOT NULL,
                stock_apres_sortie REAL NOT NULL,
                notes TEXT,
                idUtilisateur INTEGER,
                date_cloture DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (idRevendeurPonctuel) REFERENCES revendeurs_ponctuels(idRevendeurPonctuel),
                FOREIGN KEY (idProduit) REFERENCES products(idProduit),
                FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
              )
            `);
            await db.execute(`
              INSERT INTO mouvements_revendeurs_new SELECT * FROM mouvements_revendeurs
            `);
            await db.execute(`DROP TABLE mouvements_revendeurs`);
            await db.execute(`ALTER TABLE mouvements_revendeurs_new RENAME TO mouvements_revendeurs`);
            migrationCount++;
            log('✅ Table mouvements_revendeurs recréée avec les bons statuts');
          }
        }
      }
    } catch (error) {
      log(`⚠️ Erreur sur mouvements_revendeurs: ${error}`);
    }

    log(`✅ ${migrationCount} migration(s) appliquée(s)`);
    return migrationCount;

  } catch (error) {
    log(`❌ Erreur migration: ${error}`);
    throw error;
  }
};

// ==================== FONCTION POUR VÉRIFIER LA STRUCTURE ====================
export const verifySchema = async (): Promise<void> => {
  try {
    const db = await getDb();
    log('🔍 Vérification de la structure de la base de données...');
    
    const tables = await db.select(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `) as Array<{ name: string }>;
    
    log(`📊 Tables trouvées: ${tables.map((t) => t.name).join(', ')}`);
    
    // Vérifier les colonnes de mouvements_revendeurs
    const columns = await db.select(`PRAGMA table_info(mouvements_revendeurs)`) as Array<{ name: string }>;
    if (columns.length > 0) {
      log(`📋 Colonnes de mouvements_revendeurs: ${columns.map((c) => c.name).join(', ')}`);
    }
    
    log('✅ Vérification terminée');
  } catch (error) {
    log(`❌ Erreur vérification: ${error}`);
  }
};

export default {
  runSchemaMigration,
  runMigrations,
  verifySchema
};