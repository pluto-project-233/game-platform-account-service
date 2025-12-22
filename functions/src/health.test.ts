/**
 * Test: health endpoint
 * Expectation: returns service status
 */

import functionsTest from "firebase-functions-test";

const testEnv = functionsTest();

import {health} from "./health";

describe("Health Endpoint", () => {
  afterAll(() => {
    testEnv.cleanup();
  });

  it("should return 200 OK", () => {
    const req = {} as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    health(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ok",
        service: "account-service",
        timestamp: expect.any(String),
      })
    );
  });

  it("should include valid ISO timestamp", () => {
    const req = {} as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    health(req, res);

    const call = res.json.mock.calls[0][0];
    const timestamp = new Date(call.timestamp);
    expect(timestamp.toISOString()).toBe(call.timestamp);
  });
});

