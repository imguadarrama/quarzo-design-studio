import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Link } from "react-router-dom";
import { Card } from "@/components/Card/Card";
import { PageError, PageLoading } from "@/components/PageState/PageState";
import { listDesigns } from "@/services/api/admin";
import type { AdminDesign, VariantKind } from "@/lib/types";
import type { ProductFormValues } from "../schema.js";
import styles from "./ProductDesignsSelector.module.scss";

const KIND_LABELS: Record<VariantKind, string> = {
  CON_FOIL: "Foil",
  CON_TINTA_NORMAL: "Tinta",
  CON_FOIL_Y_TINTA: "Foil + Tinta",
  PAPEL_TEXTURIZADO: "Texturizado",
};

export function ProductDesignsSelector() {
  const { setValue, watch } = useFormContext<ProductFormValues>();
  const selected = watch("designIds") ?? [];
  const [designs, setDesigns] = useState<AdminDesign[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listDesigns()
      .then((all) => {
        if (cancelled) return;
        setDesigns(all);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error al cargar los diseños");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    setValue("designIds", next, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <section className={styles.section} aria-labelledby="designs-heading">
      <header className={styles.heading}>
        <h2 id="designs-heading" className={styles.title}>
          Diseños disponibles
        </h2>
        <span className={styles.counter}>
          {selected.length} seleccionados
        </span>
      </header>
      <p className={styles.hint}>
        Elige los diseños globales que aplican a este producto. Para agregar o
        editar diseños, ve a{" "}
        <Link className={styles.link} to="/admin/disenos">
          /admin/diseños
        </Link>
        .
      </p>

      {error ? <PageError message={error} /> : null}
      {!error && designs === null ? <PageLoading label="Cargando diseños…" /> : null}

      {designs && designs.length === 0 ? (
        <p className={styles.empty}>
          No hay diseños creados.{" "}
          <Link className={styles.link} to="/admin/disenos/nuevo">
            Crea el primero →
          </Link>
        </p>
      ) : null}

      {designs && designs.length > 0 ? (
        <ul className={styles.grid}>
          {designs
            .filter((d) => d.active)
            .map((d) => {
              const isSelected = selected.includes(d.id);
              return (
                <li key={d.id} className={styles.item}>
                  <label className={styles.label}>
                    <Card
                      className={`${styles.card} ${
                        isSelected ? styles.cardSelected : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={isSelected}
                        onChange={() => toggle(d.id)}
                      />
                      <img
                        src={d.imageUrl}
                        alt={d.name}
                        className={styles.thumb}
                        loading="lazy"
                      />
                      <div className={styles.meta}>
                        <span className={styles.name}>{d.name}</span>
                        <div className={styles.kinds}>
                          {d.compatibleKinds.map((k) => (
                            <span key={k} className={styles.kindBadge}>
                              {KIND_LABELS[k]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </label>
                </li>
              );
            })}
        </ul>
      ) : null}
    </section>
  );
}
