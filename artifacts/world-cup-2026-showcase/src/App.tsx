import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { Shell } from '@/components/layout/shell';
import { AuthGate } from '@/components/auth-gate';
import OverviewPage from '@/pages/overview';
import PlayerPortalPage from '@/pages/player-portal';
import TravelPage from '@/pages/travel';
import AdminPage from '@/pages/admin';
import SchedulePage from '@/pages/schedule';

const queryClient = new QueryClient();

function Router() {
  return (
    <RoutedErrorBoundary>
      <AuthGate>
        <Shell>
          <Switch>
            <Route path="/" component={OverviewPage} />
            <Route path="/player-portal" component={PlayerPortalPage} />
            <Route path="/admin" component={AdminPage} />
            <Route path="/travel" component={TravelPage} />
            <Route path="/schedule" component={SchedulePage} />
            <Route component={NotFound} />
          </Switch>
        </Shell>
      </AuthGate>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
