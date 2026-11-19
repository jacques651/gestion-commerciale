// src/database/db.ts
import { WebDatabase } from './webAdapter';

// Type minimal commun aux deux implementations (Tauri natif et adaptateur web).
type DbLike = {
  select: <T = any>(query: string, bindValues?: any[]) => Promise<T>;
  execute: (query: string, bindValues?: any[]) => Promise<{ rowsAffected: number; lastInsertId: number }>;
  close: () => Promise<boolean>;
};

let dbInstance: DbLike | null = null;

/**
 * Detecte si l'application tourne dans la coque native Tauri.
 * Sinon, on est dans un navigateur (mode web portable) -> adaptateur HTTP.
 */
const isTauri = (): boolean => {
  return typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

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
    commission_pourcentage REAL DEFAULT 0,
    idProduit INTEGER PRIMARY KEY AUTOINCREMENT,
    code_produit TEXT UNIQUE NOT NULL,
    reference TEXT,
    designation TEXT NOT NULL,
    categorie TEXT,
    unite_base TEXT DEFAULT 'pièce',
    contenu_unite REAL DEFAULT 1,
    prix_achat_base REAL DEFAULT 0,
    prix_vente_detail REAL DEFAULT 0,
    prix_vente_gros REAL DEFAULT 0,
    qte_stock REAL DEFAULT 0,
    seuil_alerte REAL DEFAULT 5,
    prix_moyen_pondere REAL DEFAULT 0,
    methode_gestion_stock TEXT DEFAULT 'FIFO',
    date_entree DATETIME DEFAULT CURRENT_TIMESTAMP,
    est_supprime INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS conditionnements (
    code_conditionnement TEXT,
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
    adresse_postale TEXT,
    ifu TEXT,
    rccm TEXT,
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
    taux_commission REAL DEFAULT 60,
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
-- 6. DÉCOMPTES REVENDEURS
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
    id_facture_approvisionnement INTEGER,
    taux_commission REAL DEFAULT 60,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idClient) REFERENCES clients(idClient),
    FOREIGN KEY (id_facture_approvisionnement) REFERENCES factures_approvisionnement(idFactureAppro)
);

CREATE TABLE IF NOT EXISTS decompte_details (
    prix_unitaire_vente REAL DEFAULT 0,
    idDetailRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
    idDecompte INTEGER NOT NULL,
    idProduit INTEGER NOT NULL,
    qte_decompte REAL NOT NULL DEFAULT 0,
    qte_avant_decompte REAL DEFAULT 0,
    prix_achat REAL DEFAULT 0,
    prix_vente REAL DEFAULT 0,
    commission_pourcentage REAL DEFAULT 0,
    designation TEXT,
    total REAL DEFAULT 0,
    qte_reappro REAL DEFAULT 0,
    FOREIGN KEY (idDecompte) REFERENCES decomptes(idDecompte) ON DELETE CASCADE,
    FOREIGN KEY (idProduit) REFERENCES products(idProduit)
);

CREATE INDEX IF NOT EXISTS idx_decomptes_client ON decomptes(idClient);
CREATE INDEX IF NOT EXISTS idx_decomptes_date ON decomptes(date_decompte);
CREATE INDEX IF NOT EXISTS idx_decomptes_statut ON decomptes(statut);
CREATE INDEX IF NOT EXISTS idx_decomptes_code ON decomptes(code_decompte);
CREATE INDEX IF NOT EXISTS idx_decompte_details_decompte ON decompte_details(idDecompte);
CREATE INDEX IF NOT EXISTS idx_decompte_details_produit ON decompte_details(idProduit);

-- =====================================================
-- REVENDEURS PONCTUELS - CYCLE DE VIE COMPLET
-- =====================================================

-- 1. Fiche revendeur
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

-- 2. Mouvements principaux (sorties)
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

-- 3. Événements du mouvement (retours, ventes, pertes, etc.)
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

-- 4. États du mouvement (historique des changements de statut)
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

