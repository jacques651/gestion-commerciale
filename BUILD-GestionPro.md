# Compiler et mettre à jour GestionPro

Double-cliquer sur `build.bat` dans le dossier du projet. Le script synchronise les dépendances avec `package-lock.json` si nécessaire, vérifie TypeScript, compile l’interface et le serveur, puis génère `GestionPro.exe` et `Preparer-prestations.exe` dans ce même dossier. Les scripts d’installation npm sont désactivés : la compilation web utilise SQLite intégré à Node, sans compiler l’ancien module natif de maintenance `better-sqlite3` et sans exiger Python/C++.

Si un autre ordinateur affiche « La migration prestations 3.1 doit être appliquée explicitement », copier `Preparer-prestations.exe` à côté de `GestionPro.exe` et du dossier `data`, puis double-cliquer sur cet outil. Il sauvegarde la base existante, applique la migration additive et contrôle les anciennes données avant validation. Attendre « PRÉPARATION TERMINÉE », puis actualiser GestionPro avec F5. La sauvegarde et son rapport sont placés dans `data/sauvegardes-prestations`. L’outil peut être relancé : aucun doublon de migration n’est créé. Il ne crée aucune base si le fichier attendu est absent. Cette opération n’est jamais exécutée au démarrage normal de GestionPro.

Le mode **web** est conservé. L’exécutable embarque Node, l’interface et le serveur : aucun Node installé ni dossier `node_modules` n’est nécessaire sur le poste utilisateur. La console serveur reste ouverte pendant l’utilisation ; le navigateur s’ouvre quand le serveur est prêt.

Les données ne sont pas embarquées. `GestionPro.exe` utilise `data/gestion-commerciale.db` à côté de lui, même si son répertoire de travail est différent. Pour actualiser une installation existante, remplacer uniquement son exécutable en conservant son dossier `data`. Ne pas déplacer l’exécutable seul ailleurs si l’on souhaite retrouver la même base. Les variables existantes `GC_DATA`, `GC_DB`, `GC_PORT`, `GC_HOST` et `GC_TOKEN` restent prises en charge.

La compilation ne lance ni l’application ni une migration. Le script conserve une copie de l’ancien exécutable dans `backups/builds` avant son remplacement. Un second double-clic sur la même version rouvre le navigateur si la base est identique. Si une ancienne instance occupe l’adresse habituelle, l’exécutable utilise automatiquement une adresse libre entre les ports 8090 et 8099, avec la même base. Il ne ferme aucun processus. Une valeur explicite `GC_PORT` reste strictement respectée. En cas d’erreur, la console attend Entrée et le détail est conservé dans `GestionPro-erreurs.log`. Le cache `.gestionpro-cache` contient uniquement des fichiers applicatifs extraits, séparés de `data`.

Options :

- `build.bat --pull` : récupère la branche distante configurée puis avance uniquement si Git peut le faire sans fusion. Refus si des modifications locales existent ou si la mise à jour touche `data` ou `backups`. Aucun stash/reset automatique.
- `build.bat --skip-install` : conserve les dépendances déjà installées.
- `build.bat --no-pause` : exécution automatisée.
- `GestionPro.exe --check` : affiche version, mode, base et port sans démarrer le serveur ni ouvrir SQLite.
- `GestionPro.exe --no-browser` : démarre le serveur sans ouvrir le navigateur.

Sur le poste de compilation : Windows, Node/npm et accès Internet pour la première installation des dépendances. Le moteur embarqué est celui de `node/node.exe` s’il existe, sinon le Node installé ; version 22.20 ou supérieure requise. L’exécutable généré est non signé. Le mécanisme utilisé est celui des [applications exécutables Node.js](https://nodejs.org/download/release/v22.20.0/docs/api/single-executable-applications.html).
