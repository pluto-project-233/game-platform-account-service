/**
 * Capability: CreateAccount
 * Iteration: 1.5
 * TSD Reference: account-service.md
 *
 * Rules:
 * - accountId == Firebase Auth UID
 * - Idempotent
 * - No ledger write
 * - balanceSnapshot initialized to 0
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {db} from "./firebase";

interface Account {
  accountId: string;
  status: "ACTIVE" | "SUSPENDED";
  balanceSnapshot: number;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

function toAccountResponse(account: Account) {
  return {
    accountId: account.accountId,
    status: account.status,
  };
}

export const createAccount = functions.https.onCall(async (data, context) => {
  // Reject unauthenticated requests
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required"
    );
  }

  const accountId = context.auth.uid;
  const accountRef = db.collection("accounts").doc(accountId);

  const accountSnapshot = await accountRef.get();

  if (accountSnapshot.exists) {
    // Idempotent behavior: return existing account without modification
    return toAccountResponse(accountSnapshot.data() as Account);
  }

  const newAccount: Account = {
    accountId,
    status: "ACTIVE",
    balanceSnapshot: 0,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  };

  await accountRef.set(newAccount);

  return toAccountResponse(newAccount);
});
