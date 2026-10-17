export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";
export const VALIDATION_ERROR_MESSAGE = "Please correct the highlighted fields.";
export const NOT_ALLOWED_MESSAGE = "You do not have permission to do that.";
