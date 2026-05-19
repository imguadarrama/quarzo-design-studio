import { NavLink } from "react-router-dom";
import { NavBar } from "../NavBar/NavBar";
import styles from "./NavBarPublic.module.scss";

const links = [
  { to: "/catalogo", label: "Catálogo" },
  { to: "/carrito", label: "Carrito" },
  { to: "/mi-cuenta", label: "Mi cuenta" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.link} ${styles.linkActive}` : styles.link;

export function NavBarPublic() {
  return (
    <NavBar
      ariaLabel="Navegación principal"
      brandTo="/"
      wordmark="Quarzo Design Store"
    >
      <ul className={styles.links}>
        {links.map(({ to, label }) => (
          <li key={to}>
            <NavLink to={to} className={navLinkClass}>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </NavBar>
  );
}
