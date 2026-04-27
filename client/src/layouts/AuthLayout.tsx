import { Outlet } from "react-router-dom";
import styles from "./AuthLayout.module.scss";

export function AuthLayout() {
  return (
    <div className={styles.shell}>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
