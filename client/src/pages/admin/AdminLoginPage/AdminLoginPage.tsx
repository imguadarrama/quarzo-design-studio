import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAdminAuthStore } from "../../../store/adminAuth.js";
import styles from "./AdminLoginPage.module.scss";

const schema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(1, "Ingresa tu contrasena"),
});

type FormValues = z.infer<typeof schema>;

export function AdminLoginPage() {
  const login = useAdminAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values.email, values.password);
      navigate("/admin/productos", { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ocurrio un error inesperado";
      setSubmitError(message);
    }
  });

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Quarzo · Admin</h1>
      <p className={styles.subtitle}>Ingresa con tus credenciales</p>

      <form onSubmit={onSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            className={styles.input}
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
          {errors.email ? (
            <p className={styles.fieldError}>{errors.email.message}</p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>
            Contrasena
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={styles.input}
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
          {errors.password ? (
            <p className={styles.fieldError}>{errors.password.message}</p>
          ) : null}
        </div>

        {submitError ? (
          <div role="alert" className={styles.formError}>
            {submitError}
          </div>
        ) : null}

        <button
          type="submit"
          className={styles.submit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
