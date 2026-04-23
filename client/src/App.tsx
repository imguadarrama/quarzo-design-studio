import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminProductsPage } from "./pages/AdminProductsPage";
import { CatalogPage } from "./pages/CatalogPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";

function AppShell() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#fcfaf7_0%,_#f6f0e6_100%)] text-stone-900">
      <header className="sticky top-0 z-10 border-b border-white/60 bg-[#fcfaf7]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <NavLink to="/" className="font-serif text-2xl tracking-[0.08em] text-stone-900">
            Quarzo
          </NavLink>
          <nav className="flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-stone-600">
            <NavLink to="/" className="transition hover:text-stone-900">
              Catalogo
            </NavLink>
            <NavLink to="/admin/login" className="transition hover:text-stone-900">
              Admin
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/productos/:slug" element={<ProductDetailPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/productos" element={<AdminProductsPage />} />
          <Route
            path="*"
            element={
              <div className="rounded-[2.5rem] border border-stone-200 bg-white p-10 text-center shadow-[0_24px_80px_rgba(28,25,23,0.08)]">
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">404</p>
                <h1 className="mt-4 font-serif text-4xl text-stone-900">Pagina no encontrada</h1>
                <p className="mt-4 text-sm leading-7 text-stone-600">
                  Regresa al catalogo para seguir navegando por el estudio.
                </p>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