-- 5. Index
CREATE INDEX IF NOT EXISTS idx_mouvements_revendeur ON mouvements_revendeurs(idRevendeurPonctuel);
CREATE INDEX IF NOT EXISTS idx_mouvements_produit ON mouvements_revendeurs(idProduit);
CREATE INDEX IF NOT EXISTS idx_mouvements_date_sortie ON mouvements_revendeurs(date_sortie);
CREATE INDEX IF NOT EXISTS idx_mouvements_statut ON mouvements_revendeurs(statut);
CREATE INDEX IF NOT EXISTS idx_mouvements_code ON mouvements_revendeurs(code_mouvement);
CREATE INDEX IF NOT EXISTS idx_evenements_mouvement ON mouvement_evenements(idMouvement);
CREATE INDEX IF NOT EXISTS idx_evenements_date ON mouvement_evenements(date_evenement);
CREATE INDEX IF NOT EXISTS idx_evenements_type ON mouvement_evenements(type_evenement);
CREATE INDEX IF NOT EXISTS idx_etats_mouvement ON mouvement_etats(idMouvement);

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

-- Prestations de services : volontairement séparées des produits pour ne
-- jamais déclencher de mouvement ou de contrôle de stock.
CREATE TABLE IF NOT EXISTS prestations (
    idPrestation INTEGER PRIMARY KEY AUTOINCREMENT,
    code_prestation TEXT UNIQUE NOT NULL,
    designation TEXT NOT NULL,
    categorie TEXT,
    description TEXT,
    prix_defaut REAL DEFAULT 0,
    prix_libre INTEGER DEFAULT 0,
    unite_facturation TEXT DEFAULT 'prestation',
    statut TEXT DEFAULT 'ACTIVE' CHECK(statut IN ('ACTIVE', 'INACTIVE')),
    observations TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ventes_prestations (
    idVentePrestation INTEGER PRIMARY KEY AUTOINCREMENT,
    code_facture TEXT UNIQUE NOT NULL,
    idClient INTEGER,
    client_nom TEXT,
    client_contact TEXT,
    date_vente DATETIME DEFAULT CURRENT_TIMESTAMP,
    montant_total REAL NOT NULL DEFAULT 0,
    montant_paye REAL NOT NULL DEFAULT 0,
    mode_paiement TEXT,
    mode_paiement_detail TEXT,
    statut_paiement TEXT NOT NULL DEFAULT 'PAYEE' CHECK(statut_paiement IN ('PAYEE', 'PARTIELLE', 'IMPAYEE', 'ANNULEE')),
    idUtilisateur INTEGER,
    idSession INTEGER,
    observations TEXT,
    est_annule INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idClient) REFERENCES clients(idClient),
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id),
    FOREIGN KEY (idSession) REFERENCES sessions_caisse(idSession)
);

CREATE TABLE IF NOT EXISTS vente_prestation_details (
    idDetailPrestation INTEGER PRIMARY KEY AUTOINCREMENT,
    idVentePrestation INTEGER NOT NULL,
    idPrestation INTEGER,
    designation TEXT NOT NULL,
    unite_facturation TEXT DEFAULT 'prestation',
    quantite REAL NOT NULL DEFAULT 1,
    prix_unitaire REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    observations TEXT,
    FOREIGN KEY (idVentePrestation) REFERENCES ventes_prestations(idVentePrestation) ON DELETE CASCADE,
    FOREIGN KEY (idPrestation) REFERENCES prestations(idPrestation)
);

CREATE INDEX IF NOT EXISTS idx_prestations_statut ON prestations(statut);
CREATE INDEX IF NOT EXISTS idx_ventes_prestations_date ON ventes_prestations(date_vente);
CREATE INDEX IF NOT EXISTS idx_ventes_prestations_client ON ventes_prestations(idClient);

-- =====================================================
-- 7bis. ATTESTATIONS D'ACHAT-VENTE (matériel d'occasion)
-- =====================================================

