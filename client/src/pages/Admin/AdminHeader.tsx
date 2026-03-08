/* eslint-disable @typescript-eslint/no-empty-object-type -- R2 baseline: strict fixes deferred to follow-up tasks */
import { Button } from '@/components/ui/button';
import { ChevronLeft, Settings } from 'lucide-react';

export interface AdminHeaderProps {
  onBack: () => void;
}

export function AdminHeader({ onBack }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-50 neo-container rounded-none px-4 py-3">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="rounded-lg h-10 w-10 shrink-0"
          data-testid="button-back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="h-10 w-10 neo-raised rounded-lg flex items-center justify-center">
            <Settings className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground leading-tight">
              Admin
            </h1>
            <p className="text-[10px] text-muted-foreground leading-tight">Manage Stages</p>
          </div>
        </div>
      </div>
    </header>
  );
}
