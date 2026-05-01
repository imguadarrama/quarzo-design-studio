import { useState } from "react";

export function useFormSubmit<TValues>(
  handler: (values: TValues) => Promise<void>,
) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async (values: TValues) => {
    setSubmitError(null);
    try {
      await handler(values);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Ocurrió un error inesperado",
      );
    }
  };

  return {
    submit,
    submitError,
    clearSubmitError: () => setSubmitError(null),
  };
}
