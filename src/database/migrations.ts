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
    name: 'Création des tables initiales',
    description: 'Création des tables de base (utilisateurs, clients, produits)',
    up: async (db) => {
      console.log('📦 Migration v1: Création des tables de base');
      
      const tables = await db.select(`SELECT name FROM sqlite_master WHERE type='table'`);
      const tableNames = (tables as any[]).map((t: any) => t.name);
      
      // 1. Créer la table utilisateurs
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
            description TEXT,
            categorie TEXT,
            unite_base TEXT DEFAULT 'pièce',
            prix_achat_base REAL DEFAULT 0,
            prix_vente_detail REAL DEFAULT 0,
            prix_vente_gros REAL DEFAULT 0,
            commission_pourcentage REAL DEFAULT 0,
            qte_stock REAL DEFAULT 0,
            seuil_alerte REAL DEFAULT 5,
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
            unite_reference_id INTEGER,
            FOREIGN KEY (unite_reference_id) REFERENCES unites(idUnite)
          )
        `);
        
        await db.execute(`
          INSERT OR IGNORE INTO unites (code_unite, nom_unite, symbole, est_unite_base) VALUES
          ('PC', 'Pièce', 'pc', 1),
          ('KG', 'Kilogramme', 'kg', 1),
          ('M', 'Mètre', 'm', 1),
          ('L', 'Litre', 'l', 1)
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
        
        await db.execute(`
          INSERT OR IGNORE INTO config_generale (id_config, nom_application, version, taux_tva_default) 
          VALUES (1, 'Gestion Commerciale Pro', '3.0.0', 18)
        `);
        console.log('✅ Table config_generale créée');
      }

      // 6. Créer la table categories
      if (!tableNames.includes('categories')) {
        await db.execute(`
          CREATE TABLE categories (
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
          )
        `);
        console.log('✅ Table categories créée');
      }

      // 7. Créer la table conditionnements
      if (!tableNames.includes('conditionnements')) {
        await db.execute(`
          CREATE TABLE conditionnements (
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
          )
        `);
        console.log('✅ Table conditionnements créée');
      }

      // 8. Créer la table configuration_atelier
      if (!tableNames.includes('configuration_atelier')) {
        await db.execute(`
          CREATE TABLE configuration_atelier (
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
          )
        `);
        
        await db.execute(`
          INSERT OR IGNORE INTO configuration_atelier (id, nom_atelier) VALUES (1, 'MON COMMERCE')
        `);
        console.log('✅ Table configuration_atelier créée');
      }

      // 9. Créer la table config_commerce
      if (!tableNames.includes('config_commerce')) {
        await db.execute(`
          CREATE TABLE config_commerce (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            id_type_commerce INTEGER NOT NULL DEFAULT 1,
            modules_actifs TEXT DEFAULT '[]',
            parametres TEXT DEFAULT '{}',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        await db.execute(`
          INSERT OR IGNORE INTO config_commerce (id, id_type_commerce, modules_actifs, parametres) 
          VALUES (1, 1, '[]', '{"tva_default":18,"devise":"FCFA"}')
        `);
        console.log('✅ Table config_commerce créée');
      }

      // 10. Créer la table config_tva
      if (!tableNames.includes('config_tva')) {
        await db.execute(`
          CREATE TABLE config_tva (
            id_tva INTEGER PRIMARY KEY AUTOINCREMENT,
            code_tva TEXT UNIQUE NOT NULL,
            taux REAL NOT NULL,
            libelle TEXT NOT NULL,
            est_defaut INTEGER DEFAULT 0,
            est_actif INTEGER DEFAULT 1
          )
        `);
        
        await db.execute(`
          INSERT OR IGNORE INTO config_tva (code_tva, taux, libelle, est_defaut) VALUES
          ('TVA0', 0, 'TVA 0%', 0),
          ('TVA18', 18, 'TVA 18%', 1)
        `);
        console.log('✅ Table config_tva créée');
      }

      // 11. Créer la table config_modes_reglement
      if (!tableNames.includes('config_modes_reglement')) {
        await db.execute(`
          CREATE TABLE config_modes_reglement (
            id_mode INTEGER PRIMARY KEY AUTOINCREMENT,
            code_mode TEXT UNIQUE NOT NULL,
            libelle TEXT NOT NULL,
            necessite_reference INTEGER DEFAULT 0,
            delai_jours INTEGER DEFAULT 0,
            est_actif INTEGER DEFAULT 1
          )
        `);
        
        await db.execute(`
          INSERT OR IGNORE INTO config_modes_reglement (code_mode, libelle, necessite_reference) VALUES
          ('ESPECES', 'Espèces', 0),
          ('CHEQUE', 'Chèque', 1),
          ('VIREMENT', 'Virement', 1),
          ('CARTE', 'Carte bancaire', 1),
          ('MOBILE_MONEY', 'Mobile Money', 1)
        `);
        console.log('✅ Table config_modes_reglement créée');
      }
    }
  },

  // =====================================================
  // VERSION 2: Tables des commandes et factures
  // =====================================================
  {
    version: 2,
    name: 'Création des tables commandes et factures',
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
            idUtilisateur INTEGER,
            taux_commission REAL DEFAULT 60,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (idClient) REFERENCES clients(idClient),
            FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
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
            FOREIGN KEY (idProduit) REFERENCES products(idProduit),
            FOREIGN KEY (idConditionnement) REFERENCES conditionnements(idConditionnement)
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
            statut TEXT DEFAULT 'EN_ATTENTE',
            idUtilisateur INTEGER,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (idClient) REFERENCES clients(idClient),
            FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
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
            idConditionnement INTEGER,
            quantite_pieces REAL DEFAULT 0,
            libelle_conditionnement TEXT,
            FOREIGN KEY (idVente) REFERENCES ventes(idVente) ON DELETE CASCADE,
            FOREIGN KEY (idProduit) REFERENCES products(idProduit)
          )
        `);
        console.log('✅ Table vente_details créée');
      }

      // 7. Table reglements
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
            idDecompte INTEGER,
            FOREIGN KEY (idClient) REFERENCES clients(idClient),
            FOREIGN KEY (idFacture) REFERENCES factures(idFacture),
            FOREIGN KEY (idVente) REFERENCES ventes(idVente),
            FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
          )
        `);
        console.log('✅ Table reglements créée');
      }
    }
  },

  // =====================================================
  // VERSION 3: Tables des décomptes et revendeurs
  // =====================================================
  {
    version: 3,
    name: 'Création des tables décomptes et revendeurs',
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
            idFactureRevendeur INTEGER,
            id_facture_approvisionnement INTEGER,
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
            qte_avant_decompte REAL DEFAULT 0,
            prix_achat REAL DEFAULT 0,
            prix_vente REAL DEFAULT 0,
            commission_pourcentage REAL DEFAULT 0,
            designation TEXT,
            total REAL DEFAULT 0,
            benefice REAL DEFAULT 0,
            commission REAL DEFAULT 0,
            qte_reappro REAL DEFAULT 0,
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

      // 5. Table factures_revendeur_details
      if (!tableNames.includes('factures_revendeur_details')) {
        await db.execute(`
          CREATE TABLE factures_revendeur_details (
            idDetailFactureRevendeur INTEGER PRIMARY KEY AUTOINCREMENT,
            idFactureRevendeur INTEGER NOT NULL,
            idProduit INTEGER NOT NULL,
            qte_commande REAL NOT NULL,
            prix_achat_base REAL DEFAULT 0,
            prix_unitaire_vente REAL NOT NULL,
            FOREIGN KEY (idFactureRevendeur) REFERENCES factures_revendeur(idFactureRevendeur) ON DELETE CASCADE,
            FOREIGN KEY (idProduit) REFERENCES products(idProduit)
          )
        `);
        console.log('✅ Table factures_revendeur_details créée');
      }

      // 6. Table reglements_revendeur
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

      // 7. Table factures_approvisionnement
      if (!tableNames.includes('factures_approvisionnement')) {
        await db.execute(`
          CREATE TABLE factures_approvisionnement (
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
        `);
        console.log('✅ Table factures_approvisionnement créée');
      }

      // 8. Table factures_approvisionnement_details
      if (!tableNames.includes('factures_approvisionnement_details')) {
        await db.execute(`
          CREATE TABLE factures_approvisionnement_details (
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
        `);
        console.log('✅ Table factures_approvisionnement_details créée');
      }

      // 9. Table mouvements_revendeur
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

      // 10. Table mouvements_stock
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

      // 11. Table lots_stock
      if (!tableNames.includes('lots_stock')) {
        await db.execute(`
          CREATE TABLE lots_stock (
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
          )
        `);
        console.log('✅ Table lots_stock créée');
      }

      // 12. Table sorties_lots
      if (!tableNames.includes('sorties_lots')) {
        await db.execute(`
          CREATE TABLE sorties_lots (
            idSortieLot INTEGER PRIMARY KEY AUTOINCREMENT,
            idLot INTEGER NOT NULL,
            idMouvement INTEGER NOT NULL,
            quantite_sortie REAL NOT NULL,
            prix_vente_unitaire REAL NOT NULL,
            FOREIGN KEY (idLot) REFERENCES lots_stock(idLot),
            FOREIGN KEY (idMouvement) REFERENCES mouvements_stock(idMouvement)
          )
        `);
        console.log('✅ Table sorties_lots créée');
      }

      // 13. Table historique_prix
      if (!tableNames.includes('historique_prix')) {
        await db.execute(`
          CREATE TABLE historique_prix (
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
          )
        `);
        console.log('✅ Table historique_prix créée');
      }
    }
  },

  // =====================================================
  // VERSION 4: Tables financières et de caisse
  // =====================================================
  {
    version: 4,
    name: 'Création des tables financières et de caisse',
    description: 'Création des tables financières (journal, crédits, remboursements, sessions)',
    up: async (db) => {
      console.log('📦 Migration v4: Création des tables financières et de caisse');
      
      const tables = await db.select(`SELECT name FROM sqlite_master WHERE type='table'`);
      const tableNames = (tables as any[]).map((t: any) => t.name);

      // 1. Table sessions_caisse
      if (!tableNames.includes('sessions_caisse')) {
        await db.execute(`
          CREATE TABLE sessions_caisse (
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
        `);
        console.log('✅ Table sessions_caisse créée');
      }

      // 2. Table journal_caisse
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
            idSession INTEGER,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id),
            FOREIGN KEY (idSession) REFERENCES sessions_caisse(idSession)
          )
        `);
        console.log('✅ Table journal_caisse créée');
      }

      // 3. Table charges_fonctionnement
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
            idSession INTEGER,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal),
            FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
          )
        `);
        console.log('✅ Table charges_fonctionnement créée');
      }

      // 4. Table categories_charges
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

      // 5. Table recapitulatif_journalier
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

      // 6. Table credits
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
            date_echeance TEXT,
            statut TEXT NOT NULL DEFAULT 'EN_COURS' CHECK (statut IN ('EN_COURS', 'TERMINE', 'ANNULE')),
            idJournal INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (idJournal) REFERENCES journal_caisse(idJournal)
          )
        `);
        console.log('✅ Table credits créée');
      }

      // 7. Table remboursements
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

      // 8. Table config_types_commerce
      if (!tableNames.includes('config_types_commerce')) {
        await db.execute(`
          CREATE TABLE config_types_commerce (
            id_type_commerce INTEGER PRIMARY KEY AUTOINCREMENT,
            code_type TEXT UNIQUE NOT NULL,
            libelle TEXT NOT NULL,
            description TEXT,
            parametres_par_defaut TEXT,
            est_actif INTEGER DEFAULT 1
          )
        `);
        
        await db.execute(`
          INSERT OR IGNORE INTO config_types_commerce (code_type, libelle, description) VALUES
          ('DETAIL', 'Commerce de détail', 'Boutique, supermarché'),
          ('GROS', 'Commerce de gros', 'Distribution, grossiste'),
          ('MIXTE', 'Commerce mixte', 'Hybride'),
          ('SERVICE', 'Prestation de services', 'Atelier, réparation')
        `);
        console.log('✅ Table config_types_commerce créée');
      }

      // 9. Table config_modules
      if (!tableNames.includes('config_modules')) {
        await db.execute(`
          CREATE TABLE config_modules (
            id_module INTEGER PRIMARY KEY AUTOINCREMENT,
            code_module TEXT UNIQUE NOT NULL,
            nom_module TEXT NOT NULL,
            description TEXT,
            est_actif INTEGER DEFAULT 1,
            ordre_affichage INTEGER DEFAULT 0,
            date_activation DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        await db.execute(`
          INSERT OR IGNORE INTO config_modules (code_module, nom_module, ordre_affichage) VALUES
          ('VENTES', 'Ventes', 1),
          ('STOCK', 'Stock', 2),
          ('CLIENTS', 'Clients', 3),
          ('PRODUITS', 'Produits', 4),
          ('FINANCES', 'Finances', 5)
        `);
        console.log('✅ Table config_modules créée');
      }
    }
  },

  // =====================================================
  // VERSION 5: Tables des revendeurs ponctuels (ancien modèle - emprunts)
  // =====================================================
  {
    version: 5,
    name: 'Création des tables des revendeurs ponctuels (ancien modèle)',
    description: 'Création des tables pour la gestion des revendeurs ponctuels avec emprunts',
    up: async (db) => {
      console.log('📦 Migration v5: Création des tables des revendeurs ponctuels (ancien modèle)');
      
      const tables = await db.select(`SELECT name FROM sqlite_master WHERE type='table'`);
      const tableNames = (tables as any[]).map((t: any) => t.name);

      // 1. Table revendeurs_ponctuels
      if (!tableNames.includes('revendeurs_ponctuels')) {
        await db.execute(`
          CREATE TABLE revendeurs_ponctuels (
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
        `);
        console.log('✅ Table revendeurs_ponctuels créée');
      }

      // 2. Table emprunts_revendeurs
      if (!tableNames.includes('emprunts_revendeurs')) {
        await db.execute(`
          CREATE TABLE emprunts_revendeurs (
            idEmprunt INTEGER PRIMARY KEY AUTOINCREMENT,
            code_emprunt TEXT UNIQUE NOT NULL,
            idRevendeurPonctuel INTEGER NOT NULL,
            date_emprunt DATETIME DEFAULT CURRENT_TIMESTAMP,
            date_retour_prevue DATE,
            date_retour_effective DATE,
            statut TEXT DEFAULT 'EN_COURS' CHECK(statut IN ('EN_COURS', 'RETOURNE', 'PARTIELLEMENT_RETOURNE', 'VENDU', 'PERDU')),
            montant_total_emprunte REAL DEFAULT 0,
            montant_total_retourne REAL DEFAULT 0,
            notes TEXT,
            idUtilisateur INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (idRevendeurPonctuel) REFERENCES revendeurs_ponctuels(idRevendeurPonctuel),
            FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
          )
        `);
        console.log('✅ Table emprunts_revendeurs créée');
      }

      // 3. Table emprunt_details
      if (!tableNames.includes('emprunt_details')) {
        await db.execute(`
          CREATE TABLE emprunt_details (
            idEmpruntDetail INTEGER PRIMARY KEY AUTOINCREMENT,
            idEmprunt INTEGER NOT NULL,
            idProduit INTEGER NOT NULL,
            quantite_empruntee REAL NOT NULL,
            quantite_retournee REAL DEFAULT 0,
            quantite_vendue REAL DEFAULT 0,
            prix_vente_unitaire REAL DEFAULT 0,
            prix_achat_base REAL DEFAULT 0,
            date_retour DATE,
            notes TEXT,
            FOREIGN KEY (idEmprunt) REFERENCES emprunts_revendeurs(idEmprunt) ON DELETE CASCADE,
            FOREIGN KEY (idProduit) REFERENCES products(idProduit)
          )
        `);
        console.log('✅ Table emprunt_details créée');
      }

      // 4. Table mouvements_revendeurs_ponctuels
      if (!tableNames.includes('mouvements_revendeurs_ponctuels')) {
        await db.execute(`
          CREATE TABLE mouvements_revendeurs_ponctuels (
            idMouvement INTEGER PRIMARY KEY AUTOINCREMENT,
            idEmprunt INTEGER NOT NULL,
            idProduit INTEGER NOT NULL,
            type_mouvement TEXT NOT NULL CHECK(type_mouvement IN ('SORTIE_EMPRUNT', 'RETOUR', 'VENTE', 'PERTE')),
            quantite REAL NOT NULL,
            stock_avant REAL NOT NULL,
            stock_apres REAL NOT NULL,
            prix_unitaire REAL,
            date_mouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            idUtilisateur INTEGER,
            FOREIGN KEY (idEmprunt) REFERENCES emprunts_revendeurs(idEmprunt),
            FOREIGN KEY (idProduit) REFERENCES products(idProduit),
            FOREIGN KEY (idUtilisateur) REFERENCES utilisateurs(id)
          )
        `);
        console.log('✅ Table mouvements_revendeurs_ponctuels créée');
      }

      // 5. Créer les index pour les revendeurs ponctuels
      try {
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_emprunts_revendeur ON emprunts_revendeurs(idRevendeurPonctuel)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_emprunts_statut ON emprunts_revendeurs(statut)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_emprunts_date ON emprunts_revendeurs(date_emprunt)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_emprunts_details_emprunt ON emprunt_details(idEmprunt)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_emprunts_details_produit ON emprunt_details(idProduit)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_mouvements_rev_ponctuel_emprunt ON mouvements_revendeurs_ponctuels(idEmprunt)`);
        console.log('✅ Index des revendeurs ponctuels créés');
      } catch (e) {
        console.warn('⚠️ Certains index existent déjà');
      }
    }
  },
  // =====================================================
  // VERSION 6: Tables de configuration et journaux
  // =====================================================
  {
    version: 6,
    name: 'Création des tables de configuration et journaux',
    description: 'Création de debug_logs, licence_application, config_statuts et config_parametres',
    up: async (db) => {
      console.log('📦 Migration v6: Création des tables de configuration et journaux');

      const tables = await db.select(`SELECT name FROM sqlite_master WHERE type='table'`);
      const tableNames = (tables as any[]).map((t: any) => t.name);

      // 1. Table debug_logs
      if (!tableNames.includes('debug_logs')) {
        await db.execute(`
          CREATE TABLE debug_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            level TEXT NOT NULL,
            category TEXT NOT NULL,
            message TEXT NOT NULL,
            details TEXT,
            stack TEXT,
            app_version TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('✅ Table debug_logs créée');
      }

      // 2. Table licence_application
      if (!tableNames.includes('licence_application')) {
        await db.execute(`
          CREATE TABLE licence_application (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            first_launch_date TEXT NOT NULL,
            licence_key TEXT,
            valid_activation_key TEXT,
            licence_type TEXT DEFAULT 'BETA' CHECK(licence_type IN ('BETA', 'DEFINITIF')),
            statut TEXT DEFAULT 'ACTIF' CHECK(statut IN ('ACTIF', 'EXPIRE')),
            trial_days INTEGER DEFAULT 60,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await db.execute(`
          INSERT OR IGNORE INTO licence_application (id, first_launch_date, licence_type, statut, trial_days)
          VALUES (1, datetime('now'), 'BETA', 'ACTIF', 60)
        `);
        console.log('✅ Table licence_application créée');
      }

      // 3. Table config_statuts
      if (!tableNames.includes('config_statuts')) {
        await db.execute(`
          CREATE TABLE config_statuts (
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
          )
        `);
        console.log('✅ Table config_statuts créée');
      }

      // 4. Table config_parametres
      if (!tableNames.includes('config_parametres')) {
        await db.execute(`
          CREATE TABLE config_parametres (
            id_param INTEGER PRIMARY KEY AUTOINCREMENT,
            categorie TEXT NOT NULL,
            code_param TEXT NOT NULL,
            valeur TEXT,
            type_valeur TEXT DEFAULT 'string',
            description TEXT,
            modifiable INTEGER DEFAULT 1,
            UNIQUE(categorie, code_param)
          )
        `);
        console.log('✅ Table config_parametres créée');
      }
    },
    down: async (db) => {
      await db.execute(`DROP TABLE IF EXISTS config_parametres`);
      await db.execute(`DROP TABLE IF EXISTS config_statuts`);
      await db.execute(`DROP TABLE IF EXISTS licence_application`);
      await db.execute(`DROP TABLE IF EXISTS debug_logs`);
    }
  },

  // =====================================================
  // VERSION 7: Index et contraintes
  // =====================================================
  {
    version: 7,
    name: 'Ajout des index et contraintes',
    description: 'Ajout des index et contraintes pour optimiser les performances',
    up: async (db) => {
      console.log('📦 Migration v7: Ajout des index et contraintes');

      const indexes = [
        // Utilisateurs
        'CREATE INDEX IF NOT EXISTS idx_utilisateurs_login ON utilisateurs(login)',
        'CREATE INDEX IF NOT EXISTS idx_utilisateurs_role ON utilisateurs(role)',
        
        // Clients
        'CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(type_client)',
        'CREATE INDEX IF NOT EXISTS idx_clients_nom ON clients(raison_sociale)',
        'CREATE INDEX IF NOT EXISTS idx_clients_code ON clients(code_client)',
        
        // Products
        'CREATE INDEX IF NOT EXISTS idx_products_code ON products(code_produit)',
        'CREATE INDEX IF NOT EXISTS idx_products_categorie ON products(categorie)',
        'CREATE INDEX IF NOT EXISTS idx_products_stock ON products(qte_stock)',
        
        // Commandes
        'CREATE INDEX IF NOT EXISTS idx_commandes_client ON commandes(idClient)',
        'CREATE INDEX IF NOT EXISTS idx_commandes_date ON commandes(date_commande)',
        'CREATE INDEX IF NOT EXISTS idx_commandes_statut ON commandes(statut)',
        'CREATE INDEX IF NOT EXISTS idx_commandes_code ON commandes(code_commande)',
        
        // Decomptes
        'CREATE INDEX IF NOT EXISTS idx_decomptes_client ON decomptes(idClient)',
        'CREATE INDEX IF NOT EXISTS idx_decomptes_date ON decomptes(date_decompte)',
        'CREATE INDEX IF NOT EXISTS idx_decomptes_statut ON decomptes(statut)',
        'CREATE INDEX IF NOT EXISTS idx_decomptes_code ON decomptes(code_decompte)',
        
        // Journal caisse
        'CREATE INDEX IF NOT EXISTS idx_journal_caisse_date ON journal_caisse(date_journal)',
        'CREATE INDEX IF NOT EXISTS idx_journal_caisse_type ON journal_caisse(type_mouvement)',
        'CREATE INDEX IF NOT EXISTS idx_journal_caisse_categorie ON journal_caisse(categorie)',
        'CREATE INDEX IF NOT EXISTS idx_journal_caisse_session ON journal_caisse(idSession)',
        
        // Factures
        'CREATE INDEX IF NOT EXISTS idx_factures_client ON factures(idClient)',
        'CREATE INDEX IF NOT EXISTS idx_factures_date ON factures(date_facture)',
        'CREATE INDEX IF NOT EXISTS idx_factures_statut ON factures(statut)',
        'CREATE INDEX IF NOT EXISTS idx_factures_code ON factures(code_facture)',
        
        // Ventes
        'CREATE INDEX IF NOT EXISTS idx_ventes_date ON ventes(date_vente)',
        'CREATE INDEX IF NOT EXISTS idx_ventes_client ON ventes(idClient)',
        'CREATE INDEX IF NOT EXISTS idx_ventes_code ON ventes(code_vente)',
        
        // Credits
        'CREATE INDEX IF NOT EXISTS idx_credits_beneficiaire ON credits(beneficiaire)',
        'CREATE INDEX IF NOT EXISTS idx_credits_statut ON credits(statut)',
        'CREATE INDEX IF NOT EXISTS idx_credits_date ON credits(date_credit)',
        
        // Remboursements
        'CREATE INDEX IF NOT EXISTS idx_remboursements_idCredit ON remboursements(idCredit)',
        'CREATE INDEX IF NOT EXISTS idx_remboursements_date ON remboursements(date_remboursement)',
        
        // Stock revendeur
        'CREATE INDEX IF NOT EXISTS idx_stock_revendeur_revendeur ON stock_revendeur(idRevendeur)',
        'CREATE INDEX IF NOT EXISTS idx_stock_revendeur_produit ON stock_revendeur(idProduit)',
        
        // Mouvements stock
        'CREATE INDEX IF NOT EXISTS idx_mouvements_stock_produit ON mouvements_stock(idProduit)',
        'CREATE INDEX IF NOT EXISTS idx_mouvements_stock_date ON mouvements_stock(date_mouvement)',
        'CREATE INDEX IF NOT EXISTS idx_mouvements_stock_reference ON mouvements_stock(reference)',
        
        // Lots stock
        'CREATE INDEX IF NOT EXISTS idx_lots_produit ON lots_stock(idProduit)',
        'CREATE INDEX IF NOT EXISTS idx_lots_date ON lots_stock(date_entree)',
        'CREATE INDEX IF NOT EXISTS idx_lots_code ON lots_stock(code_lot)',
        
        // Mouvements revendeur
        'CREATE INDEX IF NOT EXISTS idx_mvt_rev_produit ON mouvements_revendeur(idProduit)',
        'CREATE INDEX IF NOT EXISTS idx_mvt_rev_revendeur ON mouvements_revendeur(idRevendeur)',
        
        // Sessions caisse
        'CREATE INDEX IF NOT EXISTS idx_sessions_statut ON sessions_caisse(statut)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions_caisse(date_ouverture)',
        
        // Debug logs
        'CREATE INDEX IF NOT EXISTS idx_debug_logs_timestamp ON debug_logs(timestamp DESC)',
        'CREATE INDEX IF NOT EXISTS idx_debug_logs_level ON debug_logs(level)',
        
        // Emprunts revendeurs ponctuels
        'CREATE INDEX IF NOT EXISTS idx_emprunts_revendeur ON emprunts_revendeurs(idRevendeurPonctuel)',
        'CREATE INDEX IF NOT EXISTS idx_emprunts_statut ON emprunts_revendeurs(statut)',
        'CREATE INDEX IF NOT EXISTS idx_emprunts_date ON emprunts_revendeurs(date_emprunt)',
        'CREATE INDEX IF NOT EXISTS idx_emprunts_details_emprunt ON emprunt_details(idEmprunt)',
        'CREATE INDEX IF NOT EXISTS idx_emprunts_details_produit ON emprunt_details(idProduit)',
        'CREATE INDEX IF NOT EXISTS idx_mouvements_rev_ponctuel_emprunt ON mouvements_revendeurs_ponctuels(idEmprunt)',
        
        // Charges
        'CREATE INDEX IF NOT EXISTS idx_charges_date ON charges_fonctionnement(date_charge)',
        'CREATE INDEX IF NOT EXISTS idx_charges_categorie ON charges_fonctionnement(categorie_charge)',
        
        // Recapitulatif
        'CREATE INDEX IF NOT EXISTS idx_recap_date ON recapitulatif_journalier(date_recap)'
      ];

      for (const indexQuery of indexes) {
        try {
          await db.execute(indexQuery);
        } catch (e) {
          // Ignorer les erreurs d'index déjà existants
        }
      }
      
      console.log('✅ Tous les index ont été créés');
    }
  },

  // =====================================================
  // VERSION 8: Revendeurs ponctuels - Nouveau modèle avec cycle de vie
  // =====================================================
  {
    version: 8,
    name: 'Revendeurs ponctuels - Nouveau modèle avec cycle de vie',
    description: 'Migration vers le nouveau modèle de revendeurs ponctuels avec mouvements, événements et cycle de vie',
    up: async (db) => {
      console.log('📦 Migration v8: Nouveau modèle des revendeurs ponctuels avec cycle de vie');
      
      const tables = await db.select(`SELECT name FROM sqlite_master WHERE type='table'`);
      const tableNames = (tables as any[]).map((t: any) => t.name);

      // 1. Supprimer les anciennes tables si elles existent (version 5)
      try {
        // Supprimer les anciennes tables pour éviter les conflits
        await db.execute(`DROP TABLE IF EXISTS mouvements_revendeurs_ponctuels`);
        await db.execute(`DROP TABLE IF EXISTS emprunt_details`);
        await db.execute(`DROP TABLE IF EXISTS emprunts_revendeurs`);
        console.log('✅ Anciennes tables des revendeurs ponctuels supprimées');
      } catch (e) {
        console.log('ℹ️ Les anciennes tables n\'existent pas ou sont déjà supprimées');
      }

      // 2. Créer la table revendeurs_ponctuels (inchangée)
      if (!tableNames.includes('revendeurs_ponctuels')) {
        await db.execute(`
          CREATE TABLE revendeurs_ponctuels (
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
        `);
        console.log('✅ Table revendeurs_ponctuels créée');
      }

      // 3. Table mouvements_revendeurs (mouvements principaux)
      if (!tableNames.includes('mouvements_revendeurs')) {
        await db.execute(`
          CREATE TABLE mouvements_revendeurs (
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
        console.log('✅ Table mouvements_revendeurs créée');
      }

      // 4. Table mouvement_evenements
      if (!tableNames.includes('mouvement_evenements')) {
        await db.execute(`
          CREATE TABLE mouvement_evenements (
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
        `);
        console.log('✅ Table mouvement_evenements créée');
      }

      // 5. Table mouvement_etats (historique des changements de statut)
      if (!tableNames.includes('mouvement_etats')) {
        await db.execute(`
          CREATE TABLE mouvement_etats (
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
        `);
        console.log('✅ Table mouvement_etats créée');
      }

      // 6. Index pour les performances
      try {
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_mouvements_revendeur ON mouvements_revendeurs(idRevendeurPonctuel)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_mouvements_produit ON mouvements_revendeurs(idProduit)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_mouvements_date_sortie ON mouvements_revendeurs(date_sortie)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_mouvements_statut ON mouvements_revendeurs(statut)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_mouvements_code ON mouvements_revendeurs(code_mouvement)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_evenements_mouvement ON mouvement_evenements(idMouvement)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_evenements_date ON mouvement_evenements(date_evenement)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_evenements_type ON mouvement_evenements(type_evenement)`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_etats_mouvement ON mouvement_etats(idMouvement)`);
        console.log('✅ Index des revendeurs ponctuels créés');
      } catch (e) {
        console.warn('⚠️ Certains index existent déjà');
      }

      // 7. Migration des données de l'ancien modèle vers le nouveau
      try {
        // Vérifier si des données existent dans l'ancien modèle
        const oldData = await db.select(`SELECT COUNT(*) as count FROM emprunts_revendeurs`);
        if (oldData[0]?.count > 0) {
          console.log(`🔄 Migration de ${oldData[0].count} emprunts vers le nouveau modèle...`);
          
          // Migration des revendeurs ponctuels (déjà faite)
          // Migration des emprunts vers mouvements_revendeurs
          await db.execute(`
            INSERT INTO mouvements_revendeurs (
              code_mouvement,
              idRevendeurPonctuel,
              idProduit,
              date_sortie,
              quantite_sortie,
              prix_unitaire,
              montant_total,
              destination,
              statut,
              stock_avant_sortie,
              stock_apres_sortie,
              notes,
              idUtilisateur,
              created_at
            )
            SELECT 
              e.code_emprunt,
              e.idRevendeurPonctuel,
              ed.idProduit,
              e.date_emprunt,
              ed.quantite_empruntee,
              ed.prix_vente_unitaire,
              ed.quantite_empruntee * ed.prix_vente_unitaire,
              'PRESENTATION',
              CASE 
                WHEN e.statut = 'RETOURNE' THEN 'RETOURNE'
                WHEN e.statut = 'VENDU' THEN 'VENDU'
                WHEN e.statut = 'PARTIELLEMENT_RETOURNE' THEN 'PARTIELLEMENT_RETOURNE'
                ELSE 'EN_COURS'
              END,
              0,
              0,
              e.notes,
              e.idUtilisateur,
              e.created_at
            FROM emprunts_revendeurs e
            JOIN emprunt_details ed ON e.idEmprunt = ed.idEmprunt
          `);
          console.log('✅ Données migrées vers mouvements_revendeurs');
        }
      } catch (e) {
        console.warn('⚠️ Erreur lors de la migration des données:', e);
      }

      console.log('✅ Migration v8 terminée avec succès');
    },
    down: async (db) => {
      console.log('⏪ Rollback v8: Suppression des nouvelles tables');
      await db.execute(`DROP TABLE IF EXISTS mouvement_etats`);
      await db.execute(`DROP TABLE IF EXISTS mouvement_evenements`);
      await db.execute(`DROP TABLE IF EXISTS mouvements_revendeurs`);
      console.log('✅ Rollback v8 terminé');
    }
  }
];

// =====================================================
// MIGRATION MANAGER
// =====================================================
export class MigrationManager {
  static async runMigrations(): Promise<void> {
    try {
      const db = await getDb();
      
      // Vérifier si la table version existe
      const tables = await db.select(`SELECT name FROM sqlite_master WHERE type='table'`);
      const tableNames = (tables as any[]).map((t: any) => t.name);
      
      let currentVersion = 0;
      
      if (tableNames.includes('migration_version')) {
        const versionResult = await db.select(`SELECT version FROM migration_version ORDER BY id DESC LIMIT 1`);
        currentVersion = (versionResult as any[])[0]?.version || 0;
      } else {
        // Créer la table de version
        await db.execute(`
          CREATE TABLE migration_version (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version INTEGER NOT NULL,
            name TEXT,
            description TEXT,
            executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('✅ Table migration_version créée');
      }
      
      const pendingMigrations = MIGRATIONS.filter(m => m.version > currentVersion);
      
      if (pendingMigrations.length === 0) {
        console.log('✅ Aucune migration nécessaire');
        return;
      }
      
      console.log(`🔄 ${pendingMigrations.length} migration(s) à exécuter`);
      
      for (const migration of pendingMigrations) {
        console.log(`📦 Exécution de la migration v${migration.version}: ${migration.name}`);
        
        try {
          await migration.up(db);
          
          await db.execute(
            `INSERT INTO migration_version (version, name, description) VALUES (?, ?, ?)`,
            [migration.version, migration.name, migration.description]
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
  }> {
    try {
      const db = await getDb();
      const tables = await db.select(`SELECT name FROM sqlite_master WHERE type='table'`);
      const tableNames = (tables as any[]).map((t: any) => t.name);
      
      let currentVersion = 0;
      
      if (tableNames.includes('migration_version')) {
        const versionResult = await db.select(`SELECT version FROM migration_version ORDER BY id DESC LIMIT 1`);
        currentVersion = (versionResult as any[])[0]?.version || 0;
      }
      
      const latestVersion = MIGRATIONS.length > 0
        ? Math.max(...MIGRATIONS.map(m => m.version))
        : 0;
      
      return {
        currentVersion,
        latestVersion,
        pendingMigrations: MIGRATIONS.filter(m => m.version > currentVersion)
      };
    } catch (error) {
      console.error('Erreur lors de la récupération du statut:', error);
      return {
        currentVersion: 0,
        latestVersion: 0,
        pendingMigrations: []
      };
    }
  }
  
  static async rollbackToVersion(targetVersion: number): Promise<void> {
    try {
      const db = await getDb();
      const versionResult = await db.select(`SELECT version FROM migration_version ORDER BY id DESC LIMIT 1`);
      const currentVersion = (versionResult as any[])[0]?.version || 0;
      
      if (targetVersion >= currentVersion) {
        console.log('ℹ️ La version cible est supérieure ou égale à la version actuelle');
        return;
      }
      
      const migrationsToRollback = MIGRATIONS
        .filter(m => m.version > targetVersion && m.version <= currentVersion)
        .sort((a, b) => b.version - a.version);
      
      for (const migration of migrationsToRollback) {
        if (migration.down) {
          console.log(`⏪ Rollback de la migration v${migration.version}: ${migration.name}`);
          await migration.down(db);
          await db.execute(
            `DELETE FROM migration_version WHERE version = ?`,
            [migration.version]
          );
          console.log(`✅ Rollback v${migration.version} réussi`);
        } else {
          console.warn(`⚠️ Pas de fonction down pour la migration v${migration.version}`);
        }
      }
      
      console.log(`✅ Rollback vers la version ${targetVersion} terminé`);
      
    } catch (error) {
      console.error('❌ Erreur lors du rollback:', error);
      throw error;
    }
  }
}

export default MIGRATIONS;