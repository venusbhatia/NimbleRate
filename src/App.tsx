import { DashboardLayout } from "./components/layout/DashboardLayout";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { LandingPage } from "./pages/LandingPage";
import { useRoute } from "./router";

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
