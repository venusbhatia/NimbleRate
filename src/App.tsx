import { DashboardLayout } from "./components/layout/DashboardLayout";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { SearchPanel } from "./features/search/SearchPanel";
import { DashboardPage } from "./pages/DashboardPage";

function App() {
  return (
    <DashboardLayout sidebar={<Sidebar />} header={<Header />}>
      <SearchPanel />
      <DashboardPage />
    </DashboardLayout>
  );
}

export default App;
