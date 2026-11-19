# Gestion Commerciale — Travailler sur le code depuis n'importe quel PC

Ce dossier contient **tout le nécessaire pour développer** : code source,
dépendances et base de données de travail.

---

## 1. Mettre le code sur la clé USB

Sur votre PC habituel, double-cliquez sur :

```
Preparer-Cle-USB.bat
```

Il demande la lettre de la clé (ex. `E`) puis copie :

| Élément | Contenu | Taille |
|---|---|---|
| Code source | `src/`, `server/`, `src-tauri/`, configuration | ~3 Mo |
| `node_modules/` | Toutes les dépendances | plusieurs centaines de Mo |
| `data/` | Votre base de données | ~2 Mo |

La copie des dépendances est longue. **Si elle est interrompue, relancez
simplement le script** : robocopy reprend là où il s'était arrêté.

---

## 2. Travailler sur l'autre PC

### Étape 1 — Copier sur le disque dur

Copiez le dossier `GestionCommerciale-Source` de la clé **vers le disque dur**
(par exemple `C:\Dev\`).

> **Ne travaillez pas directement depuis la clé.** Les milliers de petits
> fichiers de `node_modules` rendent la compilation très lente en USB, et un
> retrait de la clé en pleine écriture corrompt le projet.

### Étape 2 — Lancer

Double-cliquez sur :

```
Demarrer-Dev.bat
```

Le script vérifie Node.js, vérifie les dépendances, puis ouvre
l'application sur <http://localhost:1420>.

**Les modifications du code sont appliquées instantanément** dans le
navigateur, sans redémarrage.

Pour arrêter : `Ctrl+C` dans la fenêtre noire.

---

## 3. Prérequis sur le PC d'accueil

**Node.js** doit être installé — <https://nodejs.org>, version LTS.

Si vous ne pouvez rien installer sur ce PC (poste verrouillé, cybercafé),
vous pouvez toujours *faire tourner* l'application avec `Demarrer.bat`, qui
embarque son propre Node. Mais vous ne pourrez pas la recompiler.

Les dépendances copiées contiennent les binaires pour **Windows 32 bits,
64 bits et ARM** — elles fonctionnent donc sur n'importe quel PC Windows
sans réinstallation.

---

## 4. Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Développement, rechargement automatique |
| `npm run build` | Compilation complète (vérifie les types **et** compile) |
| `npm run web:build` | Compilation seule, sans vérification des types |
| `npx tsc --noEmit` | Vérifier les types sans compiler |
| `npm run server` | Lancer le serveur de production local |

Avant toute distribution, lancez **`npm run build`** puis
**`Preparer-Distribution.bat`**.

---

## 5. Rapporter le travail sur le PC principal

Au retour, **ne recopiez pas tout le dossier par-dessus l'original** : vous
écraseriez la base de données du PC principal par celle de la clé.

Recopiez uniquement ce que vous avez modifié — en pratique le dossier
`src/` :

```
robocopy E:\GestionCommerciale-Source\src C:\Users\USER\gestion-commerciale\src /E
```

### Recommandation : utilisez Git

Le projet est déjà un dépôt Git. C'est de loin la méthode la plus sûre pour
faire des allers-retours entre machines sans rien écraser :

```bash
# Avant de partir, sur le PC principal
git add -A
git commit -m "Point de sauvegarde avant deplacement"

# Sur l'autre PC, apres avoir travaille
git add -A
git commit -m "Travail du <date> : <ce que vous avez fait>"

# Au retour sur le PC principal, comparer avant d'integrer
git diff
```

Git vous montre exactement ce qui a changé et vous évite les écrasements
accidentels.

---

## 6. Sécurité

La clé contient **votre base de données commerciale réelle** : clients,
ventes, chiffre d'affaires.

- Ne la laissez pas sans surveillance et ne la prêtez pas.
- En cas de perte, ces données sont lisibles par n'importe qui — SQLite
  n'est pas chiffré.
- Si vous n'avez pas besoin des vraies données pour développer, supprimez
  le dossier `data/` de la clé : l'application recréera une base vierge au
  premier lancement.

---

## 7. En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| `node n'est pas reconnu` | Node.js absent | Installer depuis nodejs.org |
| `Cannot find module` | Dépendances incomplètes | Lancer `npm install` |
| Page blanche au lancement | Compilation en cours | Attendre, puis rafraîchir (F5) |
| `Port 1420 already in use` | Un serveur tourne déjà | Fermer l'autre fenêtre, ou `Ctrl+C` |
| `database is locked` | Application ouverte ailleurs | Fermer les autres instances |
| Compilation très lente | Vous travaillez depuis la clé | Copier sur le disque dur |
