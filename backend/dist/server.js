"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = __importDefault(require("fs"));
require("dotenv").config();
const execPromise = (0, util_1.promisify)(child_process_1.exec);
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
const authenticateUser = (req, res, next) => {
    if (isDev)
        return next();
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
        return res.status(401).send("Unauthorized");
    }
    next();
};
// -----------------------------------------------------------------------------
// 4) UTILITAIRES
// -----------------------------------------------------------------------------
const handleError = (res, error, message = "Internal server error") => {
    console.error(error);
    res.status(500).send({ error: message });
};
const processFile = (filename) => {
    const ext = path_1.default.extname(filename);
    const base = path_1.default.basename(filename, ext);
    return `${base}${ext}`;
};
const cleanupFiles = async (originalFilePath, processedFilePath, thumbnailFilePath) => {
    const deleteFile = (filePath) => {
        return new Promise((resolve, reject) => {
            const rmCommand = `rm -f ${filePath}`;
            (0, child_process_1.exec)(rmCommand, (error) => {
                if (error)
                    return reject(error);
                resolve();
            });
        });
    };
    try {
        await deleteFile(originalFilePath);
        await deleteFile(processedFilePath);
        if (thumbnailFilePath)
            await deleteFile(thumbnailFilePath);
    }
    catch (err) {
        console.error("Error during file cleanup:", err);
    }
};
// -----------------------------------------------------------------------------
// 5) MAIN
// -----------------------------------------------------------------------------
async function main() {
    let now = new Date();
    console.log("Démarrage du backend Canva (version du ", now, ")");
    const app = (0, express_1.default)();
    // OPTIONS AVANT TOUT
    app.options("/api/*", (req, res) => {
        const origin = req.headers.origin || "*";
        // res.setHeader("Access-Control-Allow-Origin", origin);
        // res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        // res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        return res.sendStatus(204);
    });
    app.use(express_1.default.json());
    // ROUTER API
    const router = express_1.default.Router();
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
            const inputFilePath = path_1.default.join(INPUT_DIR, originalFilename);
            const outputFilePath = path_1.default.join(OUTPUT_DIR, processFile(originalFilename));
            console.log("inputFilePath in server.ts =", inputFilePath);
            console.log("outputFilePath in server.ts =", outputFilePath);
            await fs_1.default.promises.writeFile(inputFilePath, buffer);
            const faceBlurringCommand = `"${EXE_FILE}" "${inputFilePath}" "${outputFilePath}"`;
            const { stdout } = await execPromise(faceBlurringCommand);
            const faceCountMatch = stdout.match(/(\d+)\s+faces\s+detected/);
            const faceCount = faceCountMatch ? parseInt(faceCountMatch[1], 10) : 0;
            if (isVideo) {
                const fileWithoutExtension = path_1.default.parse(outputFilePath).name;
                const thumbnailFilePath = path_1.default.join(OUTPUT_DIR, `thumbnail_${fileWithoutExtension}.jpg`);
                const firstFrameCommand = `ffmpeg -y -i ${outputFilePath} -vf "select=eq(n\\,0)" -q:v 2 ${thumbnailFilePath}`;
                await execPromise(firstFrameCommand);
                return res.status(200).send({
                    message: "File processed",
                    fileUrl: `${BASE_URL}/tmp/${path_1.default.basename(outputFilePath)}`,
                    thumbnailFileUrl: `${BASE_URL}/tmp/${path_1.default.basename(thumbnailFilePath)}`,
                    facesDetected: faceCount,
                    originalFilename,
                });
            }
            // IMAGE
            const RESULT_URL = `${BASE_URL}/tmp/${path_1.default.basename(outputFilePath)}`;
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
        }
        catch (error) {
            return handleError(res, error);
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
            const originalFilePath = path_1.default.join(INPUT_DIR, originalFilename);
            const processedFilePath = path_1.default.join(OUTPUT_DIR, processFile(originalFilename));
            let thumbnailFilePath;
            if (isVideo) {
                thumbnailFilePath = path_1.default.join(OUTPUT_DIR, `thumbnail_${path_1.default.parse(processedFilePath).name}.jpg`);
            }
            await cleanupFiles(originalFilePath, processedFilePath, thumbnailFilePath);
            return res.status(200).send({ message: "Files cleaned up" });
        }
        catch (error) {
            return handleError(res, error);
        }
    });
    // ---------------------------------------------------------------------------
    // ROUTE /tmp (fichiers statiques)
    // ---------------------------------------------------------------------------
    app.use("/tmp", express_1.default.static(OUTPUT_DIR));
    // ---------------------------------------------------------------------------
    // DÉMARRAGE DU SERVEUR
    // ---------------------------------------------------------------------------
    const PORT = process.env.CANVA_BACKEND_PORT || 3001;
    app.listen(PORT, () => {
        console.log(`Backend Canva running on port ${PORT}`);
    });
}
main();
