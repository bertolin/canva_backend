🖥️ Backend Canva — Développement et déploiement (serveur Debian)
Le backend se développe et s’exécute uniquement sur le serveur Debian.
Il existe deux environnements :

Staging : pour tester en conditions réelles avec Canva

Production : pour l’application Canva publique (à venir)

Deux services systemd sont déjà prévus :

Code
/etc/systemd/system/canva_face_blurring_staging.service
/etc/systemd/system/canva_face_blurring_prod.service
Ce document décrit l’environnement staging, actuellement le seul opérationnel.

📁 Emplacement du code source backend
Le code TypeScript du backend se trouve dans :

Code
/home/bertolino/canva_face_blurring_staging/backend/src/
🛠 Compilation du backend
La compilation utilise tsc avec la configuration de production :

Code
cd /home/bertolino/canva_face_blurring_staging/backend
npx tsc -p tsconfig.json
Cette commande génère le fichier exécutable :

Code
dist/server.js
C’est ce fichier que systemd exécute.

🔄 Gestion du service backend (staging)
Redémarrer le backend
Code
sudo systemctl restart canva-backend-staging
Vérifier le statut
Code
systemctl status canva-backend-staging
Suivre les logs en temps réel
Code
sudo journalctl -u canva-backend-staging -f
🤖 Traitement de floutage des visages
Le backend appelle un exécutable C++ partagé avec l’application SaaS de face blurring.

Source C++ :
Code
/home/bertolino/videoptimize/src/face_blurring/face_blurring_saas.cpp
Exécutable utilisé par le backend :
Code
/home/bertolino/videoptimize/exe/face_blurring
📂 Répertoires utilisés par le backend
Le backend utilise trois répertoires internes :

input/
Répertoire où arrivent les fichiers envoyés par Canva.

output/
Répertoire où sont générés les fichiers résultats renvoyés à Canva.

middle/
Répertoire prévu pour stocker les frames des vidéos
(fonctionnalité non encore testée en avril 2026)

Ces répertoires se trouvent dans :

Code
/home/bertolino/canva_face_blurring_staging/backend/
📝 Notes
Le backend écoute en local (127.0.0.1) et est exposé via Nginx.

Le backend doit être compilé avant chaque redémarrage du service.

Le backend staging est utilisé par Canva via HTTPS (reverse proxy Nginx).
