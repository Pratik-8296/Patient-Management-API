// src/utils/logger.ts
// Pino structured logger singleton

import pino from 'pino';

const isDevelopment =
  process.env['NODE_ENV'] === 'development' ||
  process.env['NODE_ENV'] === 'local';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
  base: {
    service: 'patient-management-api',
    version: process.env['npm_package_version'] ?? '1.0.0',
    environment: process.env['NODE_ENV'] ?? 'production',
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});
