import { useState } from "react";
import { useForm } from "react-hook-form";
import CircularLogo from "../../../../assets/circular-logo.png"
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAdminAuthStore } from "../../../store/adminAuth.js";
import { Typography } from "../../../components/Typography/Typography.js";
import { Card } from "../../../components/Card/Card.js";
import { Button } from "../../../components/Button/Button.js";
import styles from "./AdminLoginPage.module.scss";

const schema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
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
    <Card>
      <img src={CircularLogo} alt="Quarzo" className={styles.logo} />
      <div style={{display: 'flex', flexDirection:'column', alignItems:'center'}}>
      <Typography as="h1" size="xl">Inicio de sesión admin</Typography>
      <Typography as="p">Ingresa con tus credenciales</Typography>
      </div>

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
          <p className={styles.fieldError} aria-live="polite">
            {errors.email?.message}
          </p>
        </div>

        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={styles.input}
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
          <p className={styles.fieldError} aria-live="polite">
            {errors.password?.message}
          </p>
        </div>

        {submitError ? (
          <div role="alert" className={styles.formError}>
            {submitError}
          </div>
        ) : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </Card>
  );
}
