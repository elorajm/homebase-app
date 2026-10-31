import { describe, expect, it } from "vitest";
import { generateInviteCode } from "@/lib/invite-code";

describe("generateInviteCode", () => {
  it("creates 8 characters from the unambiguous alphabet by default", () => {
    expect(generateInviteCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it("produces different codes across calls", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateInviteCode()));
    expect(codes.size).toBe(50);
  });

  it("never uses look-alike characters such as O, 0, I, and 1", () => {
    const sample = Array.from({ length: 200 }, () => generateInviteCode()).join("");
    expect(sample).not.toMatch(/[IO01]/);
  });
});
