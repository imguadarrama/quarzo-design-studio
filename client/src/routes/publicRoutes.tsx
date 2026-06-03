import { Navigate, Route } from "react-router-dom";
import { PublicLayout } from "../layouts/PublicLayout.js";
import { CartPage } from "../pages/CartPage/CartPage.js";
import { CatalogPage } from "../pages/CatalogPage/CatalogPage.js";
import { ProductDetailPage } from "../pages/ProductDetailPage/ProductDetailPage.js";

export const publicRoutes = (
  <>
    <Route element={<PublicLayout />}>
      <Route path="/" element={<Navigate to="/catalogo" replace />} />
      <Route path="/catalogo" element={<CatalogPage />} />
      <Route path="/producto/:slug" element={<ProductDetailPage />} />
      <Route path="/carrito" element={<CartPage />} />
    </Route>
  </>
);
