import { Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage.js";
import { ViewerPage } from "./pages/ViewerPage.js";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/v/:token" element={<ViewerPage />} />
    </Routes>
  );
}
