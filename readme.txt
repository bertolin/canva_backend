Le source du frontend (en test, sur le PC Windows) :
C:\Users\bertolip-admin\Documents\canva-apps-sdk-starter-kit\src\intents\design_editor\app.tsx

Le source du backend sur le serveur Debian :
/home/bertolino/canva_face_blurring/src/backend/server.ts

Lancement du frontend sur PC :
npm start

Lancement du backend sur Debian :
npm start

Le frontend est alors disponible dans un navigateur à l'adresse : 
https://www.canva.com/developers/app/AAHAAOvpWf4/version/1/code-upload puis Preview



Compilation forntend (à faire sur le PC dans C:\Users\bertolip-admin\Documents\canva_face_blurring):
npx tsc (compilation)
npm start ( ? )
npm run build (crée le bundle à uploader chez Canva)


Compilation backend (à faire sur le serveur Debian dans /home/bertolino/canva_face_blurring_staging/backend)
npx tsc -p tsconfig.prod.json

Redémarrage backend :
sudo systemctl restart canva-backend-staging

Contrôle du status :
systemctl status canva-backend-staging

Suivi des logs :
sudo journalctl -u canva-backend-staging -f

