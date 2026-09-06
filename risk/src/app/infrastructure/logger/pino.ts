import pino from 'pino';

export const pinoConfigOptions = {
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
}

export const logger = pino(pinoConfigOptions);