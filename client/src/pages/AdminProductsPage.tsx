import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createProduct,
  deleteProduct,
  fetchAdminProducts,
  fetchAdminSession,
  logoutAdmin,
  updateProduct,
} from "../services/api/admin";
import { formatCurrency } from "../lib/format";
import type { AdminUser, Product, ProductPayload } from "../lib/types";

type ProductFormState = ProductPayload;

const categoryOptions = ["sobres", "stickers", "etiquetas-vino", "tarjetas-regalo"];

const createEmptyProduct = (): ProductFormState => ({
  slug: "",
  name: "",
  description: "",
  category: categoryOptions[0] ?? "sobres",
  basePrice: 0,
  active: true,
  images: [{ url: "", alt: "" }],
  variants: [{ name: "", sku: "", priceDelta: 0, stock: 0 }],
});

const mapProductToForm = (product: Product): ProductFormState => ({
  slug: product.slug,
  name: product.name,
  description: product.description,
  category: product.category,
  basePrice: product.basePrice,
  active: product.active,
  images: product.images.map((image) => ({
    url: image.url,
    alt: image.alt ?? "",
  })),
  variants: product.variants.map((variant) => ({
    name: variant.name,
    sku: variant.sku,
    priceDelta: variant.priceDelta,
    stock: variant.stock,
  })),
});

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function AdminProductsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductFormState>(createEmptyProduct);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProducts() {
    const nextProducts = await fetchAdminProducts();
    setProducts(nextProducts);
  }

  useEffect(() => {
    void (async () => {
      try {
        const session = await fetchAdminSession();
        setAdmin(session);
        await loadProducts();
      } catch {
        navigate("/admin/login", {
          replace: true,
          state: { from: location.pathname },
        });
        return;
      } finally {
        setLoading(false);
      }
    })();
  }, [location.pathname, navigate]);

  const sortedProducts = useMemo(
    () => [...products].sort((left, right) => left.name.localeCompare(right.name, "es")),
    [products],
  );

  function resetForm() {
    setForm(createEmptyProduct());
    setEditingProductId(null);
    setError(null);
  }

  function updateImage(index: number, field: "url" | "alt", value: string) {
    setForm((current) => ({
      ...current,
      images: current.images.map((image, imageIndex) =>
        imageIndex === index ? { ...image, [field]: value } : image,
      ),
    }));
  }

  function updateVariant(
    index: number,
    field: "name" | "sku" | "priceDelta" | "stock",
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index
          ? {
              ...variant,
              [field]:
                field === "priceDelta" || field === "stock" ? Number(value) : value,
            }
          : variant,
      ),
    }));
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    try {
      const uploadedImages = await Promise.all(
        files.map(async (file) => ({
          url: await readFileAsDataUrl(file),
          alt: file.name.replace(/\.[^/.]+$/, ""),
        })),
      );

      setForm((current) => ({
        ...current,
        images: [...current.images.filter((image) => image.url.trim() !== ""), ...uploadedImages],
      }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No se pudieron cargar las imagenes");
    } finally {
      event.target.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload: ProductPayload = {
      ...form,
      slug: form.slug.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      images: form.images
        .map((image) => ({ url: image.url.trim(), alt: image.alt.trim() }))
        .filter((image) => image.url !== ""),
      variants: form.variants.map((variant) => ({
        name: variant.name.trim(),
        sku: variant.sku.trim(),
        priceDelta: Number(variant.priceDelta),
        stock: Number(variant.stock),
      })),
    };

    try {
      if (editingProductId) {
        await updateProduct(editingProductId, payload);
      } else {
        await createProduct(payload);
      }

      await loadProducts();
      resetForm();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo guardar el producto");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productId: string) {
    const confirmed = window.confirm("Se eliminara este producto. Deseas continuar?");

    if (!confirmed) {
      return;
    }

    try {
      await deleteProduct(productId);
      await loadProducts();

      if (editingProductId === productId) {
        resetForm();
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo eliminar el producto");
    }
  }

  async function handleLogout() {
    try {
      await logoutAdmin();
    } finally {
      navigate("/admin/login", { replace: true });
    }
  }

  if (loading) {
    return <div className="rounded-[2rem] border border-stone-200 bg-white p-10 text-stone-600">Cargando panel...</div>;
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 rounded-[2.5rem] bg-stone-900 px-6 py-8 text-stone-100 shadow-[0_24px_90px_rgba(28,25,23,0.16)] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-stone-400">Panel admin</p>
          <h1 className="mt-3 font-serif text-4xl">Catalogo y productos</h1>
          <p className="mt-3 text-sm text-stone-300">Sesion activa: {admin?.email ?? "admin"}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-stone-500 px-5 py-3 text-sm uppercase tracking-[0.2em] text-stone-100 transition hover:border-stone-100"
        >
          Cerrar sesion
        </button>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-stone-500">Productos</p>
              <h2 className="mt-2 font-serif text-3xl text-stone-900">Inventario visible</h2>
            </div>
            <p className="text-sm text-stone-500">{products.length} productos</p>
          </div>
          <div className="grid gap-4">
            {sortedProducts.map((product) => (
              <article
                key={product.id}
                className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-[0_18px_60px_rgba(28,25,23,0.06)]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-4">
                    <div className="h-24 w-24 overflow-hidden rounded-[1.5rem] bg-stone-100">
                      {product.images[0] ? (
                        <img
                          src={product.images[0].url}
                          alt={product.images[0].alt ?? product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-serif text-2xl text-stone-900">{product.name}</h3>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${
                            product.active ? "bg-emerald-100 text-emerald-700" : "bg-stone-200 text-stone-600"
                          }`}
                        >
                          {product.active ? "Activo" : "Oculto"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-stone-500">{product.slug}</p>
                      <p className="mt-3 text-sm leading-7 text-stone-600">{product.description}</p>
                      <p className="mt-3 text-sm text-stone-500">
                        Base {formatCurrency(product.basePrice)} | {product.variants.length} variantes
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setForm(mapProductToForm(product));
                        setEditingProductId(product.id);
                        setError(null);
                      }}
                      className="rounded-full border border-stone-300 px-4 py-2 text-xs uppercase tracking-[0.2em] text-stone-700 transition hover:border-stone-900"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(product.id)}
                      className="rounded-full border border-rose-200 px-4 py-2 text-xs uppercase tracking-[0.2em] text-rose-700 transition hover:bg-rose-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[2.5rem] border border-stone-200 bg-white p-6 shadow-[0_24px_80px_rgba(28,25,23,0.08)] sm:p-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-stone-500">Editor</p>
              <h2 className="mt-2 font-serif text-3xl text-stone-900">
                {editingProductId ? "Editar producto" : "Nuevo producto"}
              </h2>
            </div>
            {editingProductId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-stone-300 px-4 py-2 text-xs uppercase tracking-[0.2em] text-stone-700"
              >
                Nuevo
              </button>
            ) : null}
          </div>

          <form className="mt-8 space-y-8" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm uppercase tracking-[0.2em] text-stone-500">Nombre</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-3xl border border-stone-200 px-4 py-4 outline-none transition focus:border-stone-900"
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm uppercase tracking-[0.2em] text-stone-500">Slug</span>
                <input
                  value={form.slug}
                  onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                  className="w-full rounded-3xl border border-stone-200 px-4 py-4 outline-none transition focus:border-stone-900"
                  placeholder="sobres-clasicos"
                  required
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm uppercase tracking-[0.2em] text-stone-500">Descripcion</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="min-h-32 w-full rounded-3xl border border-stone-200 px-4 py-4 outline-none transition focus:border-stone-900"
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm uppercase tracking-[0.2em] text-stone-500">Categoria</span>
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  className="w-full rounded-3xl border border-stone-200 px-4 py-4 outline-none transition focus:border-stone-900"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm uppercase tracking-[0.2em] text-stone-500">Precio base</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.basePrice}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, basePrice: Number(event.target.value) }))
                  }
                  className="w-full rounded-3xl border border-stone-200 px-4 py-4 outline-none transition focus:border-stone-900"
                  required
                />
              </label>
              <label className="flex items-center gap-3 rounded-3xl border border-stone-200 px-4 py-4">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                />
                <span className="text-sm uppercase tracking-[0.2em] text-stone-600">Producto activo</span>
              </label>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Imagenes</p>
                  <p className="text-sm text-stone-500">Puedes subir archivos o pegar URLs externas.</p>
                </div>
                <label className="rounded-full border border-stone-300 px-4 py-2 text-xs uppercase tracking-[0.2em] text-stone-700">
                  Subir imagen
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => void handleImageUpload(event)}
                  />
                </label>
              </div>

              <div className="space-y-4">
                {form.images.map((image, index) => (
                  <div key={`${image.url}-${index}`} className="rounded-[1.75rem] border border-stone-200 p-4">
                    <div className="grid gap-4 sm:grid-cols-[100px_1fr]">
                      <div className="h-24 w-24 overflow-hidden rounded-[1.25rem] bg-stone-100">
                        {image.url ? (
                          <img src={image.url} alt={image.alt || "Vista previa"} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="space-y-3">
                        <input
                          value={image.url}
                          onChange={(event) => updateImage(index, "url", event.target.value)}
                          placeholder="https://... o data:image/..."
                          className="w-full rounded-3xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-900"
                        />
                        <div className="flex gap-3">
                          <input
                            value={image.alt}
                            onChange={(event) => updateImage(index, "alt", event.target.value)}
                            placeholder="Texto alternativo"
                            className="w-full rounded-3xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-900"
                          />
                          {form.images.length > 1 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setForm((current) => ({
                                  ...current,
                                  images: current.images.filter((_, imageIndex) => imageIndex !== index),
                                }))
                              }
                              className="rounded-full border border-rose-200 px-4 py-3 text-xs uppercase tracking-[0.2em] text-rose-700"
                            >
                              Quitar
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    images: [...current.images, { url: "", alt: "" }],
                  }))
                }
                className="rounded-full border border-stone-300 px-4 py-3 text-xs uppercase tracking-[0.2em] text-stone-700"
              >
                Agregar campo de imagen
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Variantes</p>
                  <p className="text-sm text-stone-500">Define impresion, material o tamano por producto.</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      variants: [...current.variants, { name: "", sku: "", priceDelta: 0, stock: 0 }],
                    }))
                  }
                  className="rounded-full border border-stone-300 px-4 py-2 text-xs uppercase tracking-[0.2em] text-stone-700"
                >
                  Agregar variante
                </button>
              </div>

              <div className="space-y-4">
                {form.variants.map((variant, index) => (
                  <div key={`${variant.sku}-${index}`} className="grid gap-3 rounded-[1.75rem] border border-stone-200 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={variant.name}
                        onChange={(event) => updateVariant(index, "name", event.target.value)}
                        placeholder="Nombre de variante"
                        className="rounded-3xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-900"
                        required
                      />
                      <input
                        value={variant.sku}
                        onChange={(event) => updateVariant(index, "sku", event.target.value)}
                        placeholder="SKU"
                        className="rounded-3xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-900"
                        required
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={variant.priceDelta}
                        onChange={(event) => updateVariant(index, "priceDelta", event.target.value)}
                        placeholder="Diferencia de precio"
                        className="rounded-3xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-900"
                      />
                      <input
                        type="number"
                        min={0}
                        value={variant.stock}
                        onChange={(event) => updateVariant(index, "stock", event.target.value)}
                        placeholder="Stock"
                        className="rounded-3xl border border-stone-200 px-4 py-3 outline-none transition focus:border-stone-900"
                      />
                      {form.variants.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              variants: current.variants.filter((_, variantIndex) => variantIndex !== index),
                            }))
                          }
                          className="rounded-full border border-rose-200 px-4 py-3 text-xs uppercase tracking-[0.2em] text-rose-700"
                        >
                          Quitar
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-full bg-stone-900 px-5 py-4 text-sm uppercase tracking-[0.25em] text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {saving ? "Guardando..." : editingProductId ? "Actualizar producto" : "Crear producto"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
