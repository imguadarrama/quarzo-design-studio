import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "./layouts/PublicLayout.js";
import { AuthLayout } from "./layouts/AuthLayout.js";
import { AdminLayout } from "./layouts/AdminLayout.js";
import { AdminLoginPage } from "./pages/admin/AdminLoginPage/AdminLoginPage.js";
import { AdminProductsPage } from "./pages/admin/AdminProductsPage/AdminProductsPage.js";
import { NotFoundPage } from "./pages/NotFoundPage/NotFoundPage.js";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/catalogo" element={<h1>hello</h1>}/>{/* Phase 3+: /, /catalogo, /producto/:slug, /carrito, /checkout */}
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="/admin/login" element={<AdminLoginPage />} />
        </Route>

        <Route element={<AdminLayout />}>
          <Route path="/admin/productos" element={<AdminProductsPage />} />
        </Route>

        <Route path="/admin" element={<Navigate to="/admin/productos" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
