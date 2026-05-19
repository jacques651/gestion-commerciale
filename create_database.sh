#!/bin/bash
# =====================================================
# Script de création de la base de données
# Gestion Commerciale Universelle
# Version: 3.0.0
# =====================================================

set -e  # Arrêter le script en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =====================================================
# FONCTIONS UTILITAIRES
# =====================================================

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Détection du système d'exploitation
detect_os() {
    case "$(uname -s)" in
        Darwin*)    OS="macos";;
        Linux*)     OS="linux";;
        MINGW*|MSYS*|CYGWIN*) OS="windows";;
        *)          OS="unknown";;
    esac
    print_info "Système détecté: $OS"
}

# Déterminer le chemin de la base de données
get_db_path() {
    case "$OS" in
        windows)
            DB_PATH="$APPDATA/com.user.gestion-commerciale/gestion-commerciale.db"
            ;;
        macos)
            DB_PATH="$HOME/Library/Application Support/com.user.gestion-commerciale/gestion-commerciale.db"
            ;;
        linux)
            DB_PATH="$HOME/.local/share/gestion-commerciale/gestion-commerciale.db"
            ;;
        *)
            DB_PATH="./gestion-commerciale.db"
            ;;
    esac
}

# =====================================================
# PARAMETRES PAR DEFAUT (peuvent être surchargés)
# =====================================================

# Variables configurables via arguments
DB_PATH=""
SCHEMA_FILE="schema.sql"
FORCE_RECREATE=0
BACKUP_BEFORE_DELETE=1
CREATE_TEST_DATA=0

# =====================================================
# AFFICHAGE DE L'AIDE
# =====================================================

show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -p, --path PATH     Chemin personnalisé pour la base de données"
    echo "  -s, --schema FILE   Fichier schema SQL à utiliser (défaut: schema.sql)"
    echo "  -f, --force         Forcer la recréation sans confirmation"
    echo "  -n, --no-backup     Ne pas créer de sauvegarde avant suppression"
    echo "  -t, --test-data     Créer des données de test après l'installation"
    echo "  -h, --help          Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0                           # Installation standard"
    echo "  $0 -p ./data/mydb.db         # Installation avec chemin personnalisé"
    echo "  $0 -f -t                     # Installation forcée avec données test"
    echo "  $0 --no-backup               # Installation sans sauvegarde"
}

# =====================================================
# TRAITEMENT DES ARGUMENTS
# =====================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--path)
            DB_PATH="$2"
            shift 2
            ;;
        -s|--schema)
            SCHEMA_FILE="$2"
            shift 2
            ;;
        -f|--force)
            FORCE_RECREATE=1
            shift
            ;;
        -n|--no-backup)
            BACKUP_BEFORE_DELETE=0
            shift
            ;;
        -t|--test-data)
            CREATE_TEST_DATA=1
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Option inconnue: $1"
            show_help
            exit 1
            ;;
    esac
done

# =====================================================
# MAIN SCRIPT
# =====================================================

echo ""
echo "=========================================="
echo "   GESTION COMMERCIALE UNIVERSELLE"
echo "   Installation de la base de données"
echo "=========================================="
echo ""

# Détection du système
detect_os

# Déterminer le chemin de la DB si non spécifié
if [ -z "$DB_PATH" ]; then
    get_db_path
fi

# Vérifier l'existence du fichier schema
if [ ! -f "$SCHEMA_FILE" ]; then
    print_error "Fichier schema '$SCHEMA_FILE' introuvable!"
    print_info "Assurez-vous que le fichier schema.sql est dans le même répertoire"
    exit 1
fi

print_info "Fichier schema: $SCHEMA_FILE"
print_info "Base de données: $DB_PATH"

# Créer le dossier parent si nécessaire
DB_DIR=$(dirname "$DB_PATH")
if [ ! -d "$DB_DIR" ]; then
    print_info "Création du dossier: $DB_DIR"
    mkdir -p "$DB_DIR"
fi

# Gestion de la base existante
if [ -f "$DB_PATH" ]; then
    if [ $BACKUP_BEFORE_DELETE -eq 1 ]; then
        BACKUP_PATH="${DB_PATH%.db}_backup_$(date +%Y%m%d_%H%M%S).db"
        print_info "Création d'une sauvegarde: $BACKUP_PATH"
        cp "$DB_PATH" "$BACKUP_PATH"
        print_success "Sauvegarde créée"
    fi
    
    if [ $FORCE_RECREATE -eq 0 ]; then
        echo ""
        print_warning "Une base de données existe déjà à cet emplacement!"
        read -p "Voulez-vous la supprimer et en créer une nouvelle ? (o/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
            print_info "Installation annulée"
            exit 0
        fi
    fi
    
    print_info "Suppression de l'ancienne base de données..."
    rm -f "$DB_PATH"
