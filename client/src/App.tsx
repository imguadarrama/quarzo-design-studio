import { BrowserRouter, Route, Routes } from "react-router-dom";
import { NotFoundPage } from "./pages/NotFoundPage/NotFoundPage.js";
import { adminRoutes } from "./routes/adminRoutes.js";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {adminRoutes}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
