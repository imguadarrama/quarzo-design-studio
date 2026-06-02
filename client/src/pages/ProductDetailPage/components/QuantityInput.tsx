import { useEffect, useState } from "react";
import { Controller, type Control } from "react-hook-form";
import { QuantityStepper } from "@/components/QuantityStepper/QuantityStepper";
import type { PickerValues } from "../schema";
import styles from "./QuantityInput.module.scss";

interface QuantityInputProps {
  control: Control<PickerValues>;
}

const MIN = 1;
const MAX = 999;

function clamp(n: number): number {
  if (Number.isNaN(n)) return MIN;
  return Math.max(MIN, Math.min(MAX, Math.trunc(n)));
}

export function QuantityInput({ control }: QuantityInputProps) {
  return (
    <Controller
      control={control}
      name="quantity"
      render={({ field, fieldState }) => {
        const current = typeof field.value === "number" ? field.value : MIN;
        const decrement = () => field.onChange(clamp(current - 1));
        const increment = () => field.onChange(clamp(current + 1));

        return (
          <div className={styles.wrapper}>
            <span className={styles.legend}>Cantidad</span>
            <QuantityStepper
              value={current}
              min={MIN}
              max={MAX}
              onDecrement={decrement}
              onIncrement={increment}
            >
              <QuantityField
                value={current}
                onCommit={(n) => field.onChange(n)}
                onBlur={field.onBlur}
              />
            </QuantityStepper>
            {fieldState.error?.message ? (
              <p role="alert" className={styles.error}>
                {fieldState.error.message}
              </p>
            ) : null}
          </div>
        );
      }}
    />
  );
}

interface QuantityFieldProps {
  value: number;
  onCommit: (n: number) => void;
  onBlur: () => void;
}

function QuantityField({ value, onCommit, onBlur }: QuantityFieldProps) {
  // Holds the raw string while the user is typing so partial input ("",
  // "1", "12") doesn't snap back to a clamped number mid-edit.
  const [draft, setDraft] = useState<string>(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <input
      type="number"
      inputMode="numeric"
      min={MIN}
      max={MAX}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const clamped = clamp(Number(draft));
        setDraft(String(clamped));
        onCommit(clamped);
        onBlur();
      }}
      aria-label="Cantidad"
      className={styles.value}
    />
  );
}