fi

# Création de la base de données
echo ""
print_info "Création de la base de données..."

# Vérifier que sqlite3 est installé
if ! command -v sqlite3 &> /dev/null; then
    print_error "SQLite3 n'est pas installé!"
    print_info "Veuillez installer SQLite3:"
    echo "  - Ubuntu/Debian: sudo apt-get install sqlite3"
    echo "  - macOS: brew install sqlite3"
    echo "  - Windows: Télécharger depuis https://sqlite.org/download.html"
    exit 1
fi

# Exécution du script SQL
if sqlite3 "$DB_PATH" < "$SCHEMA_FILE" 2>&1; then
    print_success "Base de données créée avec succès"
else
    print_error "Erreur lors de la création de la base de données"
    exit 1
fi

# Vérification de l'intégrité
print_info "Vérification de l'intégrité..."
INTEGRITY_CHECK=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;")
if [ "$INTEGRITY_CHECK" = "ok" ]; then
    print_success "Intégrité de la base vérifiée"
else
    print_error "Problème d'intégrité détecté: $INTEGRITY_CHECK"
fi

# Affichage des statistiques
print_info "Statistiques de la base:"
sqlite3 "$DB_PATH" <<EOF
SELECT 'Tables créées: ' || COUNT(*) || ' tables' FROM sqlite_master WHERE type='table';
SELECT 'Index créés: ' || COUNT(*) || ' index' FROM sqlite_master WHERE type='index';
SELECT 'Triggers créés: ' || COUNT(*) || ' triggers' FROM sqlite_master WHERE type='trigger';
EOF

# Création des données de test si demandé
if [ $CREATE_TEST_DATA -eq 1 ]; then
    echo ""
    print_info "Création des données de test..."
    
    # Vérifier si le fichier de test existe
    if [ -f "test_data.sql" ]; then
        if sqlite3 "$DB_PATH" < "test_data.sql" 2>&1; then
            print_success "Données de test ajoutées"
        else
            print_warning "Erreur lors de l'ajout des données de test"
        fi
    else
        # Création de données de test minimales
        sqlite3 "$DB_PATH" <<EOF
        
-- Ajout d'un produit test
INSERT OR IGNORE INTO products (code_produit, designation, idUnite_vente, idUnite_achat, prix_achat_ht, prix_vente_ht, stock_physique)
VALUES ('TEST-001', 'Produit Test', (SELECT idUnite FROM unites WHERE code_unite='PC'), (SELECT idUnite FROM unites WHERE code_unite='PC'), 100, 150, 50);

-- Ajout d'un client test
INSERT OR IGNORE INTO clients (code_client, nom, prenom, telephone, email)
VALUES ('CLT-001', 'DUPONT', 'Jean', '0102030405', 'jean.dupont@email.com');

-- Ajout d'une vente test
INSERT INTO ventes (code_vente, montant_ttc, type_vente)
SELECT 'VENTE-001', 150, 'TEST'
FROM magasins LIMIT 1;

EOF
        print_success "Données de test minimales ajoutées"
    fi
fi

# =====================================================
# INFORMATIONS FINALES
# =====================================================

echo ""
echo "=========================================="
print_success "INSTALLATION TERMINÉE AVEC SUCCÈS"
echo "=========================================="
echo ""
echo "📁 Base de données: $DB_PATH"
echo "📄 Fichier schema: $SCHEMA_FILE"
echo ""
echo "🔐 Identifiants par défaut:"
echo "   Login: admin"
echo "   Mot de passe: admin123"
echo ""
echo "💡 Commandes utiles:"
echo "   - Ouvrir la base: sqlite3 \"$DB_PATH\""
echo "   - Voir les tables: .tables"
echo "   - Schéma d'une table: .schema products"
echo "   - Sauvegarder: .backup main backup.db"
echo ""
echo "⚠️  IMPORTANT: Changez le mot de passe administrateur après la première connexion !"
echo ""

# Créer un fichier .env pour les applications
if [ ! -f ".env" ]; then
    cat > .env <<EOF
# Configuration base de données
DATABASE_PATH=$DB_PATH
DATABASE_TYPE=sqlite
DB_VERSION=3.0.0
EOF
    print_success "Fichier .env créé"
fi

exit 0