import { Switch, Route } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProjectScopeProvider } from '@/hooks/use-project-scope';
import { ROUTES } from '@shared/constants';
import Dashboard from '@/pages/Dashboard';
import Admin from '@/pages/Admin';
import Archive from '@/pages/Archive';
import Filing from '@/pages/Filing';
import Bin from '@/pages/Bin';
import NotFound from '@/pages/not-found';

function Router() {
  return (
    <Switch>
      <Route path={ROUTES.DASHBOARD} component={Dashboard} />
      <Route path={ROUTES.ADMIN} component={Admin} />
      <Route path={ROUTES.ARCHIVE} component={Archive} />
      <Route path={ROUTES.FILING} component={Filing} />
      <Route path={ROUTES.BIN} component={Bin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <TooltipProvider>
          <Toaster />
          {/* Every page reads the project scope: the board and Filing/Archive
              honour it, Admin manages the projects it points at. */}
          <ProjectScopeProvider>
            <Router />
          </ProjectScopeProvider>
        </TooltipProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
