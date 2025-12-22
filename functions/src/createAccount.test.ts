/**
 * Tests for CreateAccount
 * Iteration 1.5
 */

import functionsTest from "firebase-functions-test";
import * as admin from "firebase-admin";

const testEnv = functionsTest();

// Mock Firestore
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDoc = jest.fn(() => ({
  get: mockGet,
  set: mockSet,
}));
const mockCollection = jest.fn(() => ({
  doc: mockDoc,
}));

jest.mock("./firebase", () => ({
  db: {
    collection: mockCollection,
  },
}));

import {createAccount} from "./createAccount";

describe("CreateAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  it("1️⃣ Creates new account", async () => {
    // Mock: account does not exist
    mockGet.mockResolvedValue({
      exists: false,
    });
    mockSet.mockResolvedValue(undefined);

    const wrapped = testEnv.wrap(createAccount);
    const result = await wrapped(
      {},
      {
        auth: {
          uid: "test-user-123",
        },
      }
    );

    // Verify account was created
    expect(mockCollection).toHaveBeenCalledWith("accounts");
    expect(mockDoc).toHaveBeenCalledWith("test-user-123");
    expect(mockSet).toHaveBeenCalled();

    // Verify response structure (no createdAt in response)
    expect(result).toEqual({
      accountId: "test-user-123",
      status: "ACTIVE",
    });
    expect(result.createdAt).toBeUndefined();
  });

  it("2️⃣ Idempotent behavior", async () => {
    const existingAccount = {
      accountId: "test-user-456",
      status: "ACTIVE" as const,
      balanceSnapshot: 0,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };

    const expectedResponse = {
      accountId: "test-user-456",
      status: "ACTIVE",
    };

    // Mock: account already exists
    mockGet.mockResolvedValue({
      exists: true,
      data: () => existingAccount,
    });

    const wrapped = testEnv.wrap(createAccount);

    // First call
    const result1 = await wrapped(
      {},
      {
        auth: {
          uid: "test-user-456",
        },
      }
    );

    // Second call
    const result2 = await wrapped(
      {},
      {
        auth: {
          uid: "test-user-456",
        },
      }
    );

    // Verify set was NOT called (account already exists)
    expect(mockSet).not.toHaveBeenCalled();

    // Verify both calls return same mapped data (no createdAt)
    expect(result1).toEqual(expectedResponse);
    expect(result2).toEqual(expectedResponse);
  });

  it("3️⃣ Reject unauthenticated", async () => {
    const wrapped = testEnv.wrap(createAccount);

    // Call without auth context
    await expect(
      wrapped(
        {},
        {
          auth: undefined,
        }
      )
    ).rejects.toThrow("Authentication required");

    // Verify no Firestore operations attempted
    expect(mockCollection).not.toHaveBeenCalled();
    expect(mockDoc).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });
});