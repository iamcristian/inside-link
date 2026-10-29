import crypto from "node:crypto";

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(pin, salt, 32);
  return `v1:${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPin(pin: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(":");
    if (parts.length !== 3 || parts[0] !== "v1") {
      return false;
    }

    const salt = parts[1];
    const originalHashHex = parts[2];
    if (!salt || !originalHashHex) {
      return false;
    }

    const originalHash = Buffer.from(originalHashHex, "hex");
    const derivedKey = crypto.scryptSync(pin, salt, 32);

    if (originalHash.length !== derivedKey.length) {
      return false;
    }

    return crypto.timingSafeEqual(originalHash, derivedKey);
  } catch {
    return false;
  }
}
