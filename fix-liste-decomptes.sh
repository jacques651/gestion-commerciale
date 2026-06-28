#!/bin/bash
# Script de réparation rapide pour ListeDecomptes.tsx
FILE="src/components/decomptes/ListeDecomptes.tsx"
LAST=$(tail -1 "$FILE")

if [[ "$LAST" != "}" ]]; then
  echo "⚠️  Fichier tronqué, réparation..."
  # Supprimer la dernière ligne tronquée
  sed -i '$ d' "$FILE"
  cat >> "$FILE" << 'CLOSING'
ed(false)}>
                Fermer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
CLOSING
  echo "✅ Réparé ($(wc -l < $FILE) lignes)"
else
  echo "✅ Fichier OK ($(wc -l < $FILE) lignes)"
fi
