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
import Announcements from "@/pages/Announcements";
import { Redirect } from "wouter";
import Readiness from "@/pages/Readiness";
import EmailHistory from "@/pages/EmailHistory";
import Documents from "@/pages/Documents";
import Auction from "@/pages/Auction";
import LegoJar from "@/pages/LegoJar";
import FunRun from "@/pages/FunRun";
import Polls from "@/pages/Polls";
import Tutorials from "@/pages/Tutorials";
import Reports from "@/pages/Reports";
import Payouts from "@/pages/Payouts";
import FundraisingSearch from "@/pages/FundraisingSearch";
import NewsAdmin from "@/pages/NewsAdmin";
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
      <Route path="/announcements" component={Announcements} />
      <Route path="/email-history" component={EmailHistory} />
      <Route path="/readiness" component={Readiness} />
      <Route path="/documents" component={Documents} />
      <Route path="/auction" component={Auction} />
      <Route path="/lego-jar" component={LegoJar} />
      <Route path="/fun-run" component={FunRun} />
      <Route path="/polls" component={Polls} />
      <Route path="/tutorials" component={Tutorials} />
      <Route path="/reports" component={Reports} />
      <Route path="/payouts" component={Payouts} />
      <Route path="/fundraising/search" component={FundraisingSearch} />
      <Route path="/news" component={NewsAdmin} />
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
