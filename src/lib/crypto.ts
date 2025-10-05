// src/lib/crypto.ts
// Client-side AES-GCM encryption/decryption using Web Crypto API
// Key derived from userId (UID) + fixed salt for deterministic per-user encryption

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const FIXED_SALT = textEncoder.encode("vault-app-salt-2025"); // Fixed salt; change in prod

/**
 * Convert string to ArrayBuffer
 */
function strToArrayBuffer(str: string): ArrayBuffer {
  return textEncoder.encode(str).buffer;
}

/**
 * Convert ArrayBuffer to Base64
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 to ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  try {
    if (!base64 || typeof base64 !== "string") {
      throw new Error("Invalid Base64 input");
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (err) {
    throw new Error(`Base64 decode failed: ${err}`);
  }
}

/**
 * Safely parse potentially double-escaped JSON (exported for VaultManager)
 */
export function safeParseJson(raw: string): any {
  try {
    let parsed = JSON.parse(raw);
    // If parsed is string and looks like JSON (starts with '{'), unescape
    if (typeof parsed === "string" && parsed.startsWith("{") && parsed.endsWith("}")) {
      parsed = JSON.parse(parsed);
    }
    return parsed;
  } catch {
    return null; // Not JSON
  }
}

/**
 * Derive AES-GCM key from userId + fixed salt
 */
async function deriveKeyFromUserId(userId: string): Promise<CryptoKey> {
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    strToArrayBuffer(userId),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: FIXED_SALT,
      iterations: 250_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  return key;
}

/**
 * Encrypts string data using AES-GCM
 */
export async function encryptData(data: string, userId: string): Promise<{
  cipherText: string;
  salt: string;
  iv: string;
}> {
  if (!data || !userId) {
    throw new Error("Data and userId required");
  }

  const salt = FIXED_SALT;
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromUserId(userId);

  const encoded = strToArrayBuffer(data);
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  return {
    cipherText: bufferToBase64(cipherBuffer),
    salt: bufferToBase64(salt.buffer), // Explicit .buffer
    iv: bufferToBase64(iv.buffer), // Explicit .buffer
  };
}

/**
 * Decrypts AES-GCM data
 */
export async function decryptData(
  encrypted: { cipherText: string; salt: string; iv: string },
  userId: string
): Promise<string> {
  if (!encrypted?.cipherText || !encrypted?.salt || !encrypted?.iv || !userId) {
    throw new Error("Complete encrypted object and userId required");
  }

  const saltBuffer = base64ToBuffer(encrypted.salt);
  const ivBuffer = base64ToBuffer(encrypted.iv);
  const cipherBuffer = base64ToBuffer(encrypted.cipherText);

  // Fix: Explicit type assertion for TS
  const salt = new Uint8Array(saltBuffer as ArrayBuffer);
  const iv = new Uint8Array(ivBuffer as ArrayBuffer);

  const key = await deriveKeyFromUserId(userId);

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipherBuffer
    );
  } catch (err: any) {
    throw new Error(`Decryption failed: ${err.message || "Invalid userId or corrupted data"}`);
  }

  const decoded = textDecoder.decode(decryptedBuffer);
  if (!decoded) {
    throw new Error("Decryption resulted in empty data");
  }

  return decoded;
}