"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.pinoConfigOptions = void 0;
const pino_1 = __importDefault(require("pino"));
exports.pinoConfigOptions = {
    transport: {
        target: 'pino-pretty',
        options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname'
        }
    },
    redact: {
        paths: [
            'headers.authorization',
            'req.headers.authorization',
            'headers["x-authorization"]',
            'req.headers["x-authorization"]',
            'headers["x-api-key"]',
            'req.headers["x-api-key"]',
            'headers["x-jws-signature"]',
            'req.headers["x-jws-signature"]',
        ],
        censor: '[CENSORED]'
    }
};
exports.logger = (0, pino_1.default)(exports.pinoConfigOptions);
//# sourceMappingURL=pino.js.map