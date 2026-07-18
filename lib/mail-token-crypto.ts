import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedToken = {
  ciphertext: string;
  iv: string;
  tag: string;
};

function encryptionKey() {
  const configured = process.env.MAIL_TOKEN_ENCRYPTION_KEY;
  if (!configured) throw new Error("MAIL_TOKEN_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) throw new Error("MAIL_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

export function encryptMailToken(token: string): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptMailToken(token: EncryptedToken) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(token.iv, "base64"));
  decipher.setAuthTag(Buffer.from(token.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(token.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
