import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  if (key.length < KEY_LENGTH) {
    // Pad or hash the key to ensure it's 32 bytes
    return Buffer.from(
      crypto.createHash("sha256").update(key).digest("hex").slice(0, KEY_LENGTH)
    );
  }
  return Buffer.from(key.slice(0, KEY_LENGTH));
}

/**
 * Encrypts a plaintext string using AES-256-CBC
 * Returns a hex string in format: iv:encryptedData
 */
export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    return `${iv.toString("hex")}:${encrypted}`;
  } catch (error) {
    throw new Error(
      `Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Decrypts an encrypted string (format: iv:encryptedData)
 * Returns the original plaintext
 */
export function decrypt(hash: string): string {
  try {
    const key = getEncryptionKey();
    const [ivHex, encryptedData] = hash.split(":");

    if (!ivHex || !encryptedData) {
      throw new Error("Invalid encrypted data format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Safely encrypts a value, returning null if the value is null/undefined
 */
export function encryptOptional(value: string | null | undefined): string | null {
  if (!value) return null;
  return encrypt(value);
}

/**
 * Safely decrypts a value, returning null if the value is null/undefined
 */
export function decryptOptional(hash: string | null | undefined): string | null {
  if (!hash) return null;
  return decrypt(hash);
}
