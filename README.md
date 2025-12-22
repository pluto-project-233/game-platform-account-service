# Account Service

Firebase Cloud Functions service responsible for
account and ledger management.

## Phase
✅ Iteration 1.1 — Skeleton + Health (Complete)

## Available Endpoints
- GET /health — Health check endpoint

## Implementation Status
- [x] Firebase Functions project structure
- [x] Health endpoint with tests
- [x] Firebase Admin SDK initialization
- [x] TypeScript configuration
- [x] ESLint + Jest setup

## Development

### Install Dependencies
```bash
cd functions
npm install
```

### Run Tests
```bash
npm test
```

### Build
```bash
npm run build
```

### Local Development
```bash
npm run serve
```

### Deploy
```bash
npm run deploy
```

## Notes
- Follows TSD v1.0 (account-service.md)
- Node.js 18 runtime
- No business logic implemented yet (ledger and account operations pending)

