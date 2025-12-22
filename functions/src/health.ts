/**
 * Capability: Health Check
 * Phase: Iteration 1.1 (Skeleton)
 * Rules:
 * - No auth required
 * - No Firestore writes
 * - Must return 200 OK
 */

import * as functions from "firebase-functions";

export const health = functions.https.onRequest((req, res) => {
  res.status(200).json({
    status: "ok",
    service: "account-service",
    timestamp: new Date().toISOString(),
  });
});
