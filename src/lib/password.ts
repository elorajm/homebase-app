import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;
let timingDecoyHash: Promise<string> | null = null;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

// Spends the same bcrypt time for unknown emails so login timing does not reveal which accounts exist.
export async function spendLoginTimeOnUnknownEmail(password: string): Promise<void> {
  timingDecoyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await bcrypt.compare(password, await timingDecoyHash);
}
