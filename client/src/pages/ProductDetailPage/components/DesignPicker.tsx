import { Controller, type Control } from "react-hook-form";
import type { Design } from "@/lib/types";
import type { PickerValues } from "../schema";
import styles from "./DesignPicker.module.scss";

interface DesignPickerProps {
  designs: Design[];
  control: Control<PickerValues>;
}

export function DesignPicker({ designs, control }: DesignPickerProps) {
  return (
    <Controller
      control={control}
      name="designId"
      render={({ field, fieldState }) => (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Diseño</legend>
          <ul className={styles.strip} role="presentation">
            {designs.map((design) => {
              const isSelected = field.value === design.id;
              return (
                <li key={design.id} className={styles.item}>
                  <label className={styles.label} title={design.name}>
                    <input
                      type="radio"
                      name={field.name}
                      value={design.id}
                      checked={isSelected}
                      onChange={() => field.onChange(design.id)}
                      onBlur={field.onBlur}
                      aria-label={design.name}
                      className={styles.input}
                    />
                    <span
                      className={
                        isSelected
                          ? `${styles.tile} ${styles.tileSelected}`
                          : styles.tile
                      }
                    >
                      <img
                        src={design.imageUrl}
                        alt=""
                        className={styles.thumb}
                        loading="lazy"
                      />
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {fieldState.error?.message ? (
            <p role="alert" className={styles.error}>
              {fieldState.error.message}
            </p>
          ) : null}
        </fieldset>
      )}
    />
  );
}
