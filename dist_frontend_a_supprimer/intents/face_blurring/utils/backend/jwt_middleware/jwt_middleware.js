"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWTAuthorizationError = exports.getTokenFromHttpHeader = exports.getTokenFromQueryString = void 0;
exports.createJwtMiddleware = createJwtMiddleware;
/* eslint-disable no-console */
const chalk = __importStar(require("chalk"));
const debug = __importStar(require("debug"));
const jwt = __importStar(require("jsonwebtoken"));
const jwks_rsa_1 = require("jwks-rsa");
/**
 * Prefix your start command with `DEBUG=express:middleware:jwt` to enable debug logging
 * for this middleware
 */
const debugLogger = debug.default("express:middleware:jwt");
const CANVA_BASE_URL = "https://api.canva.com";
const PUBLIC_KEY_DEFAULT_EXPIRY_MS = 60 * 60 * 1000; // 60 minutes
const PUBLIC_KEY_DEFAULT_FETCH_TIMEOUT_MS = 30 * 1000; // 30 seconds
const sendUnauthorizedResponse = (res, message) => res.status(401).json({ error: "unauthorized", message });
const createJwksUrl = (appId) => `${CANVA_BASE_URL}/rest/v1/apps/${appId}/jwks`;
/**
 * An Express.js middleware for decoding and verifying a JSON Web Token (JWT).
 * By default, this middleware extracts the token from the `Authorization` header.
 *
 * @remarks
 * If a JWT is successfully decoded, the following properties are added to the request object:
 * - `request.canva.appId` - The ID of the app.
 * - `request.canva.brandId` - The ID of the user's team.
 * - `request.canva.userId` - The ID of the user.
 *
 * @param appId - The ID of the app.
 * @param getTokenFromRequest - A function that extracts a token from the request. If a token isn't found, throw a `JWTAuthorizationError`.
 * @returns An Express.js middleware for verifying and decoding JWTs.
 */
function createJwtMiddleware(appId, getTokenFromRequest = exports.getTokenFromHttpHeader) {
    const jwksClient = new jwks_rsa_1.JwksClient({
        cache: true,
        cacheMaxAge: PUBLIC_KEY_DEFAULT_EXPIRY_MS,
        timeout: PUBLIC_KEY_DEFAULT_FETCH_TIMEOUT_MS,
        rateLimit: true,
        jwksUri: createJwksUrl(appId),
    });
    return async (req, res, next) => {
        try {
            debugLogger(`processing JWT for '${req.url}'`);
            const token = await getTokenFromRequest(req);
            const unverifiedDecodedToken = jwt.decode(token, {
                complete: true,
            });
            if (unverifiedDecodedToken?.header?.kid == null) {
                console.trace(`jwtMiddleware: expected token to contain 'kid' claim header`);
                return sendUnauthorizedResponse(res);
            }
            const key = await jwksClient.getSigningKey(unverifiedDecodedToken.header.kid);
            const publicKey = key.getPublicKey();
            const verifiedToken = jwt.verify(token, publicKey, {
                audience: appId,
                complete: true,
            });
            const { payload } = verifiedToken;
            debugLogger("payload: %O", payload);
            if (payload.userId == null ||
                payload.brandId == null ||
                payload.aud == null) {
                console.trace("jwtMiddleware: failed to decode jwt missing fields from payload");
                return sendUnauthorizedResponse(res);
            }
            req.canva = {
                appId: payload.aud,
                brandId: payload.brandId,
                userId: payload.userId,
            };
            return next();
        }
        catch (e) {
            if (e instanceof JWTAuthorizationError) {
                return sendUnauthorizedResponse(res, e.message);
            }
            if (e instanceof jwks_rsa_1.SigningKeyNotFoundError) {
                return sendUnauthorizedResponse(res, `Public key not found. ${chalk.bgRedBright("Ensure you have the correct App_ID set")}.`);
            }
            if (e instanceof jwt.JsonWebTokenError) {
                return sendUnauthorizedResponse(res, "Token is invalid");
            }
            if (e instanceof jwt.TokenExpiredError) {
                return sendUnauthorizedResponse(res, "Token expired");
            }
            return next(e);
        }
    };
    // Ajout magique pour TS :
    throw new Error("createJwtMiddleware: unreachable code");
}
const getTokenFromQueryString = (req) => {
    // The name of a query string parameter bearing the JWT
    const tokenQueryStringParamName = "canva_user_token";
    const queryParam = req.query[tokenQueryStringParamName];
    if (!queryParam || typeof queryParam !== "string") {
        console.trace(`jwtMiddleware: missing "${tokenQueryStringParamName}" query parameter`);
        throw new JWTAuthorizationError(`Missing "${tokenQueryStringParamName}" query parameter`);
    }
    if (!looksLikeJWT(queryParam)) {
        console.trace(`jwtMiddleware: invalid "${tokenQueryStringParamName}" query parameter`);
        throw new JWTAuthorizationError(`Invalid "${tokenQueryStringParamName}" query parameter`);
    }
    return queryParam;
};
exports.getTokenFromQueryString = getTokenFromQueryString;
const getTokenFromHttpHeader = (req) => {
    // The names of a HTTP header bearing the JWT, and a scheme
    const headerName = "Authorization";
    const schemeName = "Bearer";
    const header = req.header(headerName);
    if (!header) {
        throw new JWTAuthorizationError(`Missing the "${headerName}" header`);
    }
    if (!header.match(new RegExp(`^${schemeName}\\s+[^\\s]+$`, "i"))) {
        console.trace(`jwtMiddleware: failed to match token in "${headerName}" header`);
        throw new JWTAuthorizationError(`Missing a "${schemeName}" token in the "${headerName}" header`);
    }
    const token = header.replace(new RegExp(`^${schemeName}\\s+`, "i"), "");
    if (!token || !looksLikeJWT(token)) {
        throw new JWTAuthorizationError(`Invalid "${schemeName}" token in the "${headerName}" header`);
    }
    return token;
};
exports.getTokenFromHttpHeader = getTokenFromHttpHeader;
/**
 * A class representing JWT validation errors in the JWT middleware.
 * The error message provided to the constructor will be forwarded to the
 * API consumer trying to access a JWT-protected endpoint.
 * @private
 */
class JWTAuthorizationError extends Error {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, JWTAuthorizationError.prototype);
    }
}
exports.JWTAuthorizationError = JWTAuthorizationError;
const looksLikeJWT = (token) => // Base64 alphabet includes
 
//   - letters (a-z and A-Z)
//   - digits (0-9)
//   - two special characters (+/ or -_)
//   - padding (=)
token.match(/^[a-z0-9+/\-_=.]+$/i) != null;
