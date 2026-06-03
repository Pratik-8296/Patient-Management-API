// src/lambda.ts
// AWS Lambda entry point using serverless-http

import serverless from 'serverless-http';
import { createApp } from './app';
import { logger } from './utils/logger';
import { openSearchRepository } from './repositories/opensearch.repository';

const app = createApp();

// Warm up OpenSearch index on cold start (non-blocking)
void openSearchRepository.ensureIndex().catch((err: unknown) => {
  logger.error({ err }, 'Failed to ensure OpenSearch index on startup');
});

// Export the serverless handler
export const handler = serverless(app, {
  binary: ['image/*', 'application/pdf'],
});

// Local development server (when not running as Lambda)
if (process.env['IS_OFFLINE'] === 'true' || process.env['NODE_ENV'] === 'local') {
  const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
  app.listen(PORT, () => {
    logger.info({ port: PORT }, `Local server running at http://localhost:${PORT}`);
    logger.info(`Swagger UI: http://localhost:${PORT}/api-docs`);
    logger.info(`Health: http://localhost:${PORT}/health`);
  });
}