CREATE TABLE IF NOT EXISTS attestations (
    idAttestation INTEGER PRIMARY KEY AUTOINCREMENT,
    code_attestation TEXT UNIQUE,
    date_attestation DATETIME DEFAULT CURRENT_TIMESTAMP,
    idVente INTEGER,
    cedant_nom TEXT,
    cedant_domicile TEXT,
    cedant_tel TEXT,
    cedant_doc TEXT,
    cedant_ref TEXT,
    cess_nom TEXT,
    cess_domicile TEXT,
    cess_tel TEXT,
    cess_doc TEXT,
    cess_ref TEXT,
    materiel TEXT,
    en_echange TEXT,
    montant REAL DEFAULT 0,
    sens TEXT DEFAULT 'ACHAT',
    fait_a TEXT,
    date_acte TEXT,
    nb_exemplaires TEXT,
    created_by TEXT,
    est_annule INTEGER DEFAULT 0,
    date_annulation DATETIME,
    annule_par TEXT,
    motif_annulation TEXT,
    FOREIGN KEY (idVente) REFERENCES ventes(idVente)
);

CREATE INDEX IF NOT EXISTS idx_attestations_date ON attestations(date_attestation);

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

CREATE TABLE IF NOT EXISTS sorties_lots (
    idSortieLot INTEGER PRIMARY KEY AUTOINCREMENT,
    idLot INTEGER NOT NULL,
    idMouvement INTEGER NOT NULL,
    quantite_sortie REAL NOT NULL,
    prix_vente_unitaire REAL NOT NULL,
    FOREIGN KEY (idLot) REFERENCES lots_stock(idLot),
    FOREIGN KEY (idMouvement) REFERENCES mouvements_stock(idMouvement)
);

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
    code_facture TEXT,
    prix_unitaire REAL DEFAULT 0,
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
    est_annule INTEGER DEFAULT 0,
    date_annulation DATETIME,
    annule_par TEXT,
    motif_annulation TEXT,
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
    FOREIGN KEY (idCommande) REFERENCES commandes(idCommande),
    FOREIGN KEY (idRevendeur) REFERENCES clients(idClient)
);

-- =====================================================
-- 12. RÈGLEMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS reglements (
    idDecompte INTEGER,
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
    statut TEXT DEFAULT 'VALIDE',
    est_annule INTEGER DEFAULT 0,
    date_annulation DATETIME,
    annule_par TEXT,
    FOREIGN KEY (idClient) REFERENCES clients(idClient),
    FOREIGN KEY (idFacture) REFERENCES factures(idFacture),
    FOREIGN KEY (idVente) REFERENCES ventes(idVente)
);

CREATE TABLE IF NOT EXISTS sessions_caisse (
    idSession INTEGER PRIMARY KEY AUTOINCREMENT,
    code_session TEXT UNIQUE NOT NULL,
    nom_operateur TEXT NOT NULL,
    date_ouverture DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_fermeture DATETIME,
    solde_initial REAL DEFAULT 0,
    solde_ouverture REAL DEFAULT 0,
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

-- =====================================================
-- 14. UTILISATEURS
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
-- 15. CONFIGURATION ATELIER
-- =====================================================

CREATE TABLE IF NOT EXISTS configuration_atelier (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nom_atelier TEXT,
    forme_juridique TEXT,
    adresse_postale TEXT,
    adresse_cadastrale TEXT,
    ifu TEXT,
    rccm TEXT,
    compte_bancaire TEXT,
    regime_fiscal TEXT,
    service_impots TEXT,
    telephone TEXT,
    adresse TEXT,
    email TEXT,
    nif TEXT,
    message_facture TEXT,
    logo_base64 TEXT,
    tva_active INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 16. CONFIGURATION COMMERCE
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
-- 17. CREDITS ET REMBOURSEMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS credits (
    date_echeance TEXT,
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
-- 18. JOURNAL DE CAISSE
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
    idSession INTEGER,
    notes TEXT,
    -- Mode de paiement de l'opération. NULL = « Non précisé » (opérations
    -- antérieures à l'introduction de cette colonne).
    mode_paiement TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id),
    FOREIGN KEY (idSession) REFERENCES sessions_caisse(idSession)
);

CREATE TABLE IF NOT EXISTS charges_fonctionnement (
    idCharge INTEGER PRIMARY KEY AUTOINCREMENT,
    code_charge TEXT UNIQUE NOT NULL,
    date_charge DATETIME DEFAULT CURRENT_TIMESTAMP,
    designation TEXT NOT NULL,
    montant REAL NOT NULL,
    beneficiaire TEXT NOT NULL,
    categorie_charge TEXT NOT NULL,  -- catégorie libre (référentiel: categories_charges)
    reference_paiement TEXT,
    idJournal INTEGER,
    idUtilisateur INTEGER,
    idSession INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal),
    FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id),
    FOREIGN KEY (idSession) REFERENCES sessions_caisse(idSession)
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
-- 19. VUES
-- =====================================================

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
-- 20. INDEX
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
-- 21. DONNÉES PAR DÉFAUT
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

