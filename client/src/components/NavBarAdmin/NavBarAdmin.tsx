import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAdminAuthStore } from "@/store/adminAuth";
import { NavBar } from "../NavBar/NavBar";
import styles from "./NavBarAdmin.module.scss";
import { Button } from "../Button/Button.js";
import { Typography } from "../Typography/Typography.js";

export function NavBarAdmin() {
  const admin = useAdminAuthStore((s) => s.admin);
  const logout = useAdminAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
      navigate("/admin/login", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;

  const links = [
    { to: "/admin/categorias", label: "Categorías" },
    { to: "/admin/paletas", label: "Paletas" },
    { to: "/admin/disenos", label: "Diseños" },
    { to: "/admin/productos", label: "Productos" },
  ];

  return (
    <NavBar
      ariaLabel="Panel de administración"
      brandTo="/admin/productos"
      wordmark="Admin"
      right={
        <>
          {admin ? (
            <Typography as="span" size="xs" className={styles.email}>
              {admin.email}
            </Typography>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={handleLogout}
            disabled={busy}
          >
            Cerrar sesión
          </Button>
        </>
      }
    >
      <div className={styles.links}>
        {links.map(({ to, label }) => (
          <NavLink key={to} to={to} className={navLinkClass}>
            {label}
          </NavLink>
        ))}
      </div>
    </NavBar>
  );
}
