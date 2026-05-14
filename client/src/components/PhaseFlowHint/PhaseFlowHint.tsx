import { Link } from "react-router-dom";
import styles from "./PhaseFlowHint.module.scss";

type Step = "categorias" | "paletas" | "disenos" | "productos";

const STEPS: { key: Step; label: string; to: string }[] = [
  { key: "categorias", label: "Paso 1: Categorías", to: "/admin/categorias" },
  { key: "paletas", label: "Paso 2: Paletas", to: "/admin/paletas" },
  { key: "disenos", label: "Paso 3: Diseños", to: "/admin/disenos" },
  { key: "productos", label: "Paso 4: Productos", to: "/admin/productos" },
];

type Props = {
  current: Step;
};

export function PhaseFlowHint({ current }: Props) {
  return (
    <nav className={styles.wrap} aria-label="Flujo de configuración">
      {STEPS.map((step, idx) => {
        const isCurrent = step.key === current;
        return (
          <span key={step.key} className={styles.stepWrap}>
            {isCurrent ? (
              <span
                className={`${styles.step} ${styles.current}`}
                aria-current="step"
              >
                {step.label}
              </span>
            ) : (
              <Link to={step.to} className={styles.step}>
                {step.label}
              </Link>
            )}
            {idx < STEPS.length - 1 ? (
              <span aria-hidden className={styles.sep}>
                →
              </span>
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}
