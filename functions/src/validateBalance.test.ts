/**
 * Tests for ValidateBalance
 * Iteration 1.4
 */

import functionsTest from "firebase-functions-test";

const testEnv = functionsTest();

// Mock Firestore
const mockGet = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();

mockDoc.mockReturnValue({get: mockGet});
mockOrderBy.mockReturnValue({get: mockGet});
mockWhere.mockReturnValue({orderBy: mockOrderBy});
mockCollection.mockReturnValue({
  doc: mockDoc,
  where: mockWhere,
});

jest.mock("./firebase", () => ({
  db: {
    collection: mockCollection,
  },
}));

import {validateBalance} from "./validateBalance";

describe("ValidateBalance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  it("✅ Balance = 0 → reject", async () => {
    // Mock: account exists and is active
    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({accountId: "test-user", status: "ACTIVE"}),
      })
      // Mock: no ledger entries (balance = 0)
      .mockResolvedValueOnce({
        forEach: jest.fn(),
      });

    const wrapped = testEnv.wrap(validateBalance);
    const result = await wrapped(
      {amount: 100},
      {auth: {uid: "test-user"}}
    );

    expect(result).toEqual({
      allowed: false,
      balance: 0,
    });
  });

  it("✅ Balance sufficient → allow", async () => {
    // Mock: account exists and is active
    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({accountId: "test-user", status: "ACTIVE"}),
      })
      // Mock: ledger with sufficient balance
      .mockResolvedValueOnce({
        forEach: (callback: any) => {
          callback({data: () => ({type: "CREDIT", amount: 200})});
          callback({data: () => ({type: "DEBIT", amount: 50})});
        },
      });

    const wrapped = testEnv.wrap(validateBalance);
    const result = await wrapped(
      {amount: 100},
      {auth: {uid: "test-user"}}
    );

    expect(result).toEqual({
      allowed: true,
      balance: 150,
    });
  });

  it("❌ Suspended account → reject", async () => {
    // Mock: account exists but is suspended
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({accountId: "test-user", status: "SUSPENDED"}),
    });

    const wrapped = testEnv.wrap(validateBalance);

    await expect(
      wrapped(
        {amount: 100},
        {auth: {uid: "test-user"}}
      )
    ).rejects.toThrow("Account is suspended");
  });

  it("❌ Unauthenticated request → reject", async () => {
    const wrapped = testEnv.wrap(validateBalance);

    await expect(
      wrapped(
        {amount: 100},
        {auth: undefined}
      )
    ).rejects.toThrow("Authentication required");
  });

  it("❌ Account not found → reject", async () => {
    mockGet.mockResolvedValueOnce({
      exists: false,
    });

    const wrapped = testEnv.wrap(validateBalance);

    await expect(
      wrapped(
        {amount: 100},
        {auth: {uid: "test-user"}}
      )
    ).rejects.toThrow("Account not found");
  });

  it("❌ Invalid amount → reject", async () => {
    const wrapped = testEnv.wrap(validateBalance);

    await expect(
      wrapped(
        {amount: 0},
        {auth: {uid: "test-user"}}
      )
    ).rejects.toThrow("amount must be a positive number");

    await expect(
      wrapped(
        {amount: -10},
        {auth: {uid: "test-user"}}
      )
    ).rejects.toThrow("amount must be a positive number");
  });
});
