#!/bin/bash
# permet de déployer le site staging du serveur Debian sur le site prod du serveur Debian
SERVER="bertolino@videoptimize.univ-grenoble-alpes.fr"
TARGET="/home/bertolino/canva_face_blurring_prod"

echo "🚀 Déploiement vers l'appli de PROD..."

ssh $SERVER "
  set -e

  echo '→ Passage dans le dossier cible'
  cd $TARGET

  echo '→ Configuration du dépôt Git'
  git branch --set-upstream-to=origin/main main
  git remote set-url origin https://github.com/bertolin/canva_face_blurring.git

  echo '→ Pull Git'
  git pull

  echo '→ Copie du fichier .env.production'
  cp .env.production .env

  echo '→ Installation des dépendances'
  npm install

  echo '→ Build du frontend + backend'
  npm run build:prod
  BUILD_STATUS=\$?

  if [ \$BUILD_STATUS -ne 0 ]; then
    echo '❌ Build échoué — déploiement annulé'
    exit 1
  fi

  echo '→ Redémarrage du service systemd'
  sudo systemctl restart canva_face_blurring_prod || exit 1

  echo '✓ Déploiement PROD terminé'
"

echo "🎉 PROD mise à jour !"
