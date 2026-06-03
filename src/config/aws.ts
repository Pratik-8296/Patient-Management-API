// src/config/aws.ts
// Central AWS SDK configuration factory

export const awsConfig = {
  region: process.env['AWS_REGION'] ?? 'us-east-1',
  ...(process.env['IS_OFFLINE'] === 'true' || process.env['NODE_ENV'] === 'local'
    ? {
        credentials: {
          accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? 'local',
          secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? 'local',
        },
      }
    : {}),
};
