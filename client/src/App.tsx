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
import ProjectView from '@/pages/Goals/ProjectView';
import GoalView from '@/pages/Goals/GoalView';
import DeveloperConsole from '@/pages/Console';
import { AccessGate } from '@/components/AccessGate';
import NotFound from '@/pages/not-found';

function Router() {
  return (
    <Switch>
      <Route path={ROUTES.DASHBOARD} component={Dashboard} />
      <Route path={ROUTES.ADMIN} component={Admin} />
      <Route path={ROUTES.ARCHIVE} component={Archive} />
      <Route path={ROUTES.FILING} component={Filing} />
      <Route path={ROUTES.BIN} component={Bin} />
      <Route path={ROUTES.PROJECT_VIEW} component={ProjectView} />
      <Route path={ROUTES.GOAL_VIEW} component={GoalView} />
      <Route path={ROUTES.CONSOLE} component={DeveloperConsole} />
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
          {/* Nothing below is fetched until this browser is admitted. */}
          <AccessGate>
            <ProjectScopeProvider>
              <Router />
            </ProjectScopeProvider>
          </AccessGate>
        </TooltipProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
