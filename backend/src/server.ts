import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import fs from "fs";

require("dotenv").config();

const execPromise = promisify(exec);

// -----------------------------------------------------------------------------
// 1) DEV vs PROD
// -----------------------------------------------------------------------------
const isDev = false;

// -----------------------------------------------------------------------------
// 2) CONSTANTES
// -----------------------------------------------------------------------------
const INPUT_DIR = "/home/bertolino/canva_face_blurring_staging/backend/input/";
const OUTPUT_DIR = "/home/bertolino/canva_face_blurring_staging/backend/output/";
const EXE_FILE = "/home/bertolino/videoptimize/exe/face_blurring";
const BASE_URL = "https://canva-videoptimize.univ-grenoble-alpes.fr";

// -----------------------------------------------------------------------------
// 3) AUTH (désactivée en dev)
// ---------------------------------------------------EXE_FILE--------------------------
const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
  if (isDev) return next();

  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).send("Unauthorized");
  }
  next();
};

// -----------------------------------------------------------------------------
// 4) UTILITAIRES
// -----------------------------------------------------------------------------
const handleError = (
  res: express.Response,
  error: Error | string,
  message = "Internal server error"
) => {
  console.error(error);
  res.status(500).send({ error: message });
};

const processFile = (filename: string) => {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  return `${base}${ext}`;
};

const cleanupFiles = async (
  originalFilePath: string,
  processedFilePath: string,
  thumbnailFilePath?: string
) => {
  const deleteFile = (filePath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const rmCommand = `rm -f ${filePath}`;
      exec(rmCommand, (error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  };

  try {
    await deleteFile(originalFilePath);
    await deleteFile(processedFilePath);
    if (thumbnailFilePath) await deleteFile(thumbnailFilePath);
  } catch (err) {
    console.error("Error during file cleanup:", err);
  }
};

// -----------------------------------------------------------------------------
// 5) MAIN
// -----------------------------------------------------------------------------
async function main()
{
  let now = new Date();
  console.log("Démarrage du backend Canva (version du " , now, ")" );

const app = express();

// OPTIONS AVANT TOUT
app.options("/api/*", (req: Request, res: Response) => {
  const origin = req.headers.origin || "*";
 // res.setHeader("Access-Control-Allow-Origin", origin);
 // res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
 // res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res.sendStatus(204);
});

app.use(express.json());

  // ROUTER API
  const router = express.Router();
  app.use("/api", router);

  // ---------------------------------------------------------------------------
  // ROUTE /api/download
  // ---------------------------------------------------------------------------
  router.post("/download", authenticateUser, async (req, res) => {
    try {
      const { sourceUrl, mediaType, userId } = req.body;

      if (!sourceUrl) {
        return res.status(400).send({ error: "sourceUrl is required" });
      }

      const response = await fetch(sourceUrl);
      if (!response.ok) {
        return res.status(400).send({ error: "Failed to download media" });
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const isVideo = mediaType === "video";
      const extension = isVideo ? "mp4" : "jpg";
      const safeUserId = userId || "unknown_user";
      const originalFilename = `${mediaType}-${safeUserId}.${extension}`;

      const inputFilePath = path.join(INPUT_DIR, originalFilename);
      const outputFilePath = path.join(OUTPUT_DIR, processFile(originalFilename));

      console.log("inputFilePath in server.ts =", inputFilePath);
      console.log("outputFilePath in server.ts =", outputFilePath);

      await fs.promises.writeFile(inputFilePath, buffer);

      const faceBlurringCommand = `"${EXE_FILE}" "${inputFilePath}" "${outputFilePath}"`;
      const { stdout } = await execPromise(faceBlurringCommand);

      const faceCountMatch = stdout.match(/(\d+)\s+faces\s+detected/);
      const faceCount = faceCountMatch ? parseInt(faceCountMatch[1], 10) : 0;

      if (isVideo) {
        const fileWithoutExtension = path.parse(outputFilePath).name;
        const thumbnailFilePath = path.join(
          OUTPUT_DIR,
          `thumbnail_${fileWithoutExtension}.jpg`
        );

        const firstFrameCommand = `ffmpeg -y -i ${outputFilePath} -vf "select=eq(n\\,0)" -q:v 2 ${thumbnailFilePath}`;
        await execPromise(firstFrameCommand);

        return res.status(200).send({
          message: "File processed",
          fileUrl: `${BASE_URL}/tmp/${path.basename(outputFilePath)}`,
          thumbnailFileUrl: `${BASE_URL}/tmp/${path.basename(thumbnailFilePath)}`,
          facesDetected: faceCount,
          originalFilename,
        });
      }

      // IMAGE
      const RESULT_URL = `${BASE_URL}/tmp/${path.basename(outputFilePath)}`;
      console.log("RESULT_URL =", RESULT_URL);
      console.log("inputFilePath =", inputFilePath);
      console.log("outputFilePath =", outputFilePath);
      return res.status(200).send({
        message: "File processed",
        fileUrl: RESULT_URL,
        thumbnailFileUrl: RESULT_URL,
        facesDetected: faceCount,
        originalFilename,
      });
    } catch (error) {
      return handleError(res, error as Error);
    }
  });

  // ---------------------------------------------------------------------------
  // ROUTE /api/cleanup
  // ---------------------------------------------------------------------------
  router.post("/cleanup", authenticateUser, async (req, res) => {
    try {
      const { originalFilename, isVideo } = req.body;

      if (!originalFilename) {
        return res.status(400).send({ error: "Original filename required" });
      }

      const originalFilePath = path.join(INPUT_DIR, originalFilename);
      const processedFilePath = path.join(
        OUTPUT_DIR,
        processFile(originalFilename)
      );

      let thumbnailFilePath;
      if (isVideo) {
        thumbnailFilePath = path.join(
          OUTPUT_DIR,
          `thumbnail_${path.parse(processedFilePath).name}.jpg`
        );
      }

      await cleanupFiles(originalFilePath, processedFilePath, thumbnailFilePath);

      return res.status(200).send({ message: "Files cleaned up" });
    } catch (error) {
      return handleError(res, error as Error);
    }
  });

  // ---------------------------------------------------------------------------
  // ROUTE /tmp (fichiers statiques)
  // ---------------------------------------------------------------------------
  app.use("/tmp", express.static(OUTPUT_DIR));

  // ---------------------------------------------------------------------------
  // DÉMARRAGE DU SERVEUR
  // ---------------------------------------------------------------------------
  const PORT = process.env.CANVA_BACKEND_PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Backend Canva running on port ${PORT}`);
  });
}

main();
