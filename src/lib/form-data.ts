import type { ZodError } from "zod";
import { VALIDATION_ERROR_MESSAGE, type FormState } from "@/lib/form-state";

export function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "password") {
      values[key] = value;
    }
  }
  return values;
}

export function invalidFormState(formData: FormData, error: ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return { error: VALIDATION_ERROR_MESSAGE, fieldErrors, values: formValues(formData) };
}
