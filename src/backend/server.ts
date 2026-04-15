import express, { Request, Response, NextFunction } from "express";

require("dotenv").config();
import cors from "cors";
import { createBaseServer } from "../utils/backend/base_backend/create";
import { createJwtMiddleware } from "../utils/backend/jwt_middleware";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import fs from "fs";

const isDev = os.platform() === "darwin" || os.platform() === "win32";
// macOS ou Windows = Dev
// Linux = Prod

// Constants from environment variables
const INPUT_DIR = isDev
  ? "C:\\Users\\bertolip-admin\\Documents\\TMP\\"
  : "/home/bertolino/videoptimize/input/";

const OUTPUT_DIR = isDev
  ? "C:\\Users\\bertolip-admin\\Documents\\TMP\\"
  : "/home/bertolino/videoptimize/input/";
  
const EXE_FILE = isDev
  ? "C:\\Users\\bertolip-admin\\Documents\\canva_face_blurring\\exe\\face_blurring.exe"
  // le source en local est sur le Dell laptop-405, projet C:\Tools\faceblurringlib\Testfaceblurringlib\main_canva.cpp
  : "/home/bertolino/videoptimize/exe/face_blurring";
  
const BASE_URL = process.env.CANVA_BACKEND_HOST;

const ALLOWED_ORIGINS = [
  "https://www.canva.com",
  "https://canva.spooqs.com",
  "https://app-aagtee-lyqc.canva-apps.com",
  "https://app-aagtee-lyqc.canva-apps.com:8080",
  "https://app-aagtfhw58xy.canva-apps.com",
  "https://app-aagtfhw58xy.canva-apps.com:8080",
  "https://app-aahaaovpwf4.canva-apps.com",
  "https://app-aahaaovpwf4.canva-apps.com:8080",
  " ",
];

// Middleware to verify authentication
const authenticateUser = (
  req: Request,
  res: Response,
  next: NextFunction
): void =>
{
  if (isDev)
  {
    return next(); // auth désactivée en Dev
  }

  const authHeader = req.headers["authorization"];
  if (!authHeader)
  {
    res.status(401).send("Unauthorized");
    return;
  }
  next();
};

// Error handling utility function
const handleError = (
  res: express.Response,
  error: Error | string,
  message = "Internal server error"
) =>
{
  console.error(error);
  res.status(500).send({ error: message });
};

const execPromise = promisify(exec);

