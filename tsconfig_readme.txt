tsconfig.base.json     ← configuration commune
tsconfig.json          ← configuration DEV (extends base)
tsconfig.prod.json     ← configuration PROD (extends base)

Comment utiliser ces fichiers ?
✔ En dev (sur ton PC)
npx ts-node -P tsconfig.json src/server.ts
ou simplement :
npm run dev

✔ Pour compiler en prod (sur ton PC ou sur le serveur)
npx tsc -p tsconfig.prod.json
Cela génère :
dist/server.js
👉 C’est ce fichier que systemd exécutera.