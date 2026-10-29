import { describe, it, expect } from "vitest";
import { hashPin, verifyPin } from "@/server/crypto/pin";

describe("PIN Hashing and Verification", () => {
  it("hashes a PIN and verifies it accurately", () => {
    const pin = "1234";
    const hash = hashPin(pin);
    expect(hash.startsWith("v1:")).toBe(true);

    expect(verifyPin("1234", hash)).toBe(true);
    expect(verifyPin("4321", hash)).toBe(false);
    expect(verifyPin("", hash)).toBe(false);
  });
});
