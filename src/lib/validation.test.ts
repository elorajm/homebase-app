import { describe, expect, it } from "vitest";
import {
  householdNameSchema,
  joinHouseholdSchema,
  loginSchema,
  memberRoleSchema,
  registerSchema,
  choreSchema,
} from "@/lib/validation";

const validRegistration = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  password: "longenough",
};

const validChore = {
  title: "Take out recycling",
  description: "",
  assignedUserId: "user_1",
  dueDate: "2026-03-05",
};

describe("registerSchema", () => {
  it("accepts a complete registration and normalizes the email", () => {
    const result = registerSchema.safeParse({ ...validRegistration, email: "  Ada@Example.COM " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
    }
  });

  it("requires names", () => {
    expect(registerSchema.safeParse({ ...validRegistration, firstName: "   " }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegistration, lastName: "" }).success).toBe(false);
  });

  it("rejects malformed email addresses", () => {
    expect(registerSchema.safeParse({ ...validRegistration, email: "not-an-email" }).success).toBe(false);
  });

  it("enforces password length bounds", () => {
    expect(registerSchema.safeParse({ ...validRegistration, password: "1234567" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegistration, password: "12345678" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...validRegistration, password: "a".repeat(73) }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires an email and a password", () => {
    expect(loginSchema.safeParse({ email: "", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "ada@example.com", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "ada@example.com", password: "x" }).success).toBe(true);
  });
});

describe("householdNameSchema", () => {
  it("requires between 2 and 60 characters", () => {
    expect(householdNameSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(householdNameSchema.safeParse({ name: "Ab" }).success).toBe(true);
    expect(householdNameSchema.safeParse({ name: "a".repeat(61) }).success).toBe(false);
  });
});

describe("joinHouseholdSchema", () => {
  it("normalizes case and accepts 8 letters or digits", () => {
    const result = joinHouseholdSchema.safeParse({ inviteCode: "abc23456" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inviteCode).toBe("ABC23456");
    }
  });

  it("rejects codes with the wrong length or symbols", () => {
    expect(joinHouseholdSchema.safeParse({ inviteCode: "ABC" }).success).toBe(false);
    expect(joinHouseholdSchema.safeParse({ inviteCode: "ABC-2345" }).success).toBe(false);
  });
});

describe("memberRoleSchema", () => {
  it("allows only adult or member, never owner", () => {
    expect(memberRoleSchema.safeParse({ memberId: "m1", role: "adult" }).success).toBe(true);
    expect(memberRoleSchema.safeParse({ memberId: "m1", role: "member" }).success).toBe(true);
    expect(memberRoleSchema.safeParse({ memberId: "m1", role: "owner" }).success).toBe(false);
  });
});

describe("choreSchema", () => {
  it("accepts a valid chore", () => {
    expect(choreSchema.safeParse(validChore).success).toBe(true);
  });

  it("rejects an empty or overlong title", () => {
    expect(choreSchema.safeParse({ ...validChore, title: "" }).success).toBe(false);
    expect(choreSchema.safeParse({ ...validChore, title: "x".repeat(121) }).success).toBe(false);
  });

  it("requires an assignee", () => {
    expect(choreSchema.safeParse({ ...validChore, assignedUserId: "" }).success).toBe(false);
  });

  it("rejects due dates that do not exist", () => {
    expect(choreSchema.safeParse({ ...validChore, dueDate: "2026-02-30" }).success).toBe(false);
    expect(choreSchema.safeParse({ ...validChore, dueDate: "" }).success).toBe(false);
  });
});
