import { describe, expect, it } from "vitest";
import { guardRedirect, safeNextPath } from "@/lib/redirects";

describe("guardRedirect", () => {
  it("sends signed-out users to login and remembers where they were going", () => {
    expect(guardRedirect("user", false, "/chores?filter=open")).toBe("/login?next=%2Fchores%3Ffilter%3Dopen");
  });

  it("lets signed-in users stay on app pages", () => {
    expect(guardRedirect("user", true, "/chores")).toBeNull();
  });

  it("sends signed-in users away from auth pages", () => {
    expect(guardRedirect("guest", true, "/login")).toBe("/dashboard");
  });

  it("lets signed-out users stay on auth pages", () => {
    expect(guardRedirect("guest", false, "/login")).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths, including query strings", () => {
    expect(safeNextPath("/chores")).toBe("/chores");
    expect(safeNextPath("/chores/edit?id=abc")).toBe("/chores/edit?id=abc");
  });

  it("falls back to the dashboard when no path is given", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
  });

  it("rejects other websites, protocol-relative URLs, and browser-normalized tricks", () => {
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\t/evil.example")).toBe("/dashboard");
  });

  it("does not loop back into the auth pages", () => {
    expect(safeNextPath("/login")).toBe("/dashboard");
    expect(safeNextPath("/login?next=/chores")).toBe("/dashboard");
    expect(safeNextPath("/register")).toBe("/dashboard");
  });
});
