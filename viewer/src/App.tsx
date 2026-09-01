import { Route, Routes } from "react-router-dom";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import { ViewerPage } from "./pages/ViewerPage.js";

export function App() {
  return (
    <Routes>
      <Route path="/v/:token" element={<ViewerPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
