import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Dashboard from "@/pages/Dashboard";
import Teams from "@/pages/Teams";
import Players from "@/pages/Players";
import Kits from "@/pages/Kits";
import Fundraising from "@/pages/Fundraising";
import Fees from "@/pages/Fees";
import Logistics from "@/pages/Logistics";
import Journal from "@/pages/Journal";
import Travel from "@/pages/Travel";
import Sponsors from "@/pages/Sponsors";
import Schedule from "@/pages/Schedule";
import Events from "@/pages/Events";
import { Redirect } from "wouter";
import Readiness from "@/pages/Readiness";
import NotFound from "@/pages/not-found";
import { AdminAuthGate } from "@/components/AdminAuthGate";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/teams" component={Teams} />
      <Route path="/players" component={Players} />
      <Route path="/kits" component={Kits} />
      <Route path="/fundraising" component={Fundraising} />
      <Route path="/fees" component={Fees} />
      <Route path="/logistics" component={Logistics} />
      <Route path="/travel" component={Travel} />
      <Route path="/journal" component={Journal} />
      <Route path="/sponsors" component={Sponsors} />
      <Route path="/matches" component={Schedule} />
      <Route path="/schedule">{() => <Redirect to="/matches" />}</Route>
      <Route path="/events" component={Events} />
      <Route path="/readiness" component={Readiness} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AdminAuthGate>
            <Router />
          </AdminAuthGate>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
