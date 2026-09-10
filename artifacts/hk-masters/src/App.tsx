import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
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
import TravelOverview from "@/pages/TravelOverview";
import Sponsors from "@/pages/Sponsors";
import Schedule from "@/pages/Schedule";
import Events from "@/pages/Events";
import Announcements from "@/pages/Announcements";
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
import WebsiteContent from "@/pages/WebsiteContent";
import NotFound from "@/pages/not-found";
import { AdminAuthGate } from "@/components/AdminAuthGate";

import ArchiveLanding from "@/pages/archive/ArchiveLanding";
import ArchiveLayout from "@/pages/archive/ArchiveLayout";

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
      {/* Current Operations */}
      <Route path="/" component={Dashboard} />
      <Route path="/teams">{() => <Teams />}</Route>
      <Route path="/players">{() => <Players />}</Route>
      <Route path="/fees">{() => <Fees />}</Route>
      <Route path="/matches">{() => <Schedule />}</Route>
      <Route path="/schedule">{() => <Redirect to="/matches" />}</Route>
      <Route path="/events">{() => <Events />}</Route>
      <Route path="/announcements">{() => <Announcements />}</Route>
      <Route path="/email-history">{() => <EmailHistory />}</Route>
      <Route path="/polls">{() => <Polls />}</Route>
      <Route path="/news">{() => <NewsAdmin />}</Route>
      <Route path="/website" component={WebsiteContent} />
      <Route path="/tutorials" component={Tutorials} />

      {/* Legacy World Cup URLs mapped to Archive */}
      <Route path="/kits">{() => <Redirect to="/archive/world-cup-2026/kits" />}</Route>
      <Route path="/fundraising">{() => <Redirect to="/archive/world-cup-2026/fundraising" />}</Route>
      <Route path="/fundraising/search">{() => <Redirect to="/archive/world-cup-2026/fundraising/search" />}</Route>
      <Route path="/fun-run">{() => <Redirect to="/archive/world-cup-2026/fundraising/fun-run" />}</Route>
      <Route path="/lego-jar">{() => <Redirect to="/archive/world-cup-2026/fundraising/lego-jar" />}</Route>
      <Route path="/auction">{() => <Redirect to="/archive/world-cup-2026/fundraising/auction" />}</Route>
      <Route path="/sponsors">{() => <Redirect to="/archive/world-cup-2026/fundraising/sponsors" />}</Route>
      <Route path="/payouts">{() => <Redirect to="/archive/world-cup-2026/fundraising/payouts" />}</Route>
      <Route path="/logistics">{() => <Redirect to="/archive/world-cup-2026/logistics" />}</Route>
      <Route path="/travel">{() => <Redirect to="/archive/world-cup-2026/travel" />}</Route>
      <Route path="/arrivals">{() => <Redirect to="/archive/world-cup-2026/transfers" />}</Route>
      <Route path="/journal">{() => <Redirect to="/archive/world-cup-2026/journal" />}</Route>
      <Route path="/documents">{() => <Redirect to="/archive/world-cup-2026/documents" />}</Route>
      <Route path="/reports">{() => <Redirect to="/archive/world-cup-2026/reports" />}</Route>
      <Route path="/readiness">{() => <Redirect to="/archive/world-cup-2026/readiness" />}</Route>

      {/* World Cup 2026 Archive */}
      <Route path="/archive/world-cup-2026" component={ArchiveLanding} />
      <Route path="/archive/world-cup-2026/*">
        <ArchiveLayout>
          <Switch>
            <Route path="/archive/world-cup-2026/kits">{() => <Kits scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/fundraising">{() => <Fundraising scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/fundraising/search">{() => <FundraisingSearch scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/fundraising/fun-run">{() => <FunRun scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/fundraising/lego-jar">{() => <LegoJar scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/fundraising/auction">{() => <Auction scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/fundraising/sponsors">{() => <Sponsors scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/fundraising/payouts">{() => <Payouts scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/logistics">{() => <Logistics scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/travel">{() => <Travel scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/transfers">{() => <TravelOverview scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/journal">{() => <Journal scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/documents">{() => <Documents scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/matches">{() => <Schedule scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/events">{() => <Events scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/reports">{() => <Reports scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/readiness">{() => <Readiness scope="world_cup_2026" readOnly />}</Route>

            {/* Reusable components with scope and readOnly flags */}
            <Route path="/archive/world-cup-2026/teams">{() => <Teams scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/fees">{() => <Fees scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/announcements">{() => <Announcements scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/news">{() => <NewsAdmin scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/polls">{() => <Polls scope="world_cup_2026" readOnly />}</Route>
            <Route path="/archive/world-cup-2026/email-history">{() => <EmailHistory scope="world_cup_2026" readOnly />}</Route>

            <Route component={NotFound} />
          </Switch>
        </ArchiveLayout>
      </Route>

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