import { Outlet } from "react-router-dom";
import { NavBarPublic } from "../components/NavBarPublic/NavBarPublic.js";
import styles from "./PublicLayout.module.scss";

export function PublicLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavBarPublic />
      </header>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
