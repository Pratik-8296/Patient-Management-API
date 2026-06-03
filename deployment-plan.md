# Patient Management API — Deployment Plan

## Overview

This document provides a step-by-step guide to deploy the Patient Management API to AWS using the Serverless Framework.

---

## Prerequisites

### Required AWS Services
| Service | Purpose |
|---------|---------|
| AWS Lambda | Serverless compute |
| API Gateway | HTTP entry point + Cognito authorizer |
| DynamoDB | Primary patient data store |
| OpenSearch Service | Full-text condition search |
| Cognito | User authentication (JWT) |
| IAM | Least-privilege role for Lambda |
| CloudWatch | Logs and monitoring |

### Required Tools
```bash
node --version   # >= 20.0.0
npm --version    # >= 10.0.0
aws --version    # >= 2.0.0
serverless --version  # >= 3.0.0
```

---

## Phase 1: AWS Account Setup

### Step 1.1 — Configure AWS CLI

```bash
aws configure
# AWS Access Key ID: <your-key>
# AWS Secret Access Key: <your-secret>
# Default region: us-east-1
# Default output format: json
```

### Step 1.2 — Verify credentials

```bash
aws sts get-caller-identity
# Should return your account ID, user ARN, and user ID
```

---

## Phase 2: Create Cognito User Pool

### Step 2.1 — Create User Pool

```bash
aws cognito-idp create-user-pool \
  --pool-name patient-management-users \
  --auto-verified-attributes email \
  --username-attributes email \
  --password-policy MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false \
  --region us-east-1
```

> Save the `Id` from the response — this is your `COGNITO_USER_POOL_ID`.

### Step 2.2 — Create App Client

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id us-east-1_XXXXXXXXX \
  --client-name patient-management-api-client \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --no-generate-secret \
  --region us-east-1
```

> Save the `ClientId` — this is your `COGNITO_CLIENT_ID`.

### Step 2.3 — Create a test user

```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username testuser@example.com \
  --temporary-password Temp1234! \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username testuser@example.com \
  --password MyPass123! \
  --permanent
```

---

## Phase 3: Create OpenSearch Domain

### Step 3.1 — Create OpenSearch domain (dev/small setup)

```bash
aws opensearch create-domain \
  --domain-name patient-management-dev \
  --engine-version OpenSearch_2.11 \
  --cluster-config InstanceType=t3.small.search,InstanceCount=1 \
  --ebs-options EBSEnabled=true,VolumeType=gp3,VolumeSize=10 \
  --access-policies '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"AWS": "*"},
      "Action": "es:*",
      "Resource": "arn:aws:es:us-east-1:ACCOUNT_ID:domain/patient-management-dev/*"
    }]
  }' \
  --region us-east-1
```

> ⏳ Domain creation takes 10–15 minutes. Check status:

```bash
aws opensearch describe-domain \
  --domain-name patient-management-dev \
  --query 'DomainStatus.Endpoint'
```

> Save the endpoint — this is your `OPENSEARCH_ENDPOINT`.

---

## Phase 4: Configure Environment

### Step 4.1 — Set SSM Parameters (recommended for production)

```bash
# Store sensitive values in AWS Systems Manager Parameter Store
aws ssm put-parameter \
  --name "/patient-management/prod/COGNITO_USER_POOL_ID" \
  --value "us-east-1_XXXXXXXXX" \
  --type SecureString

aws ssm put-parameter \
  --name "/patient-management/prod/COGNITO_CLIENT_ID" \
  --value "your-client-id" \
  --type SecureString

aws ssm put-parameter \
  --name "/patient-management/prod/OPENSEARCH_ENDPOINT" \
  --value "https://your-domain.us-east-1.es.amazonaws.com" \
  --type SecureString
```

### Step 4.2 — Set environment variables for deployment

```bash
# Option A: .env file (for local/CI)
export COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
export COGNITO_CLIENT_ID=your-client-id
export OPENSEARCH_ENDPOINT=https://your-domain.us-east-1.es.amazonaws.com
```

---

## Phase 5: Deploy

### Step 5.1 — Install dependencies and build

```bash
npm install
npm run build
```

### Step 5.2 — Deploy to dev

```bash
serverless deploy --stage dev --region us-east-1 --verbose
```

### Step 5.3 — Deploy to production

```bash
serverless deploy --stage prod --region us-east-1 --verbose
```

### Expected output

```
✔ Service deployed to stack patient-management-api-prod

endpoints:
  GET  - https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/health
  POST - https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/patients
  GET  - https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/patients
  GET  - https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/patients/search
  GET  - https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/patients/{id}
  PUT  - https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/patients/{id}
  DELETE - https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/patients/{id}

functions:
  api: patient-management-api-prod-api (12 MB)
```

---

## Phase 6: Post-Deployment Verification

### Step 6.1 — Health check

```bash
curl https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/health
```

Expected: `{"success":true,"status":"healthy",...}`

### Step 6.2 — Get an access token

```bash
TOKEN=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id YOUR_CLIENT_ID \
  --auth-parameters USERNAME=testuser@example.com,PASSWORD=MyPass123! \
  --query 'AuthenticationResult.AccessToken' \
  --output text)

echo "Token: $TOKEN"
```

### Step 6.3 — Create a patient

```bash
curl -X POST https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/patients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "address": "123 Main St, Springfield, IL 62701",
    "conditions": ["diabetes", "hypertension"],
    "allergies": ["penicillin"]
  }'
```

### Step 6.4 — Search by condition

```bash
curl "https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/patients/search?condition=diabetes"
```

---

## Phase 7: Monitoring

### CloudWatch Logs

```bash
# View Lambda function logs
serverless logs --function api --stage prod --tail

# Or using AWS CLI
aws logs tail /aws/lambda/patient-management-api-prod-api --follow
```

### CloudWatch Metrics to monitor
| Metric | Alarm Threshold |
|--------|----------------|
| Lambda Duration | > 5000ms |
| Lambda Errors | > 1% error rate |
| Lambda Throttles | > 0 |
| DynamoDB ConsumedReadCapacity | > 80% of provisioned |
| API Gateway 5XX Errors | > 1% |

---

## Phase 8: Teardown

```bash
# Remove dev stack
serverless remove --stage dev

# Remove prod stack (DynamoDB table is retained by DeletionPolicy: Retain)
serverless remove --stage prod
```

> ⚠️ **Warning:** The DynamoDB table will NOT be deleted (protected by `DeletionPolicy: Retain`). Delete manually if needed:
> ```bash
> aws dynamodb delete-table --table-name patient-management-api-prod-patients
> ```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Cannot find module` | Run `npm install` and `npm run build` |
| `401 Unauthorized` | Check Cognito token is not expired; use `initiate-auth` to get a new one |
| `ConditionalCheckFailedException` | Patient already exists or was deleted concurrently |
| OpenSearch 403 errors | Check IAM role has `es:ESHttp*` permissions for the domain ARN |
| Lambda timeout | Increase `timeout` in `serverless.yml` (max 29s for API Gateway) |
| DynamoDB table not found | Ensure `DYNAMODB_TABLE_NAME` matches the CloudFormation output |

---

## Cost Estimate (dev environment)

| Service | Estimated Monthly Cost |
|---------|----------------------|
| Lambda (1M req/mo) | ~$0.20 |
| API Gateway (1M req/mo) | ~$3.50 |
| DynamoDB (on-demand) | ~$1–5 |
| OpenSearch (t3.small) | ~$25 |
| CloudWatch Logs | ~$0.50 |
| **Total** | **~$30–35/month** |

> 💡 For production, use reserved capacity for OpenSearch to reduce costs significantly.
