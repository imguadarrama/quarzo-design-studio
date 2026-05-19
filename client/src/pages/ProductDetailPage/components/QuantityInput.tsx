import { Controller, type Control } from "react-hook-form";
import { Button } from "@/components/Button/Button";
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
            <div className={styles.stepper}>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Disminuir cantidad"
                disabled={current <= MIN}
                onClick={decrement}
                className={styles.stepperButton}
              >
                −
              </Button>
              <input
                type="number"
                inputMode="numeric"
                min={MIN}
                max={MAX}
                value={current}
                onChange={(e) => field.onChange(clamp(Number(e.target.value)))}
                onBlur={field.onBlur}
                aria-label="Cantidad"
                className={styles.value}
              />
              <Button
                size="sm"
                variant="ghost"
                aria-label="Aumentar cantidad"
                disabled={current >= MAX}
                onClick={increment}
                className={styles.stepperButton}
              >
                +
              </Button>
            </div>
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
