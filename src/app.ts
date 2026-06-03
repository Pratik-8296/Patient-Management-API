// src/app.ts
// Express application factory

import express, { Application, Request, Response, NextFunction } from 'express';
import pinoHttp from 'pino-http';
import path from 'path';
import YAML from 'yamljs';
import swaggerUi from 'swagger-ui-express';
import { IncomingMessage, ServerResponse } from 'http';
import patientRoutes from './routes/patient.routes';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { logger } from './utils/logger';

export function createApp(): Application {
  const app = express();

  // ─── Core Middleware ───────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // HTTP request logging
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req: IncomingMessage) => req.url === '/health',
      },
      customLogLevel: (
        _req: IncomingMessage,
        res: ServerResponse,
        err: Error | undefined
      ) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    })
  );

  // Security headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // CORS
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Request-ID'
    );
    if (req.method === 'OPTIONS') {
      res.status(204).send();
      return;
    }
    next();
  });

  // ─── Health Check ──────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'patient-management-api',
      version: process.env['npm_package_version'] ?? '1.0.0',
      environment: process.env['NODE_ENV'] ?? 'production',
    });
  });

  // ─── Swagger UI ────────────────────────────────────────────────────────────
  try {
    const swaggerDocument = YAML.load(
      path.join(__dirname, '../docs/swagger.yaml')
    ) as Record<string, unknown>;
    app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerDocument, {
        explorer: true,
        customSiteTitle: 'Patient Management API Docs',
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
        },
      })
    );
    logger.info('Swagger UI available at /api-docs');
  } catch (err) {
    logger.warn({ err }, 'Could not load Swagger docs');
  }

  // ─── API Routes ────────────────────────────────────────────────────────────
  app.use('/patients', patientRoutes);

  // ─── Error Handling ────────────────────────────────────────────────────────
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
