import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import QueryPage from "./pages/QueryPage";
import FrequencyPage from "./pages/FrequencyPage";
import TextsPage from "./pages/TextsPage";
import DatasetsPage from "./pages/DatasetsPage";
import SubcorporaPage from "./pages/SubcorporaPage";
import LemmaIndexPage from "./pages/LemmaIndexPage";
import PosIndexPage from "./pages/PosIndexPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/query" element={<QueryPage />} />
          <Route path="/frequency" element={<FrequencyPage />} />
          <Route path="/texts" element={<TextsPage />} />
          <Route path="/datasets" element={<DatasetsPage />} />
          <Route path="/subcorpora" element={<SubcorporaPage />} />
          <Route path="/lemma-index" element={<LemmaIndexPage />} />
          <Route path="/pos-index" element={<PosIndexPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