async function main()
{
  console.log(`On rentre dans le main de server.ts. Version du 30 mars 2026`);
  error_log(`On rentre dans le main de server.ts. Version du 30 mars 2026`);
  
  const APP_ID = process.env.CANVA_APP_ID;
  if (!APP_ID)
  {
    throw new Error(`The CANVA_APP_ID environment variable is undefined.`);
  }

  const app = express();

  app.use(
    cors({
      origin: ALLOWED_ORIGINS,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // -------------------------------------------------------------------------
  // 1) INSTALLATION DU SERVEUR CANVA (intercepte les routes APRÈS)
  // -------------------------------------------------------------------------
  const server = createBaseServer(app);

  // -------------------------------------------------------------------------
  // 2) MIDDLEWARES GÉNÉRAUX
  // -------------------------------------------------------------------------
  app.use(express.json());

  // -------------------------------------------------------------------------
  // 3) ROUTER API
  // -------------------------------------------------------------------------
  const router = express.Router();
  app.use("/api", router);	// doit correspondre à la route utilisée dans le frontend

  // CORS
  const corsOptions = {
    origin: ALLOWED_ORIGINS,
    optionsSuccessStatus: 200,
  };
  router.use(cors(corsOptions));

  // JWT Canva 
  try
  {
    const jwtMiddleware = createJwtMiddleware(APP_ID);
    router.use(jwtMiddleware);
  }
  catch (error)
  {
    console.error("JWT Middleware setup failed:", error);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // 4) TOUTES LES ROUTES API
  // -------------------------------------------------------------------------

  const processFile = (filename: string) =>
  {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    return `${base}_blurred${ext}`;
  };

  const cleanupFiles = async (
    originalFilePath: string,
    processedFilePath: string,
    thumbnailFilePath?: string
  ) =>
  {
    // Function to delete a file
    const deleteFile = (filePath: string): Promise<void> =>
    {
      return new Promise((resolve, reject) =>
      {
        console.log(`Deleting file: ${filePath}`);
        const rmCommand = `rm -f ${filePath}`;
        exec(rmCommand, (error) =>
        {
          if (error)
          {
            console.error(`Error deleting file: ${filePath}:`, error);
            reject(error);
            return;
          }
          resolve(undefined);
        });
      });
    };
    try
    {
      // Delete the original file
      await deleteFile(originalFilePath);
      // Delete the processed file
      await deleteFile(processedFilePath);
      // If it's a video and there's a thumbnail, delete the thumbnail file
      if (thumbnailFilePath)
      {
        await deleteFile(thumbnailFilePath);
      }
    }
    catch (err)
    {
      console.error("Error during file cleanup:", err);
    }
  };

  // Nouvelle version de /download : reçoit sourceUrl, télécharge depuis Canva, traite, renvoie fileUrl
  router.post("/download", authenticateUser, async (req, res) =>
  {
    console.log("On essaye de downloader un fichier depuis Canva (SDK v3)");

    try
    {
      const { sourceUrl, mediaType, userId } = req.body;

      if (!sourceUrl)
      {
        console.error("No sourceUrl provided.");
        return res.status(400).send({ error: "sourceUrl is required" });
      }

      console.log("Downloading from Canva URL:", sourceUrl);

      // 1) Télécharger le média depuis Canva
      const response = await fetch(sourceUrl);
      if (!response.ok)
      {
        console.error("Failed to download media from Canva:", response.status);
        return res
          .status(400)
          .send({ error: "Failed to download media from Canva" });
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 2) Déterminer un nom de fichier local
      const isVideo = mediaType === "video";
      const extension = isVideo ? "mp4" : "jpg";
      const safeUserId = userId || "unknown_user";
      const originalFilename = `${mediaType}-${safeUserId}.${extension}`;

      const inputFilePath = path.join(INPUT_DIR, originalFilename);
      const outputFilePath = path.join(OUTPUT_DIR, processFile(originalFilename));

      console.log("Input path: ", inputFilePath);
      console.log("Output path: ", outputFilePath);

      // 3) Écrire le fichier téléchargé
      await fs.promises.writeFile(inputFilePath, buffer);

      // 4) Lancer le binaire de face blurring
	  const faceBlurringCommand = `"${EXE_FILE}" "${inputFilePath}" "${outputFilePath}"`;
      console.log("Face blurring command: ", faceBlurringCommand);

      try
      {
        const { stdout, stderr } = await execPromise(faceBlurringCommand);
        console.log("Face blurring command output:", stdout);
        console.error("Face blurring command errors:", stderr);

        // Extract the number of faces detected
        const faceCountMatch = stdout.match(/(\d+)\s+faces\s+detected/);
        let faceCount = 0;
        if (faceCountMatch && faceCountMatch[1])
        {
          faceCount = parseInt(faceCountMatch[1], 10);
        }

        if (isVideo)
        {
          const fileWithoutExtension = path.parse(outputFilePath).name;
          const outputFirstFrameFilePath = path.join(
            OUTPUT_DIR,
            `thumbnail_${fileWithoutExtension}.jpg`
          );

          const firstFrameCommand = `ffmpeg -y -i ${outputFilePath} -vf "select=eq(n\\,0)" -q:v 2 ${outputFirstFrameFilePath}`;

          try
          {
            await execPromise(firstFrameCommand);
            const thumbnailFileUrl = `${req.protocol}://canva.spooqs.com/tmp/${path.basename(
              outputFirstFrameFilePath
            )}`;
            const fileUrl = `${req.protocol}://canva.spooqs.com/tmp/${path.basename(
              outputFilePath
            )}`;

            return res.status(200).send({
              message: "File downloaded and processed.",
              fileUrl: fileUrl,
              thumbnailFileUrl: thumbnailFileUrl,
              facesDetected: faceCount,
              originalFilename,
            });
          }
          catch (frameError)
          {
            console.error("Error extracting frame from video:", frameError);
            return handleError(
              res,
              frameError as Error,
              "Error extracting frame from video."
            );
          }
        }
        else	// image
        {
			const RESULT_URL = `${BASE_URL}/tmp/${path.basename(outputFilePath)}`; 

			return res.status(200).send({
				message: "File downloaded and processed.",
				fileUrl: RESULT_URL,
				thumbnailFileUrl: RESULT_URL, // For images, thumbnail URL is the same as the file URL
				facesDetected: faceCount,
				originalFilename,
			});
        }
      }
      catch (execError)
      {
        console.error("Error processing file:", execError);
        return handleError(
          res,
          execError as Error,
          "Error processing file."
        );
      }
    }
    catch (error)
    {
      return handleError(res, error as Error, "Error processing file.");
    }
  });

  router.options("/tmp", (req, res) =>
  {
    const allowedOrigins = ALLOWED_ORIGINS;
    const origin = req.headers.origin;

    if (typeof origin === "string" && allowedOrigins.includes(origin))
    {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    else
    {
      // Optionally, log rejected origins for better monitoring
      console.log("Rejected origin:", origin);
      // return early with an error status if origin is not allowed
      return res.status(403).send({ error: "Origin not allowed" });
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).send(); // Respond to preflight requests
  });

  // Cleanup route
  router.post("/cleanup", authenticateUser, async (req, res) =>
  {
    try
    {
      const { originalFilename, isVideo } = req.body;

      if (!originalFilename)
      {
        return res
          .status(400)
          .send({ error: "Original filename is required" });
      }

      // Paths for the original and processed files
      const originalFilePath = path.join(INPUT_DIR, originalFilename);
      const processedFilePath = path.join(
        OUTPUT_DIR,
        processFile(originalFilename)
      );
      let thumbnailFilePath: string | undefined;

      // If the file is a video, set the thumbnail path
      if (isVideo)
      {
        thumbnailFilePath = path.join(
          OUTPUT_DIR,
          `thumbnail_${path.parse(processedFilePath).name}.jpg`
        );
      }

      // Perform cleanup
      await cleanupFiles(originalFilePath, processedFilePath, thumbnailFilePath);

      return res.status(200).send({ message: "Files cleaned up." });
    }
    catch (error)
    {
      return handleError(res, error as Error, "Files cleanup failed.");
    }
  });

  router.use("/tmp", express.static(OUTPUT_DIR));

  // -------------------------------------------------------------------------
  // 5) DÉMARRAGE DU SERVEUR
  // -------------------------------------------------------------------------
  server.start(process.env.CANVA_BACKEND_PORT);
}

main();
