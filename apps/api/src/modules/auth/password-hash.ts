import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export const hashPassword = async (password: string, salt = randomBytes(16).toString("hex")) => {
  const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer;

  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
};

export const verifyPassword = async (password: string | undefined, storedHash: string | null | undefined) => {
  if (!password || !storedHash) return false;

  const [algorithm, salt, hash] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !hash) return false;

  const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer;
  const expected = Buffer.from(hash, "hex");

  return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey);
};
