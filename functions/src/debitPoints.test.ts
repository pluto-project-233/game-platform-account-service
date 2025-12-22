/**
 * Tests for DebitPoints
 * Iteration 1.4
 */

import functionsTest from "firebase-functions-test";

const testEnv = functionsTest();

// Mock Firestore
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockRunTransaction = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();

mockDoc.mockReturnValue({get: mockGet, set: mockSet});
mockOrderBy.mockReturnValue({get: mockGet});
mockWhere.mockReturnValue({orderBy: mockOrderBy});
mockCollection.mockReturnValue({
  doc: mockDoc,
  where: mockWhere,
});

jest.mock("./firebase", () => ({
  db: {
    collection: mockCollection,
    runTransaction: mockRunTransaction,
  },
}));

import {debitPoints} from "./debitPoints";

describe("DebitPoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  it("✅ Debit success with sufficient balance", async () => {
    // Mock: account exists and is active
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({accountId: "test-user", status: "ACTIVE"}),
    });

    // Mock transaction
    mockRunTransaction.mockImplementation(async (updateFunction) => {
      const mockTx = {
        get: jest.fn()
          // Mock: ledger entry does not exist
          .mockResolvedValueOnce({exists: false})
          // Mock: ledger with sufficient balance
          .mockResolvedValueOnce({
            forEach: (callback: any) => {
              callback({data: () => ({type: "CREDIT", amount: 200})});
            },
          }),
        set: mockSet,
      };
      await updateFunction(mockTx);
    });

    const wrapped = testEnv.wrap(debitPoints);
    const result = await wrapped(
      {
        amount: 50,
        referenceId: "game-123",
        source: "GAME",
      },
      {auth: {uid: "test-user"}}
    );

    expect(result).toEqual({status: "OK"});
    expect(mockRunTransaction).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalled();
  });

  it("❌ Insufficient balance → reject", async () => {
    // Mock: account exists and is active
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({accountId: "test-user", status: "ACTIVE"}),
    });

    // Mock transaction
    mockRunTransaction.mockImplementation(async (updateFunction) => {
      const mockTx = {
        get: jest.fn()
          // Mock: ledger entry does not exist
          .mockResolvedValueOnce({exists: false})
          // Mock: ledger with insufficient balance
          .mockResolvedValueOnce({
            forEach: (callback: any) => {
              callback({data: () => ({type: "CREDIT", amount: 50})});
            },
          }),
        set: mockSet,
      };
      await updateFunction(mockTx);
    });

    const wrapped = testEnv.wrap(debitPoints);

    await expect(
      wrapped(
        {
          amount: 100,
          referenceId: "game-123",
          source: "GAME",
        },
        {auth: {uid: "test-user"}}
      )
    ).rejects.toThrow("Insufficient balance");
  });

  it("✅ Idempotent debit (atomic)", async () => {
    // Mock: account exists and is active
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({accountId: "test-user", status: "ACTIVE"}),
    });

    // Mock transaction: ledger entry already exists
    mockRunTransaction.mockImplementation(async (updateFunction) => {
      const mockTx = {
        get: jest.fn().mockResolvedValueOnce({exists: true}),
        set: mockSet,
      };
      await updateFunction(mockTx);
    });

    const wrapped = testEnv.wrap(debitPoints);
    const result = await wrapped(
      {
        amount: 50,
        referenceId: "game-123",
        source: "GAME",
      },
      {auth: {uid: "test-user"}}
    );

    expect(result).toEqual({status: "OK"});
    expect(mockRunTransaction).toHaveBeenCalled();
    // Verify no new ledger entry was created (idempotent no-op)
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("❌ Unauthenticated request → reject", async () => {
    const wrapped = testEnv.wrap(debitPoints);

    await expect(
      wrapped(
        {
          amount: 50,
          referenceId: "game-123",
          source: "GAME",
        },
        {auth: undefined}
      )
    ).rejects.toThrow("Authentication required");
  });

  it("❌ Account not found → reject", async () => {
    mockGet.mockResolvedValueOnce({
      exists: false,
    });

    const wrapped = testEnv.wrap(debitPoints);

    await expect(
      wrapped(
        {
          amount: 50,
          referenceId: "game-123",
          source: "GAME",
        },
        {auth: {uid: "test-user"}}
      )
    ).rejects.toThrow("Account not found");
  });

  it("❌ Suspended account → reject", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({accountId: "test-user", status: "SUSPENDED"}),
    });

    const wrapped = testEnv.wrap(debitPoints);

    await expect(
      wrapped(
        {
          amount: 50,
          referenceId: "game-123",
          source: "GAME",
        },
        {auth: {uid: "test-user"}}
      )
    ).rejects.toThrow("Cannot debit suspended account");
  });

  it("❌ Invalid amount → reject", async () => {
    const wrapped = testEnv.wrap(debitPoints);

    await expect(
      wrapped(
        {
          amount: 0,
          referenceId: "game-123",
          source: "GAME",
        },
        {auth: {uid: "test-user"}}
      )
    ).rejects.toThrow("amount must be a positive number");
  });

  it("❌ Missing referenceId → reject", async () => {
    const wrapped = testEnv.wrap(debitPoints);

    await expect(
      wrapped(
        {
          amount: 50,
          referenceId: "",
          source: "GAME",
        },
        {auth: {uid: "test-user"}}
      )
    ).rejects.toThrow("referenceId is required");
  });

  it("❌ Invalid source → reject", async () => {
    const wrapped = testEnv.wrap(debitPoints);

    await expect(
      wrapped(
        {
          amount: 50,
          referenceId: "game-123",
          source: "INVALID" as any,
        },
        {auth: {uid: "test-user"}}
      )
    ).rejects.toThrow("source must be GAME or ADMIN");
  });
});
