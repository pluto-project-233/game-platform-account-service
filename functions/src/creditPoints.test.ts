/**
 * Tests for CreditPoints
 * Iteration 1.5
 */

import functionsTest from "firebase-functions-test";

const testEnv = functionsTest();

// Mock Firestore
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockRunTransaction = jest.fn();

mockDoc.mockReturnValue({get: mockGet, set: mockSet});
mockCollection.mockReturnValue({doc: mockDoc});

jest.mock("./firebase", () => ({
  db: {
    collection: mockCollection,
    runTransaction: mockRunTransaction,
  },
}));

import {creditPoints} from "./creditPoints";

describe("CreditPoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  it("✅ Creates ledger entry with valid input", async () => {
    // Mock: account exists and is active
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({accountId: "test-user", status: "ACTIVE"}),
    });

    // Mock transaction
    mockRunTransaction.mockImplementation(async (updateFunction) => {
      const mockTx = {
        get: jest.fn()
          // First call: ledger entry does not exist
          .mockResolvedValueOnce({exists: false})
          // Second call: account exists
          .mockResolvedValueOnce({
            exists: true,
            data: () => ({balanceSnapshot: 0}),
          }),
        set: mockSet,
        update: jest.fn(),
      };
      await updateFunction(mockTx);
    });

    const wrapped = testEnv.wrap(creditPoints);
    const result = await wrapped(
      {
        amount: 100,
        referenceId: "payment-123",
        source: "PAYMENT",
      },
      {
        auth: {uid: "test-user"},
      }
    );

    expect(result).toEqual({status: "OK"});
    expect(mockRunTransaction).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalled();
  });

  it("❌ Rejects unauthenticated request", async () => {
    const wrapped = testEnv.wrap(creditPoints);

    await expect(
      wrapped(
        {
          amount: 100,
          referenceId: "payment-123",
          source: "PAYMENT",
        },
        {auth: undefined}
      )
    ).rejects.toThrow("Authentication required");
  });

  it("❌ Rejects amount <= 0", async () => {
    const wrapped = testEnv.wrap(creditPoints);

    await expect(
      wrapped(
        {
          amount: 0,
          referenceId: "payment-123",
          source: "PAYMENT",
        },
        {auth: {uid: "test-user"}}
      )
    ).rejects.toThrow("amount must be a positive number");

    await expect(
      wrapped(
        {
          amount: -10,
          referenceId: "payment-123",
          source: "PAYMENT",
        },
        {auth: {uid: "test-user"}}
      )
    ).rejects.toThrow("amount must be a positive number");
  });

  it("❌ Rejects missing referenceId", async () => {
    const wrapped = testEnv.wrap(creditPoints);

    await expect(
      wrapped(
        {
          amount: 100,
          referenceId: "",
          source: "PAYMENT",
        },
        {auth: {uid: "test-user"}}
      )
    ).rejects.toThrow("referenceId is required");
  });

  it("❌ Rejects invalid source", async () => {
    const wrapped = testEnv.wrap(creditPoints);

    await expect(
      wrapped(
        {
          amount: 100,
          referenceId: "payment-123",
          source: "INVALID" as any,
        },
        {auth: {uid: "test-user"}}
      )
    ).rejects.toThrow("source must be PAYMENT or ADMIN");
  });

  it("❌ Rejects if account not found", async () => {
    mockGet.mockResolvedValueOnce({
      exists: false,
    });

    const wrapped = testEnv.wrap(creditPoints);

    await expect(
      wrapped(
        {
          amount: 100,
          referenceId: "payment-123",
          source: "PAYMENT",
        },
        {auth: {uid: "test-user"}}
      )
    ).rejects.toThrow("Account not found");
  });

  it("❌ Rejects if account is suspended", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({accountId: "test-user", status: "SUSPENDED"}),
    });

    const wrapped = testEnv.wrap(creditPoints);

    await expect(
      wrapped(
        {
          amount: 100,
          referenceId: "payment-123",
          source: "PAYMENT",
        },
        {auth: {uid: "test-user"}}
      )
    ).rejects.toThrow("Cannot credit suspended account");
  });

  it("✅ Idempotent: returns success on duplicate referenceId (atomic)", async () => {
    // Mock: account exists and is active
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({accountId: "test-user", status: "ACTIVE"}),
    });

    // Mock transaction: ledger entry already exists
    mockRunTransaction.mockImplementation(async (updateFunction) => {
      const mockTx = {
        get: jest.fn()
          // First call: ledger entry exists (idempotent)
          .mockResolvedValueOnce({exists: true}),
        set: mockSet,
        update: jest.fn(),
      };
      await updateFunction(mockTx);
    });

    const wrapped = testEnv.wrap(creditPoints);
    const result = await wrapped(
      {
        amount: 100,
        referenceId: "payment-123",
        source: "PAYMENT",
      },
      {auth: {uid: "test-user"}}
    );

    expect(result).toEqual({status: "OK"});
    expect(mockRunTransaction).toHaveBeenCalled();
    // Verify no new ledger entry was created (idempotent no-op)
    expect(mockSet).not.toHaveBeenCalled();
  });
});