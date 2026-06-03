import type { ReactNode } from "react";
import { Button } from "@/components/Button/Button";
import styles from "./QuantityStepper.module.scss";

interface QuantityStepperProps {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  min?: number;
  max?: number;
  children: ReactNode;
}

export function QuantityStepper({
  value,
  onDecrement,
  onIncrement,
  min = 1,
  max = 999,
  children,
}: QuantityStepperProps) {
  return (
    <div className={styles.stepper}>
      <Button
        size="sm"
        variant="ghost"
        aria-label="Disminuir cantidad"
        disabled={value <= min}
        onClick={onDecrement}
        className={styles.button}
      >
        −
      </Button>
      {children}
      <Button
        size="sm"
        variant="ghost"
        aria-label="Aumentar cantidad"
        disabled={value >= max}
        onClick={onIncrement}
        className={styles.button}
      >
        +
      </Button>
    </div>
  );
}
