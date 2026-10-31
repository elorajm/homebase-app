import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toFieldErrors } from "@/lib/field-errors";
import { VALIDATION_ERROR_MESSAGE } from "@/lib/messages";
import { errorResponse, jsonResponse, readJsonBody, requireJsonRequest, validationErrorResponse } from "@/lib/server/api";

const jsonRequest = (body: string, contentType = "application/json") =>
  new Request("http://localhost/api/test", { method: "POST", headers: { "content-type": contentType }, body });

describe("jsonResponse and errorResponse", () => {
  it("marks API responses as non-cacheable JSON", async () => {
    const response = jsonResponse({ data: { ok: true } }, 201);
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ data: { ok: true } });
  });

  it("includes field errors only when provided", async () => {
    expect(await errorResponse(400, "Bad").json()).toEqual({ error: "Bad" });
    expect(await errorResponse(400, "Bad", { email: "Nope" }).json()).toEqual({
      error: "Bad",
      fieldErrors: { email: "Nope" },
    });
  });
});

describe("requireJsonRequest", () => {
  it("accepts application/json with a charset", () => {
    expect(requireJsonRequest(jsonRequest("{}", "application/json; charset=utf-8"))).toBeNull();
  });

  it("rejects other content types with 415", () => {
    expect(requireJsonRequest(jsonRequest("a=b", "application/x-www-form-urlencoded"))?.status).toBe(415);
  });
});

describe("readJsonBody", () => {
  it("parses a valid JSON body", async () => {
    const result = await readJsonBody(jsonRequest('{"email":"a@example.com"}'));
    expect(result).toEqual({ ok: true, value: { email: "a@example.com" } });
  });

  it("rejects malformed JSON with 400", async () => {
    const result = await readJsonBody(jsonRequest("{not json"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it("rejects bodies over 16 KB with 413", async () => {
    const big = JSON.stringify({ text: "x".repeat(17 * 1024) });
    const result = await readJsonBody(jsonRequest(big));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(413);
    }
  });

  it("rejects non-JSON content types before reading the body", async () => {
    const result = await readJsonBody(jsonRequest("hello", "text/plain"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(415);
    }
  });
});

describe("toFieldErrors", () => {
  it("keeps the first message for each field and skips root-level issues", () => {
    const schema = z.object({ email: z.string().min(1, "Email is required.").email("Enter a valid email address.") });
    const result = schema.safeParse({ email: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error.issues)).toEqual({ email: "Email is required." });
    }
  });
});

describe("validationErrorResponse", () => {
  it("returns field errors with the shared validation message", async () => {
    const schema = z.object({ name: z.string().min(2, "Name is too short.") });
    const result = schema.safeParse({ name: "a" });
    if (result.success) throw new Error("expected failure");

    const response = validationErrorResponse(result.error);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: VALIDATION_ERROR_MESSAGE,
      fieldErrors: { name: "Name is too short." },
    });
  });

  it("explains unexpected keys when no field is at fault", async () => {
    const schema = z.strictObject({ name: z.string() });
    const result = schema.safeParse({ name: "Ada", role: "owner" });
    if (result.success) throw new Error("expected failure");

    const response = validationErrorResponse(result.error);
    expect((await response.json()).error).toMatch(/Unrecognized key/);
  });
});
