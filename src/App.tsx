import { DashboardLayout } from "./components/layout/DashboardLayout";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { useRoute } from "./hooks/useRoute";
import { DashboardPage } from "./pages/DashboardPage";
import { LandingPage } from "./pages/LandingPage";

function App() {
  const { route } = useRoute();

  if (route === "dashboard") {
    return (
      <DashboardLayout sidebar={<Sidebar />} header={<Header />}>
        <DashboardPage />
      </DashboardLayout>
    );
  }

  return <LandingPage />;
}

export default App;
