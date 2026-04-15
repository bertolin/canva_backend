Sur le serveur Debian, on a depuis avril 2026 2 environnements :
- canva_face_blurring_staging : permet de tester en situation réele, sur le serveur Debian
- canva_face_bluring_prod : la vraie version de production, visible depuis Canva

----------------------------------------------

J'ai donc rajouté ces 2 fichiers 
/etc/systemd/system/canva_face_blurring_prod.service
/etc/systemd/system/canva_face_blurring_staging.service
Ils servent à :
- déclarer deux services Linux
- lancer ton backend Node automatiquement
- gérer les crashs
- charger les variables d’environnement
- isoler STAGING et PROD
- permettre un déploiement propre et professionnel
C’est la manière standard de faire tourner une app Node en production.

Grâce à systemd, on peut :
✔ Démarrer
sudo systemctl start canva_face_blurring_staging
✔ Arrêter
sudo systemctl stop canva_face_blurring_staging
✔ Redémarrer
sudo systemctl restart canva_face_blurring_staging
✔ Voir les logs
sudo journalctl -u canva_face_blurring_staging -f
✔ Lancer automatiquement au démarrage du serveur
sudo systemctl enable canva_face_blurring_staging

----------------------------------------------

Sur le PC, il y a 2 fichiers pour déployer du PC vers Serveur staging et de serveur staging à serveur prod :
- C:\Users\bertolip-admin\Documents\canva_face_blurring\deploy_staging.sh
- C:\Users\bertolip-admin\Documents\canva_face_blurring\deploy_prod.sh
Attention : avant de faire l'un ou l'autre, il faut que le remote Git soit à jour

----------------------------------------------

Les fichier compilés (JS) sont dans le répertoire dis