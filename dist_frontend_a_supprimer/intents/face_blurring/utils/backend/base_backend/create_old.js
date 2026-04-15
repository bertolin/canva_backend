"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBaseServer = createBaseServer;
/* eslint-disable no-console */
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const debug_1 = __importDefault(require("debug"));
const path_1 = __importDefault(require("path")); // VG addition to test https backend
const serverDebug = (0, debug_1.default)("server");
/**
 * createBaseServer instantiates a customised express server with:
 * - json body handling
 * - health check endpoint
 * - catchall endpoint
 * - error handler catch route
 * - process termination handling
 * - debug logging - prefix starting your server with `DEBUG=server npm run XXX`
 *
 * @returns BaseServer object containing the express app and a start function
 */
function createBaseServer(router) {
    // Next three lines are for initial handling of backend server with app_runner...
    ////  const SHOULD_ENABLE_HTTPS = process.env?.SHOULD_ENABLE_HTTPS === "true";
    ////  const HTTPS_CERT_FILE = process.env?.HTTPS_CERT_FILE;
    ////  const HTTPS_KEY_FILE = process.env?.HTTPS_KEY_FILE;
    const SHOULD_ENABLE_HTTPS = "true";
    // Next three lines uses auto-signed certificates...
    //  const SSL_CERT_DIR = path.resolve(__dirname, "..", "..", "..", ".ssl");
    //  const HTTPS_CERT_FILE = path.resolve(SSL_CERT_DIR, "certificate.pem");
    //  const HTTPS_KEY_FILE = path.resolve(SSL_CERT_DIR, "private-key.pem");
    const SSL_CERT_DIR = path_1.default.resolve("/etc/letsencrypt/live/", "canva.spooqs.com");
    const HTTPS_CERT_FILE = path_1.default.resolve(SSL_CERT_DIR, "fullchain.pem");
    const HTTPS_KEY_FILE = path_1.default.resolve(SSL_CERT_DIR, "privkey.pem");
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    // It can help to provide an extra layer of obsecurity to reduce server fingerprinting.
    app.disable("x-powered-by");
    // Health check endpoint
    app.get("/healthz", (req, res) => {
        res.sendStatus(200);
    });
    // logging middleware
    app.use((req, res, next) => {
        serverDebug(`${new Date().toISOString()}: ${req.method} ${req.url}`);
        next();
    });
    // Custom routes router
    app.use(router);
    // catch all router
    app.all("*", (req, res) => {
        res.status(404).send({
            error: `unhandled '${req.method}' on '${req.url}'`,
        });
    });
    // default error handler
    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).send({
            error: "something went wrong",
        });
    });
    let server;
    if (SHOULD_ENABLE_HTTPS) {
        if (!HTTPS_CERT_FILE || !HTTPS_KEY_FILE) {
            throw new Error("Looks like you're running the example with --use-https flag, but SSL certificates haven't been generated. Please remove the .ssl/ folder and re-run the command again.");
        }
        server = https_1.default.createServer({
            key: fs_1.default.readFileSync(HTTPS_KEY_FILE),
            cert: fs_1.default.readFileSync(HTTPS_CERT_FILE),
        }, app);
    }
    else {
        server = http_1.default.createServer(app);
    }
    return {
        app,
        start: (address) => {
            console.log(`Listening on '${address}'`);
            server.listen(address);
            process.on("SIGTERM", () => {
                serverDebug("SIGTERM signal received: closing HTTP server");
                server.close(() => {
                    serverDebug("HTTP server closed");
                });
            });
        },
    };
}