// =====================================================
// FONCTIONS DE GESTION DE LA BASE DE DONNÉES
// =====================================================

/**
 * Obtient l'instance de la base de données
 * Crée une nouvelle connexion si elle n'existe pas
 */
export const getDb = async (): Promise<DbLike> => {
    if (dbInstance) return dbInstance;

    try {
        if (isTauri()) {
            // Mode natif (application de bureau Tauri) : plugin SQL natif.
            const { default: Database } = await import('@tauri-apps/plugin-sql');
            const native = await Database.load('sqlite:gestion-commerciale.db');

            // Configuration des PRAGMA pour optimiser les performances
            await native.execute('PRAGMA foreign_keys = ON;');
            await native.execute('PRAGMA journal_mode = WAL;');
            await native.execute('PRAGMA synchronous = NORMAL;');
            await native.execute('PRAGMA busy_timeout = 30000;');

            dbInstance = native as unknown as DbLike;
            console.log('✅ Base de données connectée (mode natif Tauri)');
        } else {
            // Mode web portable : la base vit dans le serveur, accès via HTTP.
            // Les PRAGMA sont déjà appliqués côté serveur.
            dbInstance = await WebDatabase.load('sqlite:gestion-commerciale.db');
            console.log('✅ Base de données connectée (mode web portable)');
        }

        return dbInstance;

    } catch (error) {
        console.error('❌ Erreur de connexion à la base de données:', error);
        throw error;
    }
};

/**
 * Débogue les verrous de la base de données
 */
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
        return result;
    } catch (error) {
        console.error('❌ Erreur debug locks:', error);
        return null;
    }
}

/**
 * Initialise la base de données avec le schéma complet
 */
