import { Outlet } from "react-router-dom";
import { NavBarAdmin } from "../components/NavBarAdmin/NavBarAdmin.js";
import { RequireAdmin } from "../components/RequireAdmin.js";
import styles from "./AdminLayout.module.scss";

export function AdminLayout() {
  return (
    <RequireAdmin>
      <div className={styles.shell}>
        <header className={styles.header}>
          <NavBarAdmin />
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </RequireAdmin>
  );
}
