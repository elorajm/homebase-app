export type FieldErrors = Record<string, string>;

type ValidationIssue = { path: readonly PropertyKey[]; message: string };

// Keeps the first message per field. Issues without a field name (for example, unknown keys) are skipped.
export function toFieldErrors(issues: readonly ValidationIssue[]): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of issues) {
    const field = issue.path.map(String).join(".");
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}
