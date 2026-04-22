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

------------------------------------------------------------------------------------------------------------
Répertoire du floutage de visage :
/home/bertolino/videoptimize/src/face_blurring/

Source appelé par le backend :
/home/bertolino/videoptimize/src/face_blurring/face_blurring_saas.cpp
------------------------------------------------------------------------------------------------------------

Beware : For Linux compilation, the process is not the same than Under Windows.
Under Windows, the spooqs_face_blurring_lib includes the Yolov8FaceLib.
Under Linux, the spooqs_face_blurring_lib directly uses the Yolo sources files.
Therefore, it is required to get the latest source files from the Windows architecture (in C:/Tools/Onnx/Yolov8FaceOnnx), put them in the faceblurringlib/src/ directory
in order to compile them for the Linux version.

To compile face_blurring on the Videoptimize Debian server :

- compile yolov8_utils :
g++ -fPIC -I/usr/local/include/opencv4 -I/usr/local/include/onnxruntime-1.18.1     -c src/yolov8_utils.cpp -o work/yolov8_utils.o
src/yolov8_utils.cpp:1:9: warning: #pragma once in main file

- compile yolov8_face_onnx :
g++ -fPIC -I/usr/local/include/opencv4 -I/usr/local/include/onnxruntime-1.18.1     -c src/yolov8_face_onnx.cpp -o work/yolov8_face_onnx.o

- compile spooqs_face_blurring :
g++ -fPIC -I/usr/local/include/opencv4 -I/usr/local/include/onnxruntime-1.18.1     -c src/spooqs_face_blurring.cpp -o work/spooqs_face_blurring.o

- compile library libspooqs_face_blurring.so :
g++ -shared -o lib/libspooqs_face_blurring.so work/spooqs_face_blurring.o     work/yolov8_face_onnx.o work/yolov8_utils.o     -L/usr/local/lib -lonnxruntime -lopencv_calib3d -lopencv_core -lopencv_imgproc -lopencv_dnn     -lopencv_imgcodecs -lopencv_highgui

- compile executable face_blurring (la commande fonctionne bien le 22 avril 2026) :
g++ -I./src -I/usr/local/include/onnxruntime-1.18.1 -I/usr/local/include/opencv4  -I/usr/local/include/onnxruntime   -L./lib -o /home/bertolino/videoptimize/exe/face_blurring /home/bertolino/videoptimize/src/face_blurring/face_blurring_saas.cpp     -Wl,-rpath,/var/www/html/dev-canva/faceblurringapi/lib     -lspooqs_face_blurring -lopencv_calib3d -lopencv_core -lopencv_imgproc -lopencv_dnn -lopencv_imgcodecs -lopencv_highgui     -lonnxruntime


- test executable in the exe directory :
./face_blurring family.jpg family_blurred.jpg
./face_blurring amy.mp4 amy_blurred.mp4
