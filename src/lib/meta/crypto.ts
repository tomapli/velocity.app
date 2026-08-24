import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;
const TOKEN_FORMAT_VERSION = "v1";
const TOKEN_PART_COUNT = 4;

/** Encrypts a Meta token with authenticated encryption for server-side storage. */
export function encryptMetaToken(token: string): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    TOKEN_FORMAT_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** Decrypts an application-encrypted Meta token. */
export function decryptMetaToken(value: string): string {
  const parts = value.split(".");
  if (parts.length !== TOKEN_PART_COUNT || parts[0] !== TOKEN_FORMAT_VERSION) {
    throw new Error("Unsupported encrypted Meta token format");
  }

  const [, encodedIv, encodedTag, encodedCiphertext] = parts;
  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(encodedIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function getEncryptionKey(): Buffer {
  const rawKey = process.env.META_TOKEN_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error("META_TOKEN_ENCRYPTION_KEY is not configured");
  }

  const key = /^[a-f\d]{64}$/i.test(rawKey)
    ? Buffer.from(rawKey, "hex")
    : Buffer.from(rawKey, "base64");
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error("META_TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  }

  return key;
}

