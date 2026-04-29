import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import CircularLogo from "../../../../assets/circular-logo.png";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAdminAuthStore } from "../../../store/adminAuth.js";
import { Typography } from "../../../components/Typography/Typography.js";
import { Card } from "../../../components/Card/Card.js";
import { Button } from "../../../components/Button/Button.js";
import { FullPageSpinner } from "../../../components/FullPageSpinner/FullPageSpinner.js";
import { FormField } from "../../../components/FormField/FormField.js";
import { Input } from "../../../components/Input/Input.js";
import styles from "./AdminLoginPage.module.scss";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

type FormValues = z.infer<typeof schema>;

export function AdminLoginPage() {
  const status = useAdminAuthStore((s) => s.status);
  const hydrate = useAdminAuthStore((s) => s.hydrate);
  const login = useAdminAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "idle") {
      void hydrate();
    }
  }, [status, hydrate]);

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
        error instanceof Error ? error.message : "Ocurrió un error inesperado";
      setSubmitError(message);
    }
  });

  if (status === "idle" || status === "loading") {
    return <FullPageSpinner />;
  }

  if (status === "auth") {
    return <Navigate to="/admin/productos" replace />;
  }

  return (
    <Card>
      <img src={CircularLogo} alt="Quarzo" className={styles.logo} />
      <div className={styles.titleBlock}>
        <Typography as="h1" size="xl">Inicio de sesión admin</Typography>
        <Typography as="p">Ingresa con tus credenciales</Typography>
      </div>

      <form onSubmit={onSubmit} noValidate>
        <FormField label="Email" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="username"
            {...register("email")}
          />
        </FormField>

        <FormField label="Contraseña" error={errors.password?.message}>
          <Input
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
        </FormField>

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
