import { describe, expect, it } from "vitest";
import { formatDueDate, isOverdue, isValidIsoDate, parseIsoDate, toIsoDate } from "@/lib/dates";

describe("isValidIsoDate", () => {
  it("accepts real calendar dates", () => {
    expect(isValidIsoDate("2026-03-05")).toBe(true);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
  });

  it("rejects dates that do not exist", () => {
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
  });

  it("rejects values that are not YYYY-MM-DD", () => {
    expect(isValidIsoDate("03/05/2026")).toBe(false);
    expect(isValidIsoDate("2026-3-5")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });
});

describe("date round trip", () => {
  it("keeps the calendar day when parsed and formatted in UTC", () => {
    const parsed = parseIsoDate("2026-03-05");
    expect(toIsoDate(parsed)).toBe("2026-03-05");
    expect(formatDueDate(parsed)).toBe("Mar 5, 2026");
  });
});

describe("isOverdue", () => {
  const today = parseIsoDate("2026-03-10");

  it("flags pending chores due before today", () => {
    expect(isOverdue(parseIsoDate("2026-03-09"), "pending", today)).toBe(true);
  });

  it("does not flag chores due today or later", () => {
    expect(isOverdue(parseIsoDate("2026-03-10"), "pending", today)).toBe(false);
    expect(isOverdue(parseIsoDate("2026-03-11"), "pending", today)).toBe(false);
  });

  it("never flags completed chores", () => {
    expect(isOverdue(parseIsoDate("2026-03-01"), "completed", today)).toBe(false);
  });
});
