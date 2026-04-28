import { Link } from "react-router-dom";
import styles from "./NavBarPublic.module.scss";

export function NavBarPublic() {
  return (
    <nav className={styles.nav} aria-label="Navegación principal">
      <Link to="/" className={styles.brand}>
        Quarzo
      </Link>
      <ul className={styles.links}>
        <li>
          <Link to="/catalogo">Catálogo</Link>
        </li>
        <li>
          <Link to="/carrito">Carrito</Link>
        </li>
        <li>
          <Link to="/mi-cuenta">Mi cuenta</Link>
        </li>
      </ul>
    </nav>
  );
}
