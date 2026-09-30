/* eslint-disable @typescript-eslint/no-empty-object-type -- R2 baseline: strict fixes deferred to follow-up tasks */
import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ThemeToggle } from '@/components/ThemeToggle';

export interface AdminHeaderProps {
  onBack: () => void;
}

export function AdminHeader({ onBack }: AdminHeaderProps) {
  return (
    <PageHeader
      title="Admin"
      subtitle="Manage Projects & Stages"
      icon={<Settings className="h-5 w-5 text-primary" />}
      onBack={onBack}
      backTestId="button-back"
      actions={
        // The theme also lives in the board's More menu, which is where a
        // phone changes it; the bar stays clear here.
        <div className="hidden lg:block">
          <ThemeToggle />
        </div>
      }
    />
  );
}
