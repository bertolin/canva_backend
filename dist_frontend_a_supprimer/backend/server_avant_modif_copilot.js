"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
require("dotenv").config();
const cors_1 = __importDefault(require("cors"));
const multer_1 = __importDefault(require("multer"));
const create_1 = require("../utils/backend/base_backend/create");
const jwt_middleware_1 = require("../utils/backend/jwt_middleware");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
// import { initDb, upsertUserLog } from './database';  // Import your database functions
const util_1 = require("util");
const os_1 = __importDefault(require("os"));
const isDev = os_1.default.platform() === "darwin" || os_1.default.platform() === "win32";
// macOS ou Windows = Dev
// Linux = Prod
// Constants from environment variables
const TMP_CANVA_DIR = isDev
    ? "C:\\Users\\bertolip-admin\\Documents\\TMP\\"
    : "/home/bertolino/videoptimize/input/";
const PROCESSED_DIR = isDev
    ? "C:\\Users\\bertolip-admin\\Documents\\TMP\\"
    : "/home/bertolino/videoptimize/input/";
const ALLOWED_ORIGINS = [
    'https://www.canva.com',
    'https://canva.spooqs.com',
    'https://canva.spooqs.com/tmp_canva',
    'https://canva.spooqs.com:3001/tmp_canva',
    'https://app-aagtee-lyqc.canva-apps.com',
    'https://app-aagtee-lyqc.canva-apps.com:8080',
    'https://app-aagtfhw58xy.canva-apps.com',
    'https://app-aagtfhw58xy.canva-apps.com:8080',
    'https://app-aahaaovpwf4.canva-apps.com',
    'https://app-aahaaovpwf4.canva-apps.com:8080',
    ' '
];
// Middleware to verify authentication
//const authenticateUser = (req, res, next) => {
//  if (!req.canva || !req.canva.userId) {
//    return res.status(401).json({ error: "Unauthorized: User is not authenticated" });
//  }
//  next();
//};
const authenticateUser = (req, res, next) => {
    if (isDev) // on désactive l’auth en Dev
     {
    }
    else {
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            res.status(401).send("Unauthorized");
            return;
        }
        next();
    }
};
// Error handling utility function
const handleError = (res, error, message = "Internal server error") => {
    console.error(error);
    res.status(500).send({ error: message });
};
// Promise handling function
const execPromise = (0, util_1.promisify)(child_process_1.exec);
async function main() {
    console.log(`On rentre dans le main de server.ts. Version du 30 mars 2026`);
    const APP_ID = process.env.CANVA_APP_ID;
    if (!APP_ID) {
        throw new Error(`The CANVA_APP_ID environment variable is undefined. Set the variable in the project's .env file.`);
    }
    const app = (0, express_1.default)(); // added for upload
    // paramétrage de la route
    app.post("/tmp_canva", async (req, res) => {
        if (isDev) {
            console.log("Route DEV appelée");
            return res.json({ ok: true, mode: "dev" });
        }
        console.log("Route PROD appelée");
        return res.json({ ok: true, mode: "prod" });
    });
    app.use(express_1.default.json()); // added for upload
    const router = express_1.default.Router();
    app.use('/api', router); // added for upload
    // CORS options
    const corsOptions = {
        origin: ALLOWED_ORIGINS, // Your front-end server address
        optionsSuccessStatus: 200
    };
    router.use((0, cors_1.default)(corsOptions));
    // JWT Middleware
    try {
        const jwtMiddleware = (0, jwt_middleware_1.createJwtMiddleware)(APP_ID);
        router.use(jwtMiddleware);
    }
    catch (error) {
        console.error("JWT Middleware setup failed:", error);
        process.exit(1);
    }
    // Processing file utility function
    const processFile = (filename) => {
        const ext = path_1.default.extname(filename);
        const base = path_1.default.basename(filename, ext);
        return `${base}_blurred${ext}`;
    };
    // Cleaning function
    const cleanupFiles = async (originalFilePath, processedFilePath, thumbnailFilePath) => {
        // Function to delete a file
        const deleteFile = (filePath) => {
            return new Promise((resolve, reject) => {
                console.log(`Deleting file: ${filePath}`);
                const rmCommand = `rm -f ${filePath}`;
                (0, child_process_1.exec)(rmCommand, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error deleting file: ${filePath}:`, error);
                        reject(error); // Reject the promise if there's an error
                        return;
                    }
                    //console.log(`rm output: ${stdout}`);
                    //if (stderr) {
                    //  console.error(`rm errors: ${stderr}`);
                    //}
                    resolve(undefined);
                });
            });
        };
        try {
            // Delete the original file
            await deleteFile(originalFilePath);
            // Delete the processed file 
            await deleteFile(processedFilePath);
            // If it's a video and there's a thumbnail, delete the thumbnail file
            if (thumbnailFilePath) {
                await deleteFile(thumbnailFilePath);
            }
            //console.log("Files cleaned up.");
        }
        catch (err) {
            console.error('Error during file cleanup:', err);
        }
    };
    // Set up multer storage configuration
    const storage = multer_1.default.diskStorage({
        destination: function (req, file, cb) {
            cb(null, TMP_CANVA_DIR);
        },
        filename: function (req, file, cb) {
            cb(null, `${file.originalname}`);
        }
    });
    const download = (0, multer_1.default)({ storage: storage });
    // Health check route
    router.get("/tmp_canva", authenticateUser, async (req, res) => {
        try {
            //console.log("request", req.canva);
            res.status(200).send({
                appId: req.canva.appId,
                userId: req.canva.userId,
                brandId: req.canva.brandId,
            });
        }
        catch (error) {
            handleError(res, error, "Error handling frictionless authentication");
        }
    });
    // File download and processing route (marked async to handle database connections)
    router.post("/download", authenticateUser, download.single("media"), async (req, res) => {
        console.log("On essaye de downloader un fichier");
        // let db;  // Declare the db variable so we can close it later in the finally block
        try {
            if (!req.file) {
                console.error("No file downloaded.");
                return res.status(400).send({ error: "No file downloaded." });
            }
            console.log("Processing file:", req.file.filename);
            // Define media type (either image or video)
            const isVideo = req.file.mimetype.startsWith('video');
            const mediaType = isVideo ? 'video' : 'image';
            // Open the database connection
            //try
            //{
            //  db = await initDb();
            //console.log("Database opened.");
            //} catch (openError)
            //{
            //  console.error('Error opening database:', openError);
            //}
            // Define input and output file paths
            const inputFilePath = path_1.default.join(TMP_CANVA_DIR, req.file.filename);
            const outputFilePath = path_1.default.join(PROCESSED_DIR, processFile(req.file.filename)); // '../../../../../tmp_canva' for local
            console.log("Input path: ", inputFilePath);
            console.log("Output path: ", outputFilePath);
            // Face blurring command on backend server
            // const faceBlurringCommand = `/var/www/html/dev-canva/faceblurringapi/exe/spooqs_face_blurring ${inputFilePath} ${outputFilePath}`;
            const faceBlurringCommand = `/home/bertolino/videoptimize/exe/face_blurring ${inputFilePath} ${outputFilePath}`;
            console.log("Face blurring command: ", faceBlurringCommand);
            // Use execPromise instead of exec
            try {
                // Face blurring
                const { stdout, stderr } = await execPromise(faceBlurringCommand);
                console.log("Face blurring command output:", stdout);
                console.error("Face blurring command errors:", stderr);
                // Extract the number of faces detected
                const faceCountMatch = stdout.match(/(\d+)\s+faces\s+detected/);
                //		const faceCount = faceCountMatch ? parseInt(faceCountMatch[1], 10) : 0; // Default to 0 if no match
                let faceCount = 0;
                if (faceCountMatch && faceCountMatch[1]) {
                    faceCount = parseInt(faceCountMatch[1], 10);
                }
                /* if (db)
                {
                  try
                  {
                    // Log the user information in the database
                    await upsertUserLog(db, req.body.userId, mediaType, false, isVideo ? 0 : faceCount, isVideo ? faceCount : 0);
                    console.log(`${faceCount} faces blurred for user ${req.body.userId}.`);
                    console.log("Database user log updated.");
                  } catch (updateFacesError)
                  {
                    console.error('Error logging user data:', updateFacesError);
                  }
                }
                */
                if (isVideo) {
                    // Extract first frame from video
                    const fileWithoutExtension = path_1.default.parse(outputFilePath).name;
                    const outputFirstFrameFilePath = path_1.default.join(PROCESSED_DIR, `thumbnail_${fileWithoutExtension}.jpg`);
                    // Command to extract the first frame
                    const firstFrameCommand = `ffmpeg -y -i ${outputFilePath} -vf "select=eq(n\\,0)" -q:v 2 ${outputFirstFrameFilePath}`;
                    try {
                        await execPromise(firstFrameCommand); // Use execPromise for consistency
                        const thumbnailFileUrl = `${req.protocol}://canva.spooqs.com/tmp/${path_1.default.basename(outputFirstFrameFilePath)}`;
                        const fileUrl = `${req.protocol}://canva.spooqs.com/tmp/${path_1.default.basename(outputFilePath)}`;
                        return res.status(200).send({
                            message: "File downloaded and processed.",
                            file: req.file,
                            fileUrl: fileUrl,
                            thumbnailFileUrl: thumbnailFileUrl,
                            facesDetected: faceCount,
                        });
                    }
                    catch (frameError) {
                        console.error("Error extracting frame from video:", frameError);
                        return handleError(res, frameError, "Error extracting frame from video.");
                    }
                }
                else {
                    // If it's an image, return the processed image URL
                    const fileUrl = `${req.protocol}://canva.spooqs.com/tmp/${path_1.default.basename(outputFilePath)}`;
                    return res.status(200).send({
                        message: "File downloaded and processed.",
                        file: req.file,
                        fileUrl: fileUrl,
                        thumbnailFileUrl: fileUrl, // For images, thumbnail URL is the same as the file URL
                        facesDetected: faceCount,
                    });
                }
            }
            catch (execError) {
                console.error("Error processing file:", execError);
                /*
                if (db)
                {
                  try
                  {
                    // Log the error in the database
                    await upsertUserLog(db, req.body.userId, mediaType, true, 0, 0);
                    console.log("Database updated with error log.");
                  } catch (updateError)
                  {
                    console.error("Error updating database with error log:", updateError);
                  }
                }
                */
                return handleError(res, execError, "Error processing file.");
            }
        }
        catch (error) {
            return handleError(res, error, "Error processing file.");
        }
        finally {
            /*
            if (db)
            {
              try
              {
                await db.close();  // Close the database connection in the finally block
                //console.log("Database connection closed.");
              } catch (closeError)
              {
                console.error("Error closing database connection:", closeError);
              }
            }
            */
        }
    });
    router.options("/tmp", (req, res) => {
        const allowedOrigins = ALLOWED_ORIGINS;
        const origin = req.headers.origin;
        if (typeof origin === 'string' && allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
        else {
            // Optionally, log rejected origins for better monitoring
            console.log("Rejected origin:", origin);
            // return early with an error status if origin is not allowed
            return res.status(403).send({ error: "Origin not allowed" });
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).send(); // Respond to preflight requests
    });
    // Cleanup route
    router.post('/cleanup', authenticateUser, async (req, res) => {
        try {
            const { originalFilename, isVideo } = req.body;
            if (!originalFilename) {
                return res.status(400).send({ error: "Original filename is required" });
            }
            // Paths for the original and processed files
            const originalFilePath = path_1.default.join(TMP_CANVA_DIR, originalFilename);
            const processedFilePath = path_1.default.join(PROCESSED_DIR, processFile(originalFilename));
            let thumbnailFilePath;
            // If the file is a video, set the thumbnail path
            if (isVideo) {
                thumbnailFilePath = path_1.default.join(PROCESSED_DIR, `thumbnail_${path_1.default.parse(processedFilePath).name}.jpg`);
            }
            // Perform cleanup
            await cleanupFiles(originalFilePath, processedFilePath, thumbnailFilePath);
            return res.status(200).send({ message: 'Files cleaned up.' });
        }
        catch (error) {
            return handleError(res, error, "Files cleanup failed.");
        }
    });
    // Serve the downloaded (uploaded to server) files
    router.use('/tmp_canva', express_1.default.static(TMP_CANVA_DIR));
    router.use('/tmp', express_1.default.static(PROCESSED_DIR));
    const server = (0, create_1.createBaseServer)(router);
    server.start(process.env.CANVA_BACKEND_PORT);
}
main();
