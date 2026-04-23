#!/bin/bash
# create_database.sh

echo "🔄 Création de la base de données..."

# Supprimer l'ancienne base si elle existe
DB_PATH="$HOME/AppData/Local/com.user.gestion-commerciale/gestion-commerciale.db"
rm -f "$DB_PATH"

# Créer le dossier si nécessaire
mkdir -p "$(dirname "$DB_PATH")"

# Créer la base de données avec le schema.sql
sqlite3 "$DB_PATH" < schema.sql

echo "✅ Base de données créée avec succès"
echo "📁 Emplacement: $DB_PATH"
