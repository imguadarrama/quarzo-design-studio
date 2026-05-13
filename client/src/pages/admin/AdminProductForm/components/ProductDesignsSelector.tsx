import { useEffect, useMemo, useState } from "react";
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

type Props = {
  categoryId: string | null;
};

export function ProductDesignsSelector({ categoryId }: Props) {
  const { setValue, watch } = useFormContext<ProductFormValues>();
  const selected = watch("designIds") ?? [];
  const [allDesigns, setAllDesigns] = useState<AdminDesign[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listDesigns()
      .then((all) => {
        if (cancelled) return;
        setAllDesigns(all);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error al cargar los diseños");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleDesigns = useMemo(() => {
    if (!allDesigns || !categoryId) return [];
    return allDesigns.filter(
      (d) => d.active && d.categoryIds.includes(categoryId),
    );
  }, [allDesigns, categoryId]);

  // Sweep stale designIds when the visible set changes (category swap or
  // designs reloaded). Removes selections that no longer match the current
  // category so the admin doesn't accidentally save a bad join.
  useEffect(() => {
    if (!allDesigns || !categoryId) return;
    const visibleIdSet = new Set(visibleDesigns.map((d) => d.id));
    const swept = selected.filter((id) => visibleIdSet.has(id));
    if (swept.length !== selected.length) {
      setValue("designIds", swept, { shouldDirty: true, shouldValidate: true });
    }
  }, [visibleDesigns, allDesigns, categoryId, selected, setValue]);

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
        Solo se muestran los diseños asignados a la categoría seleccionada.
        Para agregar o editar diseños, ve a{" "}
        <Link className={styles.link} to="/admin/disenos">
          /admin/diseños
        </Link>
        .
      </p>

      {error ? <PageError message={error} /> : null}
      {!error && allDesigns === null ? <PageLoading label="Cargando diseños…" /> : null}

      {allDesigns && !categoryId ? (
        <p className={styles.empty}>
          Selecciona una categoría primero para ver los diseños disponibles.
        </p>
      ) : null}

      {allDesigns && categoryId && visibleDesigns.length === 0 ? (
        <p className={styles.empty}>
          No hay diseños asignados a esta categoría.{" "}
          <Link className={styles.link} to="/admin/disenos">
            Asigna esta categoría a un diseño →
          </Link>
        </p>
      ) : null}

      {visibleDesigns.length > 0 ? (
        <ul className={styles.grid}>
          {visibleDesigns.map((d) => {
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
