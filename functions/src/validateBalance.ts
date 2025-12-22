/**
 * Capability: ValidateBalance
 * Iteration: 1.5
 * TSD Reference: account-service.md
 *
 * Rules:
 * - Balance read from balanceSnapshot (O(1))
 * - No ledger access required
 * - No writes allowed
 */

import * as functions from "firebase-functions";
import {db} from "./firebase";

interface ValidateBalanceRequest {
  amount: number;
}

export const validateBalance = functions.https.onCall(
  async (data: ValidateBalanceRequest, context) => {
    // Auth required
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Authentication required"
      );
    }

    // Validate input
    if (typeof data.amount !== "number" || data.amount <= 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "amount must be a positive number"
      );
    }

    const accountId = context.auth.uid;

    // Account must exist and be ACTIVE
    const accountRef = db.collection("accounts").doc(accountId);
    const accountSnapshot = await accountRef.get();

    if (!accountSnapshot.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Account not found"
      );
    }

    if (accountSnapshot.data()?.status === "SUSPENDED") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Account is suspended"
      );
    }

    // Read balanceSnapshot (O(1) instead of ledger scan)
    const balance = accountSnapshot.data()?.balanceSnapshot ?? 0;

    // Compare with requested amount
    const allowed = balance >= data.amount;

    return {
      allowed,
      balance,
    };
  }
);
