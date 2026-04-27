import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAdminAuthStore } from "../../store/adminAuth.js";
import styles from "./NavBarAdmin.module.scss";

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

  return (
    <nav className={styles.nav} aria-label="Panel de administracion">
      <Link to="/admin/productos" className={styles.brand}>
        Quarzo · Admin
      </Link>
      <div className={styles.right}>
        {admin ? <span className={styles.email}>{admin.email}</span> : null}
        <button
          type="button"
          className={styles.logout}
          onClick={handleLogout}
          disabled={busy}
        >
          Cerrar sesion
        </button>
      </div>
    </nav>
  );
}
