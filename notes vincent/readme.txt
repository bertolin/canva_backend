Ce dépôt contient les fichiers essentiels concernant l'application publique Face Blurring sur Canva.*

Les fichiers pdf donnent des infos utiles.

Les fichiers correspondent à la version Windows pour créer le bundle de l'application.

Note importante : les fichiers ne sont pas au même niveau concernant l'architecture Windows pour le développement, cf. détails plus bas. Les fichiers des sources backend ne sont pas nécessaires pour créer le bundle de l'application. De plus, pour les versions des fichiers server.ts et database.ts correspondant au serveur backend, il faut récupérer les versions du serveur.

La première chose à faire pour exploiter ces fichiers est de cloner le dépôt canva-apps-sdk-starter-kit sur une machine.

Note importante : le dépôt canva-apps-sdk-starter-kit évolue vite, il sera peut-être nécessaire de faire des mises à jour ou des modifications... De plus, il faut ajouter des packages, on se réfèrera aux fichiers pdf de développement.

Voici les endroits où les fichiers de ce dépôt sont a intégrer/remplacer/récupérer :
1) .env et .env.template : à la racine du dépôt canva-apps-sdk-starter-kit/.
2) app.tsx et index.tsx : sources frontend dans le répertoire canva-apps-sdk-starter-kit/src/.
3) app.js et messages_en.json : bundle de l'application et messages pour traduction, à récupérer dans le répertoire canva-apps-sdk-starter-kit/dist/. une fois le bundle compilé
4) server.ts et database.ts : sources backend pour test en local, dans le répertoire canva-apps-sdk-starter-kit/src/backend/. , les versions du serveur sont sans doute différentes juste au niveau des chemins...
