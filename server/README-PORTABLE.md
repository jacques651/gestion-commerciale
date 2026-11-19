# Gestion Commerciale — version web multi-utilisateur (installation sur le PC hôte)

L'application devient un **serveur web** installé sur **un PC hôte** (au bureau).
Ce PC fait tourner le serveur ; tous les autres postes l'utilisent depuis un
**navigateur**, en réseau local (Ethernet ou WiFi). C'est du vrai multi-utilisateur :
les données sont partagées en temps réel.

La **clé USB ne sert qu'à transporter** le dossier jusqu'au PC hôte. Une fois copié
sur le disque du PC hôte, tout tourne depuis ce disque et la clé peut repartir.
La base de données reste sur le PC hôte.

Aucune installation « système » n'est nécessaire (pas de droits administrateur,
rien ajouté à Windows) : c'est un simple dossier qu'on copie et qu'on lance.

---

## Contenu du dossier à copier

```
GestionCommerciale\
├── node\                     ← node.exe portable (Windows) — voir « Préparation »
├── server\
│   ├── index.mjs             ← serveur (HTTP + SQLite intégré, zéro dépendance)
│   └── schema.sql
├── dist\                     ← application web compilée (npm run web:build)
├── data\                     ← base de données (créée au 1er lancement, sur le PC hôte)
├── Lancer-Gestion-Commerciale.bat  ← double-clic pour démarrer
└── Installer.bat             ← (optionnel) copie le dossier + crée un raccourci bureau
```

- **Le fichier SQLite est ouvert par le seul serveur** du PC hôte. Les postes clients
  ne touchent jamais le fichier ; ils passent par HTTP. C'est ce qui rend le
  multi-utilisateur sûr avec SQLite (mode WAL pour les lectures concurrentes).

---

## Préparation du dossier (une fois, par un technicien)

### Méthode automatique (recommandée)

Sur la machine de développement (Node 22+ installé), à la racine du projet,
double-cliquer **`Preparer-Distribution.bat`**. Il :
1. installe les dépendances et compile l'application (`npm run web:build`) ;
2. télécharge le **Node portable** Windows (ou réutilise `node\node.exe` s'il existe) ;
3. assemble un dossier propre **`Distribution\GestionCommerciale\`** contenant
   uniquement `node\`, `server\`, `dist\`, les `.bat` et un dossier `data\` vide.

Il ne reste qu'à copier ce dossier `GestionCommerciale\` sur la **clé USB**.

### Méthode manuelle (si besoin)

1. **Compiler** : `npm install` puis `npm run web:build` → produit `dist\`.
2. **Node portable** : télécharger « Windows Binary (.zip) » x64 sur https://nodejs.org
   (version 22 ou +), décompresser, copier `node.exe` dans un dossier `node\`.
   (Node 22+ requis : le serveur utilise le module SQLite intégré `node:sqlite`.)
3. **Rassembler** dans un dossier `GestionCommerciale\` : `node\`, `server\`, `dist\`,
   `Lancer-Gestion-Commerciale.bat`, `Installer.bat`. Le copier sur la clé USB.

> Ne copiez PAS `node_modules\` ni `src\` : ils ne servent qu'au développement.

---

## Installation sur le PC hôte (avec la clé)

1. Brancher la clé sur le **PC hôte**.
2. Copier le dossier `GestionCommerciale\` de la clé vers le disque du PC
   (ex. `C:\GestionCommerciale`). **Deux méthodes :**
   - **Manuelle** : glisser-déposer le dossier sur `C:\`.
   - **Assistée (recommandé)** : double-cliquer `Installer.bat` (il copie le dossier vers
     `C:\Users\VotreNom\GestionCommerciale` — aucun droit administrateur requis — et crée
     un raccourci « Gestion Commerciale » sur le bureau).
3. Retirer la clé — elle n'est plus nécessaire.

---

## Utilisation quotidienne (sur le PC hôte)

1. Double-cliquer `Lancer-Gestion-Commerciale.bat` (ou le raccourci du bureau).
2. Une fenêtre affiche les adresses d'accès, par exemple :
   ```
   Sur ce PC     : http://localhost:8090
   Sur le reseau : http://192.168.1.20:8090   (autres postes LAN/WiFi)
   ```
3. Le navigateur s'ouvre automatiquement sur le PC hôte.
4. **Sur les autres postes** (PC, tablette, téléphone du même réseau), ouvrir un
   navigateur et saisir l'adresse réseau affichée (ex. `http://192.168.1.20:8090`).
5. **Ne pas fermer la fenêtre noire** pendant l'utilisation (la fermer arrête le serveur).

Chaque utilisateur se connecte avec son propre code d'accès.

> Astuce : pour un démarrage automatique à l'allumage du PC hôte, placer un raccourci
> vers `Lancer-Gestion-Commerciale.bat` dans le dossier Démarrage de Windows
> (touche Windows + R → `shell:startup` → y coller le raccourci).

---

## Sauvegarde

La base est le fichier `...\GestionCommerciale\data\gestion-commerciale.db`
(plus les fichiers `-wal` / `-shm`). Pour sauvegarder : fermer le serveur, puis copier
le dossier `data\` ailleurs (autre disque, clé, cloud). Ne jamais copier la base
pendant que le serveur tourne.

---

## Options (variables d'environnement, dans le .bat)

| Variable   | Défaut                          | Rôle |
|------------|---------------------------------|------|
| `GC_PORT`  | `8090`                          | Port du serveur |
| `GC_DATA`  | `..\data`                       | Dossier de la base |
| `GC_TOKEN` | *(vide)*                        | Si défini, exige l'en-tête `x-gc-token` sur l'API |

---

## Sécurité (réseau local)

L'API est accessible aux appareils du réseau local. Un WiFi protégé par mot de passe
suffit généralement pour un magasin. Pour renforcer : définir `GC_TOKEN`.
