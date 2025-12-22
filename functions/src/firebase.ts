/**
 * TSD Reference: account-service.md
 * Purpose: Initialize Firebase Admin SDK exactly once
 * Rules:
 * - No business logic here
 * - Firestore connection only
 */

import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export Firestore instance for use in other modules
export const db = admin.firestore();

// Export Auth instance for future use
export const auth = admin.auth();
