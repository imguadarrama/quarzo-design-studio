import { createContext } from "react";

export type FormFieldContextValue = {
  controlId: string;
  errorId: string;
  hintId: string | null;
  hasError: boolean;
};

export const FormFieldContext = createContext<FormFieldContextValue | null>(null);
