import type {
  FieldValues,
  Path,
  UseFormSetError,
  UseFormSetFocus,
} from "react-hook-form";
import { ApiError } from "@/services/api/fetchJson";

export type ServerFieldErrorRule<T extends FieldValues> = {
  field: Path<T>;
  // Override the server's message. Falls back to err.message when omitted —
  // useful when the server already returns a user-facing Spanish message.
  message?: string;
};

export type ServerFieldErrorMap<T extends FieldValues> = Record<
  string,
  ServerFieldErrorRule<T>
>;

// Maps an ApiError code onto a form field (setError + setFocus so the user
// scrolls to the offending input). Returns true when the error matched a rule
// — caller should short-circuit instead of rethrowing.
export function applyServerFieldError<T extends FieldValues>(
  err: unknown,
  map: ServerFieldErrorMap<T>,
  helpers: { setError: UseFormSetError<T>; setFocus: UseFormSetFocus<T> },
): boolean {
  if (!(err instanceof ApiError) || !err.code) return false;
  const rule = map[err.code];
  if (!rule) return false;
  helpers.setError(rule.field, {
    type: "server",
    message: rule.message ?? err.message,
  });
  helpers.setFocus(rule.field);
  return true;
}