export const initDatabase = async (): Promise<void> => {
    try {
        const db = await getDb();

        console.log('🚀 Initialisation de la base de données...');

        // Exécuter le schéma complet
        await db.execute(SCHEMA_SQL);

        // Migration: Ajout de la colonne id_facture_approvisionnement dans decomptes
        try {
            await db.execute(`
                ALTER TABLE decomptes
                ADD COLUMN id_facture_approvisionnement INTEGER
            `);
            console.log('✅ Colonne id_facture_approvisionnement ajoutée à decomptes');
        } catch (error) {
            console.log('ℹ️ Colonne id_facture_approvisionnement déjà existante');
        }

        // Migration: Ajout de la colonne qte_avant_decompte dans decompte_details
        try {
            await db.execute(`
                ALTER TABLE decompte_details 
                ADD COLUMN qte_avant_decompte REAL DEFAULT 0
            `);
            console.log('✅ Colonne qte_avant_decompte ajoutée à decompte_details');
        } catch (error) {
            console.log('ℹ️ Colonne qte_avant_decompte déjà existante');
        }

        // Migration: Ajout de la colonne qte_reappro dans decompte_details
        try {
            await db.execute(`
                ALTER TABLE decompte_details 
                ADD COLUMN qte_reappro REAL DEFAULT 0
            `);
            console.log('✅ Colonne qte_reappro ajoutée à decompte_details');
        } catch (error) {
            console.log('ℹ️ Colonne qte_reappro déjà existante');
        }

        // Migration: Ajout de la colonne taux_commission dans commandes
        try {
            await db.execute(`
                ALTER TABLE commandes 
                ADD COLUMN taux_commission REAL DEFAULT 60
            `);
            console.log('✅ Colonne taux_commission ajoutée à commandes');
        } catch (error) {
            console.log('ℹ️ Colonne taux_commission déjà existante dans commandes');
        }

        // Migration: Ajout de la colonne taux_commission dans decomptes
        try {
            await db.execute(`
                ALTER TABLE decomptes 
                ADD COLUMN taux_commission REAL DEFAULT 60
            `);
            console.log('✅ Colonne taux_commission ajoutée à decomptes');
        } catch (error) {
            console.log('ℹ️ Colonne taux_commission déjà existante dans decomptes');
        }

        // Migration: Ajout de la colonne idSession dans journal_caisse
        try {
            await db.execute(`
                ALTER TABLE journal_caisse 
                ADD COLUMN idSession INTEGER REFERENCES sessions_caisse(idSession)
            `);
            console.log('✅ Colonne idSession ajoutée à journal_caisse');
        } catch (error) {
            console.log('ℹ️ Colonne idSession déjà existante dans journal_caisse');
        }

        // Migration: Ajout de la colonne idSession dans charges_fonctionnement
        try {
            await db.execute(`
                ALTER TABLE charges_fonctionnement 
                ADD COLUMN idSession INTEGER REFERENCES sessions_caisse(idSession)
            `);
            console.log('✅ Colonne idSession ajoutée à charges_fonctionnement');
        } catch (error) {
            console.log('ℹ️ Colonne idSession déjà existante dans charges_fonctionnement');
        }

        // Migration: Ajout de la colonne tva_active dans configuration_atelier
        try {
            await db.execute(`
                ALTER TABLE configuration_atelier 
                ADD COLUMN tva_active INTEGER DEFAULT 0
            `);
            console.log('✅ Colonne tva_active ajoutée à configuration_atelier');
        } catch (error) {
            console.log('ℹ️ Colonne tva_active déjà existante dans configuration_atelier');
        }

        // Migration: Ajout de la colonne date_cloture dans mouvements_revendeurs
        try {
            await db.execute(`
                ALTER TABLE mouvements_revendeurs 
                ADD COLUMN date_cloture DATETIME
            `);
            console.log('✅ Colonne date_cloture ajoutée à mouvements_revendeurs');
        } catch (error) {
            console.log('ℹ️ Colonne date_cloture déjà existante dans mouvements_revendeurs');
        }

        // Migration non destructive : lever la contrainte CHECK sur charges_fonctionnement.categorie_charge
        // (permet des catégories de charge personnalisées)
        try {
            const infoCharges = await db.select<any[]>(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='charges_fonctionnement'"
            );
            const sqlDef: string = infoCharges?.[0]?.sql || '';
            if (sqlDef.includes('CHECK(categorie_charge')) {
                await db.execute('PRAGMA foreign_keys=OFF;');
                await db.execute('BEGIN TRANSACTION');
                await db.execute(`
                    CREATE TABLE charges_fonctionnement_new (
                        idCharge INTEGER PRIMARY KEY AUTOINCREMENT,
                        code_charge TEXT UNIQUE NOT NULL,
                        date_charge DATETIME DEFAULT CURRENT_TIMESTAMP,
                        designation TEXT NOT NULL,
                        montant REAL NOT NULL,
                        beneficiaire TEXT NOT NULL,
                        categorie_charge TEXT NOT NULL,
                        reference_paiement TEXT,
                        idJournal INTEGER,
                        idUtilisateur INTEGER,
                        idSession INTEGER,
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                `);
                await db.execute(`
                    INSERT INTO charges_fonctionnement_new
                    (idCharge, code_charge, date_charge, designation, montant, beneficiaire,
                     categorie_charge, reference_paiement, idJournal, idUtilisateur, idSession, notes, created_at)
                    SELECT idCharge, code_charge, date_charge, designation, montant, beneficiaire,
                     categorie_charge, reference_paiement, idJournal, idUtilisateur, idSession, notes, created_at
                    FROM charges_fonctionnement;
                `);
                await db.execute('DROP TABLE charges_fonctionnement;');
                await db.execute('ALTER TABLE charges_fonctionnement_new RENAME TO charges_fonctionnement;');
                await db.execute('COMMIT');
                await db.execute('PRAGMA foreign_keys=ON;');
                console.log('✅ Contrainte CHECK retirée de charges_fonctionnement (catégories libres)');
            }
        } catch (error) {
            console.log('ℹ️ Migration catégories de charge ignorée:', error);
        }

        // Migration: colonnes adresse_postale, ifu, rccm dans clients (bases anciennes)
        for (const col of ['adresse_postale', 'ifu', 'rccm']) {
            try {
                await db.execute(`ALTER TABLE clients ADD COLUMN ${col} TEXT`);
                console.log(`✅ Colonne ${col} ajoutée à clients`);
            } catch (error) {
                // colonne déjà présente -> ignorer
            }
        }

        // Migration: colonnes atelier (formulaire Paramètres) sur bases anciennes
        for (const col of ['forme_juridique','adresse_postale','adresse_cadastrale','ifu','rccm','compte_bancaire','regime_fiscal','service_impots']) {
            try { await db.execute(`ALTER TABLE configuration_atelier ADD COLUMN ${col} TEXT`); } catch (e) { /* déjà présent */ }
        }

        // Migration: colonnes complémentaires détectées par audit
        try { await db.execute(`ALTER TABLE conditionnements ADD COLUMN code_conditionnement TEXT`); } catch (e) { /* déjà présent */ }
        try { await db.execute(`ALTER TABLE credits ADD COLUMN date_echeance TEXT`); } catch (e) { /* déjà présent */ }
        try { await db.execute(`ALTER TABLE reglements ADD COLUMN idDecompte INTEGER`); } catch (e) { /* déjà présent */ }
        try { await db.execute(`ALTER TABLE decompte_details ADD COLUMN prix_unitaire_vente REAL DEFAULT 0`); } catch (e) { /* déjà présent */ }
        try { await db.execute(`ALTER TABLE products ADD COLUMN commission_pourcentage REAL DEFAULT 0`); } catch (e) { /* déjà présent */ }
        try { await db.execute(`ALTER TABLE mouvements_revendeur ADD COLUMN prix_unitaire REAL DEFAULT 0`); } catch (e) { /* déjà présent */ }
        try { await db.execute(`ALTER TABLE mouvements_revendeur ADD COLUMN code_facture TEXT`); } catch (e) { /* déjà présent */ }
        // Migration : sens de l'attestation (ACHAT = le commerce achète / VENTE = le commerce vend)
        try { await db.execute(`ALTER TABLE attestations ADD COLUMN sens TEXT DEFAULT 'ACHAT'`); } catch (e) { /* déjà présent */ }

        // Migration : ajout de la référence produit (champ optionnel) — utilisée pour la recherche
        try { await db.execute(`ALTER TABLE products ADD COLUMN reference TEXT`); } catch (e) { /* déjà présent */ }
        // Contenu de l'unité de vente : ex. carton = 12 pièces. Les
        // conditionnements existants gardent la priorité lorsqu'ils sont définis.
        try { await db.execute(`ALTER TABLE products ADD COLUMN contenu_unite REAL DEFAULT 1`); } catch (e) { /* déjà présent */ }

        // Migration : colonnes d'ANNULATION (remplace la suppression) sur les tables métier.
        // Un enregistrement annulé reste visible et tracé, mais est exclu des stocks/totaux.
        // est_annule = 0/1 ; date_annulation ; annule_par (nom utilisateur) ; motif_annulation (optionnel)
        const tablesAnnulables = ['products', 'ventes', 'commandes', 'factures', 'factures_revendeur', 'decomptes', 'clients', 'charges_fonctionnement'];
        for (const table of tablesAnnulables) {
            try { await db.execute(`ALTER TABLE ${table} ADD COLUMN est_annule INTEGER DEFAULT 0`); } catch (e) { /* déjà présent */ }
            try { await db.execute(`ALTER TABLE ${table} ADD COLUMN date_annulation DATETIME`); } catch (e) { /* déjà présent */ }
            try { await db.execute(`ALTER TABLE ${table} ADD COLUMN annule_par TEXT`); } catch (e) { /* déjà présent */ }
            try { await db.execute(`ALTER TABLE ${table} ADD COLUMN motif_annulation TEXT`); } catch (e) { /* déjà présent */ }
        }

        // Migration : référentiel des MOYENS DE PAIEMENT (extensible).
        // Chaque moyen appartient à une « famille » (categorie) qui pilote la
        // ventilation espèces/transferts de la caisse ; le libellé précis
        // (Orange Money, Wave, ou un mode « Autre » saisi par l'opérateur) est
        // conservé pour l'affichage et les filtres, et réapparaît ensuite dans la liste.
        try {
            await db.execute(`
                CREATE TABLE IF NOT EXISTS moyens_paiement (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT UNIQUE NOT NULL,
                    libelle TEXT NOT NULL,
                    categorie TEXT NOT NULL CHECK (categorie IN ('ESPECES','MOBILE_MONEY','VIREMENT','CHEQUE','AUTRE')),
                    est_systeme INTEGER DEFAULT 0,
                    est_actif INTEGER DEFAULT 1,
                    ordre INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            const moyensDefaut: Array<[string, string, string, number]> = [
                ['ESPECES', 'Espèces', 'ESPECES', 1],
                ['ORANGE_MONEY', 'Orange Money', 'MOBILE_MONEY', 10],
                ['MOOV_MONEY', 'Moov Money', 'MOBILE_MONEY', 11],
                ['TELECEL_MONEY', 'Telecel Money', 'MOBILE_MONEY', 12],
                ['WAVE', 'Wave', 'MOBILE_MONEY', 13],
                ['SANK_MONEY', 'Sank Money', 'MOBILE_MONEY', 14],
                ['VIREMENT', 'Virement bancaire', 'VIREMENT', 20],
                ['CHEQUE', 'Chèque', 'CHEQUE', 30],
                ['AUTRE', 'Autre', 'AUTRE', 40],
            ];
            for (const [code, libelle, categorie, ordre] of moyensDefaut) {
                try {
                    await db.execute(
                        `INSERT OR IGNORE INTO moyens_paiement (code, libelle, categorie, est_systeme, est_actif, ordre)
                         VALUES (?, ?, ?, 1, 1, ?)`,
                        [code, libelle, categorie, ordre]
                    );
                } catch (e) { /* ignoré */ }
            }
            // Normalisation Télétel -> Telecel sur les bases déjà initialisées.
            try {
                await db.execute(`UPDATE moyens_paiement SET code='TELECEL_MONEY', libelle='Telecel Money' WHERE code='TELETEL_MONEY'`);
                await db.execute(`UPDATE journal_caisse SET mode_paiement_detail='Telecel Money' WHERE mode_paiement_detail='Télétel Money'`);
            } catch (e) { /* ignoré */ }
            // Harmonisation des statuts de décompte (ancien 'EN_ATTENTE' -> 'valide').
            try { await db.execute(`UPDATE decomptes SET statut='valide' WHERE statut='EN_ATTENTE'`); } catch (e) { /* ignoré */ }
        } catch (e) {
            console.error('Erreur création référentiel moyens_paiement:', e);
        }

        // Colonnes « mode de paiement » sur le journal de caisse (bases anciennes).
        // Sans elles, l'enregistrement d'une charge / d'un encaissement échoue
        // (colonne manquante). ALTER idempotent : ignoré si déjà présent.
        try { await db.execute(`ALTER TABLE journal_caisse ADD COLUMN mode_paiement TEXT`); } catch (e) { /* déjà présent */ }
        try { await db.execute(`ALTER TABLE journal_caisse ADD COLUMN mode_paiement_detail TEXT`); } catch (e) { /* déjà présent */ }

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

        // Vérifier les tables des revendeurs ponctuels
        const tempResellerTables = tables.filter(t => 
            t.name === 'revendeurs_ponctuels' || 
            t.name === 'mouvements_revendeurs' || 
            t.name === 'mouvement_evenements' ||
            t.name === 'mouvement_etats'
        );
        if (tempResellerTables.length === 4) {
            console.log('✅ Tables des revendeurs ponctuels créées avec succès');
        } else {
            console.warn('⚠️ Certaines tables des revendeurs ponctuels manquent');
        }

        // Vérifier les tables des sessions caisse
        const sessionTables = tables.filter(t => t.name === 'sessions_caisse');
        if (sessionTables.length > 0) {
            console.log('✅ Table sessions_caisse créée avec succès');
        } else {
            console.warn('⚠️ Table sessions_caisse non trouvée');
        }

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
        console.error('❌ Erreur lors de l\'initialisation de la base de données:', errorMsg);
        throw error;
    }
};

/**
 * Ferme la connexion à la base de données
 */
export const closeDatabase = async (): Promise<void> => {
    if (dbInstance) {
        try {
            await dbInstance.close();
            dbInstance = null;
            console.log('🔒 Base de données déconnectée');
        } catch (error) {
            console.error('❌ Erreur lors de la fermeture de la base:', error);
            throw error;
        }
    }
};

/**
 * Vérifie si la base de données est connectée
 */
export const isDatabaseConnected = (): boolean => {
    return dbInstance !== null;
};

/**
 * Exécute une transaction avec rollback automatique en cas d'erreur
 */
export const transaction = async <T>(
    callback: (db: DbLike) => Promise<T>
): Promise<T> => {
    const db = await getDb();
    try {
        await db.execute('BEGIN TRANSACTION');
        const result = await callback(db);
        await db.execute('COMMIT');
        return result;
    } catch (error) {
        await db.execute('ROLLBACK');
        throw error;
    }
};

/**
 * Nettoie les données de test (à utiliser avec précaution)
 */
export const clearDatabase = async (): Promise<void> => {
    const db = await getDb();
    try {
        await db.execute('BEGIN TRANSACTION');
        
        // Supprimer les données des tables principales (sans supprimer les tables)
        await db.execute('DELETE FROM journal_caisse');
        await db.execute('DELETE FROM charges_fonctionnement');
        await db.execute('DELETE FROM ventes');
        await db.execute('DELETE FROM vente_details');
        await db.execute('DELETE FROM mouvements_stock');
        await db.execute('DELETE FROM mouvements_revendeurs');
        await db.execute('DELETE FROM mouvement_evenements');
        await db.execute('DELETE FROM mouvement_etats');
        await db.execute('DELETE FROM revendeurs_ponctuels');
        await db.execute('DELETE FROM sessions_caisse');

        // Réinitialiser les séquences
        await db.execute("DELETE FROM sqlite_sequence WHERE name IN ('journal_caisse', 'charges_fonctionnement', 'ventes', 'vente_details', 'mouvements_stock', 'lots_stock', 'mouvements_revendeurs', 'mouvement_evenements', 'mouvement_etats', 'revendeurs_ponctuels', 'sessions_caisse')");

        await db.execute('COMMIT');
        console.log('🧹 Base de données nettoyée');
    } catch (error) {
        await db.execute('ROLLBACK');
        console.error('❌ Erreur lors du nettoyage:', error);
        throw error;
    }
};

// Export par défaut
export default {
    getDb,
    initDatabase,
    closeDatabase,
    isDatabaseConnected,
    debugLocks,
    transaction,
    clearDatabase
};
