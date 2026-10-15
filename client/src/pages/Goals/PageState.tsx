import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PageLoading({ label }: { label: string }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex animate-pulse flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function PageMessage({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background px-6">
      <div className="w-full space-y-4 text-center">
        <div className="text-lg font-bold">{title}</div>
        {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
        <Button onClick={onAction}>{actionLabel}</Button>
      </div>
    </div>
  );
}
