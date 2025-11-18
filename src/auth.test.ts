import { describe, it, expect } from "vitest";
import { makeJWT, validateJWT } from "./auth";

describe("JWT Auth", () => {
  const secret = "super_secure_secret_key";
  const userID = "user-123-abc";

  it("should create and verify a valid token", () => {
    // 1. Create a token that expires in 1 hour (3600 seconds)
    const token = makeJWT(userID, 3600, secret);

    // 2. Verify it works
    const extractedID = validateJWT(token, secret);

    // 3. Expect the ID to match the one we put in
    expect(extractedID).toBe(userID);
  });

  it("should throw error for invalid secret", () => {
    const token = makeJWT(userID, 3600, secret);

    // Try to verify with the WRONG secret
    expect(() => {
      validateJWT(token, "wrong_secret");
    }).toThrow(); // Should fail because signature won't match
  });

  it("should throw error for expired token", () => {
    // Create a token that 'expired' 5 seconds ago (negative duration)
    const expiredToken = makeJWT(userID, -5, secret);

    expect(() => {
      validateJWT(expiredToken, secret);
    }).toThrow(); // Should fail because it's expired
  });
});
