import { z } from "zod";
import { isValidIsoDate } from "@/lib/dates";

function requiredText(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);
}

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required.")
  .max(254, "Email must be 254 characters or fewer.")
  .pipe(z.email("Enter a valid email address."));

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.");

export const registerSchema = z.object({
  firstName: requiredText("First name", 60),
  lastName: requiredText("Last name", 60),
  email: emailField,
  password: passwordField,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Email is required."),
  password: z.string().min(1, "Password is required."),
});

export const profileSchema = z.object({
  firstName: requiredText("First name", 60),
  lastName: requiredText("Last name", 60),
});

export const householdNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Household name must be at least 2 characters.")
    .max(60, "Household name must be 60 characters or fewer."),
});

export const joinHouseholdSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8}$/, "Invite code must be 8 letters or numbers."),
});

export const memberRoleSchema = z.object({
  memberId: z.string().min(1, "That member could not be found."),
  role: z.enum(["adult", "member"], { error: "Choose adult or member." }),
});

export const memberRemovalSchema = z.object({
  memberId: z.string().min(1, "That member could not be found."),
});

export const choreSchema = z.object({
  title: requiredText("Chore name", 120),
  description: z.string().trim().max(1000, "Description must be 1000 characters or fewer."),
  assignedUserId: z.string().min(1, "Choose a household member to assign this chore to."),
  dueDate: z
    .string()
    .min(1, "Due date is required.")
    .refine(isValidIsoDate, "Enter a valid due date."),
});

export const choreStatusSchema = z.object({
  choreId: z.string().min(1, "That chore could not be found."),
  status: z.enum(["pending", "completed"], { error: "Choose a valid status." }),
});
