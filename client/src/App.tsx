import { BrowserRouter, Route, Routes } from "react-router-dom";
import { NotFoundPage } from "./pages/NotFoundPage/NotFoundPage.js";
import { adminRoutes } from "./routes/adminRoutes.js";
import { publicRoutes } from "./routes/publicRoutes.js";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {publicRoutes}
        {adminRoutes}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
