/**
 * Capability: ValidateBalance
 * Iteration: 1.4
 * TSD Reference: account-service.md
 *
 * Rules:
 * - Balance is derived from ledger
 * - CREDIT increases balance
 * - DEBIT decreases balance
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

    // Fetch all ledger entries for account (ordered for determinism)
    const ledgerSnapshot = await db
      .collection("ledger")
      .where("accountId", "==", accountId)
      .orderBy("createdAt", "asc")
      .get();

    // Compute balance from ledger with defensive type narrowing
    let balance = 0;
    ledgerSnapshot.forEach((doc) => {
      const entry = doc.data() as {type?: string; amount?: number};

      // Defensive: skip malformed entries
      if (typeof entry.amount !== "number") return;

      switch (entry.type) {
        case "CREDIT":
          balance += entry.amount;
          break;
        case "DEBIT":
          balance -= entry.amount;
          break;
        default:
          // Defensive: ignore unknown types
          break;
      }
    });

    // Compare with requested amount
    const allowed = balance >= data.amount;

    return {
      allowed,
      balance,
    };
  }
);
