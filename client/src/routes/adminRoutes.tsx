import { Navigate, Route } from "react-router-dom";
import { AdminLayout } from "../layouts/AdminLayout.js";
import { AuthLayout } from "../layouts/AuthLayout.js";
import { AdminDesignFormPage } from "../pages/admin/AdminDesignForm/AdminDesignFormPage.js";
import { AdminDesignsPage } from "../pages/admin/AdminDesignsPage/AdminDesignsPage.js";
import { AdminLoginPage } from "../pages/admin/AdminLoginPage/AdminLoginPage.js";
import { AdminPaletteFormPage } from "../pages/admin/AdminPaletteForm/AdminPaletteFormPage.js";
import { AdminPalettesPage } from "../pages/admin/AdminPalettesPage/AdminPalettesPage.js";
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
      <Route path="/admin/paletas" element={<AdminPalettesPage />} />
      <Route path="/admin/paletas/nuevo" element={<AdminPaletteFormPage />} />
      <Route
        path="/admin/paletas/:id/editar"
        element={<AdminPaletteFormPage />}
      />
      <Route path="/admin/disenos" element={<AdminDesignsPage />} />
      <Route path="/admin/disenos/nuevo" element={<AdminDesignFormPage />} />
      <Route
        path="/admin/disenos/:id/editar"
        element={<AdminDesignFormPage />}
      />
    </Route>

    <Route
      path="/admin"
      element={<Navigate to="/admin/productos" replace />}
    />
  </>
);
