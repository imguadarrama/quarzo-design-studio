import { useState } from "react";
import { NavLink } from "react-router-dom";
import { NavBar } from "../NavBar/NavBar";
import { useCartItemCount } from "@/store/cart";
import styles from "./NavBarPublic.module.scss";

const links = [
  { to: "/catalogo", label: "Catálogo" },
  { to: "/carrito", label: "Carrito" },
  { to: "/mi-cuenta", label: "Mi cuenta" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.link} ${styles.linkActive}` : styles.link;

const drawerLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.drawerLink} ${styles.linkActive}` : styles.drawerLink;

export function NavBarPublic() {
  const cartCount = useCartItemCount();
  const [open, setOpen] = useState(false);

  const cartBadge = (to: string) =>
    to === "/carrito" && cartCount > 0 ? (
      <span className={styles.cartCount}>{cartCount}</span>
    ) : null;

  return (
    <NavBar
      ariaLabel="Navegación principal"
      brandTo="/"
      wordmark="Quarzo Design Store"
      right={
        <button
          type="button"
          className={styles.toggle}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true">{open ? "✕" : "☰"}</span>
        </button>
      }
    >
      <ul className={styles.links}>
        {links.map(({ to, label }) => (
          <li key={to}>
            <NavLink to={to} className={navLinkClass}>
              {label}
              {cartBadge(to)}
            </NavLink>
          </li>
        ))}
      </ul>

      {open ? (
        <ul className={styles.drawer}>
          {links.map(({ to, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={drawerLinkClass}
                onClick={() => setOpen(false)}
              >
                {label}
                {cartBadge(to)}
              </NavLink>
            </li>
          ))}
        </ul>
      ) : null}
    </NavBar>
  );
}
