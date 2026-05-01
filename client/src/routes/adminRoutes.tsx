import { Navigate, Route } from "react-router-dom";
import { AdminLayout } from "../layouts/AdminLayout.js";
import { AuthLayout } from "../layouts/AuthLayout.js";
import { AdminLoginPage } from "../pages/admin/AdminLoginPage/AdminLoginPage.js";
import { AdminProductFormPage } from "../pages/admin/AdminProductForm/AdminProductFormPage.js";
import { AdminProductsPage } from "../pages/admin/AdminProductsPage/AdminProductsPage.js";

export const adminRoutes = (
  <>
    <Route element={<AuthLayout />}>
      <Route path="/admin/login" element={<AdminLoginPage />} />
    </Route>

    <Route element={<AdminLayout />}>
      <Route path="/admin/productos" element={<AdminProductsPage />} />
      <Route
        path="/admin/productos/nuevo"
        element={<AdminProductFormPage />}
      />
      <Route
        path="/admin/productos/:id/editar"
        element={<AdminProductFormPage />}
      />
    </Route>

    <Route
      path="/admin"
      element={<Navigate to="/admin/productos" replace />}
    />
  </>
);
