// src/config/opensearch.ts
// OpenSearch client singleton — lazy initialization to avoid startup crashes
// when running locally without OpenSearch configured.

import { Client } from '@opensearch-project/opensearch';

const isOffline =
  process.env['IS_OFFLINE'] === 'true' || process.env['NODE_ENV'] === 'local';

const useBasicAuth = process.env['OPENSEARCH_USE_BASIC_AUTH'] === 'true';

function createOpenSearchClient(): Client | null {
  if (isOffline) {
    // Local dev: connect to a local OpenSearch/Elasticsearch instance
    return new Client({
      node: process.env['OPENSEARCH_LOCAL_NODE'] ?? 'http://localhost:9200',
    });
  }

  const node = process.env['OPENSEARCH_ENDPOINT'] ?? '';

  // Skip initialization if no endpoint is configured (e.g. local dev without OpenSearch)
  if (!node || node.includes('your-opensearch-domain')) {
    return null;
  }

  if (useBasicAuth) {
    return new Client({
      node,
      auth: {
        username: process.env['OPENSEARCH_USERNAME'] ?? 'admin',
        password: process.env['OPENSEARCH_PASSWORD'] ?? '',
      },
      ssl: {
        rejectUnauthorized: true,
      },
    });
  }

  // IAM-based auth (uses AWS_SDK credentials/role automatically)
  return new Client({
    node,
    ssl: {
      rejectUnauthorized: true,
    },
  });
}

// Lazy singleton — created once on first access
let _openSearchClient: Client | null | undefined;

export function getOpenSearchClient(): Client | null {
  if (_openSearchClient === undefined) {
    _openSearchClient = createOpenSearchClient();
  }
  return _openSearchClient;
}

export const PATIENTS_INDEX = 'patients';
