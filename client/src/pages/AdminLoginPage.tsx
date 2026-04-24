import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginAdmin } from "../services/api/admin";

type NavigationState = {
  from?: string;
};

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const nextPath = (location.state as NavigationState | null)?.from ?? "/admin/productos";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await loginAdmin(email, password);
      navigate(nextPath, { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo iniciar sesion");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-[2.5rem] border border-stone-200 bg-white p-8 shadow-[0_24px_80px_rgba(28,25,23,0.08)]">
      <p className="text-xs uppercase tracking-[0.35em] text-amber-700">Admin</p>
      <h1 className="mt-4 font-serif text-5xl text-stone-900">Inicia sesion</h1>
      <p className="mt-4 text-sm leading-7 text-stone-600">
        Entra al panel para administrar catalogo, variantes e imagenes del estudio.
      </p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="admin-email" className="text-sm uppercase tracking-[0.2em] text-stone-500">
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-3xl border border-stone-200 px-4 py-4 outline-none transition focus:border-stone-900"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="admin-password" className="text-sm uppercase tracking-[0.2em] text-stone-500">
            Contrasena
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full rounded-3xl border border-stone-200 px-4 py-4 outline-none transition focus:border-stone-900"
          />
        </div>
        {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-stone-900 px-5 py-4 text-sm uppercase tracking-[0.25em] text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <Link to="/" className="mt-6 inline-flex text-sm uppercase tracking-[0.2em] text-stone-500">
        Volver al catalogo
      </Link>
    </div>
  );
}
