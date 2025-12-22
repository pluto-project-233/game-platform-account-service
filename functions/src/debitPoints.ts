/**
 * Capability: DebitPoints
 * Iteration: 1.4
 * TSD Reference: account-service.md
 *
 * Rules:
 * - Append-only ledger
 * - DEBIT only
 * - Validate sufficient balance first
 * - Idempotent via referenceId
 * - Atomic operation
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {db} from "./firebase";

interface DebitPointsRequest {
  amount: number;
  referenceId: string;
  source: "GAME" | "ADMIN";
}

interface LedgerEntry {
  ledgerId: string;
  accountId: string;
  type: "DEBIT";
  source: "GAME" | "ADMIN";
  referenceId: string;
  amount: number;
  createdAt: admin.firestore.Timestamp;
}

export const debitPoints = functions.https.onCall(
  async (data: DebitPointsRequest, context) => {
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

    if (data.source !== "GAME" && data.source !== "ADMIN") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "source must be GAME or ADMIN"
      );
    }

    const accountId = context.auth.uid;

    // Ensure account exists and is ACTIVE
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
        "Cannot debit suspended account"
      );
    }

    const ledgerId = `${accountId}_${data.referenceId}`;
    const ledgerRef = db.collection("ledger").doc(ledgerId);

    // Atomic debit: check balance + write in same transaction
    try {
      await db.runTransaction(async (tx) => {
        // Check if ledger entry already exists (idempotent)
        const existing = await tx.get(ledgerRef);
        if (existing.exists) {
          // Idempotent no-op
          return;
        }

        // Read all ledger entries for account (ordered for determinism)
        const ledgerSnapshot = await tx.get(
          db.collection("ledger")
            .where("accountId", "==", accountId)
            .orderBy("createdAt", "asc")
        );

        // Compute balance with defensive type narrowing
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

        // Validate sufficient balance
        if (balance < data.amount) {
          // Throw plain Error inside transaction (not HttpsError)
          throw new Error("INSUFFICIENT_BALANCE");
        }

        // Append DEBIT ledger entry
        const ledgerEntry: LedgerEntry = {
          ledgerId,
          accountId,
          type: "DEBIT",
          source: data.source,
          referenceId: data.referenceId,
          amount: data.amount,
          createdAt: admin.firestore.Timestamp.now(),
        };

        tx.set(ledgerRef, ledgerEntry);
      });
    } catch (err: any) {
      // Translate plain Error to HttpsError outside transaction
      if (err.message === "INSUFFICIENT_BALANCE") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Insufficient balance"
        );
      }
      throw err;
    }

    return {status: "OK"};
  }
);
