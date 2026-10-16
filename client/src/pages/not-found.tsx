import { useLocation } from 'wouter';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@shared/constants';

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background">
      <Card className="mx-4 w-full max-w-md">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-3">
            <Compass className="h-8 w-8 flex-shrink-0 text-muted-foreground" aria-hidden />
            <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            That page doesn&apos;t exist or has moved. Your tasks are safe on the board.
          </p>
          <Button
            className="w-full"
            onClick={() => {
              navigate(ROUTES.DASHBOARD);
            }}
          >
            Back to the board
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
