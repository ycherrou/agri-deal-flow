import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ClientPortfolio from "./pages/ClientPortfolio";
import Auth from "./pages/Auth";
import Navires from "./pages/Navires";
import Deals from "./pages/Deals";
import CreateDeal from "./pages/CreateDeal";
import EditDeal from "./pages/EditDeal";
import RollDeal from "./pages/RollDeal";
import RollNavire from "./pages/RollNavire";
import Couvertures from "./pages/Couvertures";
import Clients from "./pages/Clients";
import Settings from "./pages/Settings";
import PrixMarche from "./pages/PrixMarche";
import PnL from "./pages/PnL";
import MarcheSecondaire from "./pages/MarcheSecondaire";
import TransactionsSecondaires from "./pages/TransactionsSecondaires";
import FuturesAdmin from "./pages/FuturesAdmin";
import AdminReventes from "./pages/AdminReventes";
import MesVentes from "./pages/MesVentes";
import WhatsAppNotifications from "./pages/WhatsAppNotifications";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Layout><Dashboard /></Layout>} />
          <Route path="/portfolio" element={<Layout><ClientPortfolio /></Layout>} />
          <Route path="/navires" element={<Layout><Navires /></Layout>} />
          <Route path="/deals" element={<Layout><Deals /></Layout>} />
          <Route path="/deals/create" element={<Layout><CreateDeal /></Layout>} />
          <Route path="/deals/edit/:id" element={<Layout><EditDeal /></Layout>} />
          <Route path="/deals/roll/:id" element={<Layout><RollDeal /></Layout>} />
          <Route path="/navires/roll/:id" element={<Layout><RollNavire /></Layout>} />
          <Route path="/couvertures" element={<Layout><Couvertures /></Layout>} />
          <Route path="/clients" element={<Layout><Clients /></Layout>} />
          <Route path="/settings" element={<Layout><Settings /></Layout>} />
          <Route path="/prix-marche" element={<Layout><PrixMarche /></Layout>} />
            <Route path="/pnl" element={<Layout><PnL /></Layout>} />
            <Route path="/marche-secondaire" element={<Layout><MarcheSecondaire /></Layout>} />
            <Route path="/mes-ventes" element={<Layout><MesVentes /></Layout>} />
            <Route path="/admin-reventes" element={<Layout><AdminReventes /></Layout>} />
            <Route path="/transactions-secondaires" element={<Layout><TransactionsSecondaires /></Layout>} />
            <Route path="/futures-admin" element={<Layout><FuturesAdmin /></Layout>} />
            <Route path="/whatsapp-notifications" element={<Layout><WhatsAppNotifications /></Layout>} />
            <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
