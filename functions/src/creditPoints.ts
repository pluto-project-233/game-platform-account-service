/**
 * Capability: CreditPoints
 * Iteration: 1.3
 * TSD Reference: account-service.md
 *
 * Rules:
 * - Append-only ledger
 * - CREDIT only
 * - Idempotent via referenceId
 * - No balance calculation
 * - Cannot credit suspended accounts
 * - Deterministic ledgerId = ${accountId}_${referenceId}
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {db} from "./firebase";

interface CreditPointsRequest {
  amount: number;
  referenceId: string;
  source: "PAYMENT" | "ADMIN";
}

interface LedgerEntry {
  ledgerId: string;
  accountId: string;
  type: "CREDIT";
  source: "PAYMENT" | "ADMIN";
  referenceId: string;
  amount: number;
  createdAt: admin.firestore.Timestamp;
}

export const creditPoints = functions.https.onCall(
  async (data: CreditPointsRequest, context) => {
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

    if (!data.referenceId || typeof data.referenceId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "referenceId is required"
      );
    }

    if (data.source !== "PAYMENT" && data.source !== "ADMIN") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "source must be PAYMENT or ADMIN"
      );
    }

    const accountId = context.auth.uid;

    // Ensure account exists and is active
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
        "Cannot credit suspended account"
      );
    }

    const ledgerId = `${accountId}_${data.referenceId}`;
    const ledgerRef = db.collection("ledger").doc(ledgerId);

    // Atomic idempotent credit
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(ledgerRef);
      if (existing.exists) {
        // Idempotent no-op
        return;
      }

      const ledgerEntry: LedgerEntry = {
        ledgerId,
        accountId,
        type: "CREDIT",
        source: data.source,
        referenceId: data.referenceId,
        amount: data.amount,
        createdAt: admin.firestore.Timestamp.now(),
      };

      tx.set(ledgerRef, ledgerEntry);
    });

    return {status: "OK"};
  }
);
