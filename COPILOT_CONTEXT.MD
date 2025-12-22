# Copilot Context — Account Service

## Source of Truth
- game-platform-docs/tsd/account-service.md
- game-platform-docs/tsd/platform-runtime.md

## Service Role
This service is the single authority for player accounts and point balances.
It uses a ledger-first model with Firestore as storage.

## Runtime & Infra
- Runtime: Node.js
- Hosting: Firebase Cloud Functions
- Database: Firestore
- Auth: Firebase Auth (Admin SDK)

## Non-Negotiable Rules
- Ledger is append-only
- Balance is derived, never stored
- accountId == Firebase Auth UID
- All credit/debit operations are idempotent
- referenceId prevents duplicate transactions
- No cross-service calls except from Payment Service

## Forbidden
- ❌ Storing balance in account document
- ❌ Caching balances
- ❌ Updating or deleting ledger entries
- ❌ Business logic outside documented TSD
- ❌ Trusting client-provided accountId

## Testing Expectations
- Ledger replay must always produce same balance
- Duplicate referenceId must be a no-op
- Insufficient balance must be rejected
