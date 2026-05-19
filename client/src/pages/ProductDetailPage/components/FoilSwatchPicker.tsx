import { Controller, type Control } from "react-hook-form";
import type { OptionSwatch } from "@/lib/types";
import type { PickerValues } from "../schema";
import styles from "./FoilSwatchPicker.module.scss";

interface FoilSwatchPickerProps {
  swatches: OptionSwatch[];
  control: Control<PickerValues>;
}

export function FoilSwatchPicker({ swatches, control }: FoilSwatchPickerProps) {
  return (
    <Controller
      control={control}
      name="foilSwatchId"
      render={({ field, fieldState }) => {
        if (swatches.length === 0) {
          return (
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Elige un color de foil</legend>
              <p className={styles.empty}>Sin colores disponibles por ahora.</p>
            </fieldset>
          );
        }

        return (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Elige un color de foil</legend>
            <ul className={styles.strip}>
              {swatches.map((swatch) => {
                const isSelected = field.value === swatch.id;
                return (
                  <li key={swatch.id} className={styles.item}>
                    <label className={styles.label} title={swatch.name}>
                      <input
                        type="radio"
                        name={field.name}
                        value={swatch.id}
                        checked={isSelected}
                        onChange={() => field.onChange(swatch.id)}
                        onBlur={field.onBlur}
                        aria-label={swatch.name}
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
                          src={swatch.imageUrl}
                          alt=""
                          className={styles.swatch}
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
        );
      }}
    />
  );
}
