# Patient Management API

> Production-grade Serverless Patient Management API built with Node.js 20+, TypeScript, Express.js, AWS Lambda, DynamoDB, OpenSearch, and Cognito.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![Serverless](https://img.shields.io/badge/Serverless-3.x-orange)](https://www.serverless.com/)
[![Jest](https://img.shields.io/badge/tested%20with-jest-99424f)](https://jestjs.io/)

---

## Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start (Local)](#quick-start-local)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Authentication](#authentication)
- [Running Tests](#running-tests)
- [Deployment](#deployment)
- [Design Decisions](#design-decisions)

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                     API Gateway                         │
│           (REST API + Cognito Authorizer)               │
└──────────────────────┬─────────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │      AWS Lambda          │
          │  Express.js + serverless │
          │         -http            │
          └────────────┬────────────┘
           ┌───────────┼───────────┐
           ▼           ▼           ▼
      DynamoDB     OpenSearch    Cognito
  (primary CRUD)  (full-text   (JWT auth)
                   search)
```

**Clean Architecture Layers:**

```
HTTP Request
    → Middleware (auth, validation, logging)
    → Controller (HTTP parsing/response)
    → Service (business logic)
    → Repository (data access)
    → AWS Services (DynamoDB / OpenSearch)
```

---

## Features

| Feature | Implementation |
|---------|---------------|
| **CRUD API** | Express.js REST endpoints |
| **Authentication** | AWS Cognito JWT (access tokens) |
| **Validation** | Zod with centralized middleware |
| **Database** | DynamoDB single-table design + GSI for address queries |
| **Search** | OpenSearch fuzzy search by medical condition |
| **Logging** | Pino structured JSON logging |
| **Error Handling** | Global middleware with standard response format |
| **Testing** | Jest + Supertest, ≥80% coverage |
| **Documentation** | Swagger/OpenAPI 3.0 + Postman collection |
| **Infrastructure** | Serverless Framework v3 with IaC |
| **TypeScript** | Strict mode enabled |
| **SOLID Principles** | Dependency injection, single responsibility |

---

## Project Structure

```
patient-management-api/
├── src/
│   ├── config/              # AWS client configuration
│   │   ├── aws.ts           # Base AWS config
│   │   ├── dynamodb.ts      # DynamoDB DocumentClient
│   │   ├── opensearch.ts    # OpenSearch client
│   │   └── cognito.ts       # Cognito JWT verifier
│   ├── models/
│   │   └── patient.model.ts # TypeScript interfaces
│   ├── validators/
│   │   └── patient.validator.ts  # Zod schemas
│   ├── repositories/        # Data access layer
│   │   ├── patient.repository.ts     # DynamoDB operations
│   │   └── opensearch.repository.ts  # OpenSearch operations
│   ├── services/
│   │   └── patient.service.ts   # Business logic
│   ├── controllers/
│   │   └── patient.controller.ts # HTTP handlers
│   ├── middleware/
│   │   ├── auth.middleware.ts       # Cognito JWT validation
│   │   ├── validation.middleware.ts  # Zod validation factory
│   │   └── error.middleware.ts      # Global error handler
│   ├── utils/
│   │   ├── logger.ts    # Pino logger
│   │   ├── response.ts  # Standard response helpers
│   │   └── uuid.ts      # UUID utilities
│   ├── routes/
│   │   └── patient.routes.ts  # Express router
│   ├── app.ts            # Express app factory
│   └── lambda.ts         # Lambda entry point
├── tests/
│   ├── unit/
│   │   ├── services/     # Service unit tests
│   │   └── repositories/ # Repository unit tests
│   └── integration/      # Supertest integration tests
├── docs/
│   ├── swagger.yaml             # OpenAPI 3.0 spec
│   └── postman-collection.json  # Postman Collection v2.1
├── serverless.yml    # Serverless Framework config
├── tsconfig.json     # TypeScript strict config
├── jest.config.ts    # Jest configuration
├── package.json
├── .env.example      # Environment template
├── README.md
└── deployment-plan.md
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20.0.0 | [nodejs.org](https://nodejs.org) |
| npm | ≥ 10.0.0 | included with Node.js |
| AWS CLI | ≥ 2.x | [aws.amazon.com/cli](https://aws.amazon.com/cli) |
| Docker (optional) | ≥ 20.x | For DynamoDB Local / OpenSearch |

> **Note:** The Serverless Framework (`serverless` CLI) is included as a local `devDependency`. After `npm install`, all `serverless` commands are available via `npm run <script>` without a global install.

---

## Quick Start (Local)

### 1. Clone and install dependencies

```bash
cd patient-management-api
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Start local services (optional — for real DynamoDB/OpenSearch)

```bash
# DynamoDB Local
docker run -d -p 8000:8000 amazon/dynamodb-local

# OpenSearch Local
docker run -d -p 9200:9200 -e "discovery.type=single-node" \
  opensearchproject/opensearch:2.11.0

# Create DynamoDB table locally
aws dynamodb create-table \
  --table-name patients \
  --attribute-definitions \
    AttributeName=patientId,AttributeType=S \
    AttributeName=address,AttributeType=S \
  --key-schema AttributeName=patientId,KeyType=HASH \
  --global-secondary-indexes \
    "[{\"IndexName\":\"AddressIndex\",\"KeySchema\":[{\"AttributeName\":\"address\",\"KeyType\":\"HASH\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000
```

### 4. Start the development server

You have two options:

**Option A — ts-node direct** (simple, no Lambda simulation):
```bash
npm run dev
```

**Option B — Serverless Offline** (full Lambda + API Gateway simulation, recommended):
```bash
# Set IS_OFFLINE=true in your .env first
npm run offline
```

The API will be available at:
- **API:** `http://localhost:3000`
- **Swagger UI:** `http://localhost:3000/api-docs`
- **Health:** `http://localhost:3000/health`

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment name |
| `PORT` | No | `3000` | Local server port |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `AWS_REGION` | Yes | `us-east-1` | AWS region |
| `DYNAMODB_TABLE_NAME` | Yes | `patients` | DynamoDB table name |
| `DYNAMODB_ENDPOINT` | No | — | Local DynamoDB URL |
| `OPENSEARCH_ENDPOINT` | Yes | — | OpenSearch domain URL |
| `OPENSEARCH_USE_BASIC_AUTH` | No | `false` | Use basic auth for OpenSearch |
| `OPENSEARCH_USERNAME` | Conditional | `admin` | OpenSearch username |
| `OPENSEARCH_PASSWORD` | Conditional | — | OpenSearch password |
| `COGNITO_USER_POOL_ID` | Yes | — | Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | Yes | — | Cognito App Client ID |
| `COGNITO_REGION` | No | `us-east-1` | Cognito region |
| `IS_OFFLINE` | No | `false` | Set to `true` for local dev |

---

## API Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `GET` | `/health` | ❌ | Health check |
| `GET` | `/api-docs` | ❌ | Swagger UI |
| `POST` | `/patients` | ✅ | Create patient |
| `GET` | `/patients` | ❌ | List patients |
| `GET` | `/patients/search?condition=diabetes` | ❌ | Search by condition |
| `GET` | `/patients/:id` | ❌ | Get patient by ID |
| `PUT` | `/patients/:id` | ✅ | Update patient |
| `DELETE` | `/patients/:id` | ✅ | Delete patient |

### Standard Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Patient created successfully",
  "meta": { "count": 10 }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "name", "message": "Name is required", "code": "invalid_type" }
  ]
}
```

### Query Parameters

**GET /patients**
```
GET /patients?address=123+Main+St&limit=20&lastEvaluatedKey=<cursor>
```

**GET /patients/search**
```
GET /patients/search?condition=diabetes&limit=20&from=0
```

---

## Authentication

The API uses **AWS Cognito** for JWT authentication.

### Getting a Token

```bash
# Using AWS CLI
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id YOUR_CLIENT_ID \
  --auth-parameters USERNAME=user@example.com,PASSWORD=YourPassword!

# The AccessToken in the response is what you use
```

### Using the Token

```bash
curl -X POST https://your-api/patients \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","address":"123 Main St, Springfield, IL 62701"}'
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run only unit tests
npm test -- tests/unit

# Run only integration tests
npm test -- tests/integration
```

### Coverage Thresholds

| Metric | Threshold |
|--------|-----------|
| Branches | 80% |
| Functions | 80% |
| Lines | 80% |
| Statements | 80% |

---

## Deployment

See [deployment-plan.md](./deployment-plan.md) for the complete step-by-step AWS deployment guide.

### First-time Deploy

The Serverless stack **auto-provisions all AWS resources** including:
- ✅ DynamoDB table (with GSI, PITR, SSE)
- ✅ Cognito User Pool + App Client
- ✅ API Gateway with Cognito Authorizer
- ✅ Lambda function
- ✅ CloudWatch log group

```bash
# Configure AWS credentials first
aws configure

# Deploy to dev
npm run deploy:dev

# Deploy to production
npm run deploy
```

### Post-Deploy: Copy Cognito Values to .env

After deployment, retrieve the Cognito values from CloudFormation Outputs:

```bash
# Get all stack outputs
aws cloudformation describe-stacks \
  --stack-name patient-management-api-dev \
  --query 'Stacks[0].Outputs'

# Or use serverless info
npx serverless info --stage dev
```

Copy the output values to your `.env`:
```env
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx    # From: CognitoUserPoolId
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx       # From: CognitoUserPoolClientId
COGNITO_REGION=us-east-1
```

### Remove Stack

```bash
npm run remove
```

---

## Design Decisions

### DynamoDB Single-Table Design
- **Primary Key:** `patientId` (UUID) — enables O(1) item lookups
- **AddressIndex GSI:** `address` — enables efficient queries by patient address without full table scans

### OpenSearch Integration
- Indexing is **async and non-blocking** — primary DB write succeeds even if OpenSearch is temporarily unavailable
- Uses **fuzzy matching** for condition searches to handle typos (e.g., `diabtes` → `diabetes`)
- Index is automatically created on Lambda cold start if it doesn't exist

### Auth Strategy
- **API Gateway Level:** Cognito Authorizer validates tokens before Lambda is invoked (production)
- **Middleware Level:** `auth.middleware.ts` provides app-level validation for local development
- Both layers use `aws-jwt-verify` which performs offline signature verification using cached JWKS

### Error Handling
- All errors propagate through Express's `next(error)` pattern to the global error handler
- Production responses never expose internal error details
- DynamoDB and OpenSearch errors are normalized to HTTP-friendly responses

### TypeScript Strict Mode
- `noImplicitAny`, `strictNullChecks`, `noImplicitReturns` all enabled
- All public APIs are fully typed
- Path aliases configured for clean imports (`@services/*`, `@models/*`, etc.)
