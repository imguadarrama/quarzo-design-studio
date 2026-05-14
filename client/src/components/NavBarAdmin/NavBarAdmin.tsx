import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAdminAuthStore } from "@/store/adminAuth";
import CircularLogo from "@/assets/circular-logo.png";
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

  return (
    <nav className={styles.nav} aria-label="Panel de administración">
      <Link to="/admin/productos" className={styles.brand}>
        <img src={CircularLogo} className={styles.logo} alt="" loading="lazy" />
        <Typography
          as="span"
          size="md"
          weight="medium"
          className={styles.wordmark}
        >
          Admin
        </Typography>
      </Link>
      <div className={styles.links}>
        <NavLink to="/admin/categorias" className={navLinkClass}>
          Categorías
        </NavLink>
        <NavLink to="/admin/paletas" className={navLinkClass}>
          Paletas
        </NavLink>
        <NavLink to="/admin/disenos" className={navLinkClass}>
          Diseños
        </NavLink>
        <NavLink to="/admin/productos" className={navLinkClass}>
          Productos
        </NavLink>
      </div>
      <div className={styles.right}>
        {admin ? (
          <Typography as="span" size="xs" className={styles.email}>
            {admin.email}
          </Typography>
        ) : null}
        <Button type="button" size="sm" onClick={handleLogout} disabled={busy}>
          Cerrar sesión
        </Button>
      </div>
    </nav>
  );
}
