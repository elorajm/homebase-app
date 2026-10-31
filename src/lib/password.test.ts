import { describe, expect, it } from "vitest";
import { hashPassword, spendLoginTimeOnUnknownEmail, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("hashes with bcrypt at cost 12 and never stores the plain password", async () => {
    const hash = await hashPassword("correct-horse-1");
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(hash).not.toContain("correct-horse-1");
  });

  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("correct-horse-1");
    expect(await verifyPassword("correct-horse-1", hash)).toBe(true);
    expect(await verifyPassword("correct-horse-2", hash)).toBe(false);
  });

  it("runs the decoy comparison for unknown emails without throwing", async () => {
    await expect(spendLoginTimeOnUnknownEmail("anything")).resolves.toBeUndefined();
  });
});
