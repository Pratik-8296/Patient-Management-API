// src/config/cognito.ts
// Cognito JWT verifier configuration — lazy initialization to avoid startup
// crashes when COGNITO_USER_POOL_ID is not set (e.g. local dev).

import { CognitoJwtVerifier } from 'aws-jwt-verify';

const userPoolId = process.env['COGNITO_USER_POOL_ID'] ?? '';
const clientId = process.env['COGNITO_CLIENT_ID'] ?? '';

export const cognitoConfig = {
  userPoolId,
  clientId,
  region: process.env['COGNITO_REGION'] ?? 'us-east-1',
};

// Lazy singleton — only created when first accessed and only if configured
let _cognitoVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null | undefined;

export function getCognitoVerifier(): ReturnType<typeof CognitoJwtVerifier.create> | null {
  if (_cognitoVerifier === undefined) {
    if (!userPoolId || userPoolId.includes('xxxxxxxxx') || !clientId) {
      _cognitoVerifier = null;
    } else {
      _cognitoVerifier = CognitoJwtVerifier.create({
        userPoolId,
        clientId,
        tokenUse: 'access',
      });
    }
  }
  return _cognitoVerifier;
}
