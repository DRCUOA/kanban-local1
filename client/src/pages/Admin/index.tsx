/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars, @typescript-eslint/no-confusing-void-expression -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useLocation } from 'wouter';
import { ROUTES } from '@shared/constants';
import { useStages, useSubStages } from '@/hooks/use-stages';
import { AdminHeader } from './AdminHeader';
import { StageSection } from './StageSection';
import { SubStageSection } from './SubStageSection';

export interface AdminProps {}

export default function Admin(_props: AdminProps) {
  const [, navigate] = useLocation();
  const { data: stages = [], isLoading } = useStages();
  const { data: subStages = [] } = useSubStages();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AdminHeader
        onBack={() => {
          navigate(ROUTES.DASHBOARD);
        }}
      />

      <div className="flex-1 overflow-y-auto scroll-container px-3 py-4 space-y-4">
        <StageSection stages={stages} isLoading={isLoading} />
        <SubStageSection stages={stages} subStages={subStages} />
      </div>
    </div>
  );
}
