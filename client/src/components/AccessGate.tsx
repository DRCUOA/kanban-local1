import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { KeyRound, Loader2 } from 'lucide-react';
import { ROUTES } from '@shared/constants';
import type { AccessStatus } from '@shared/access';
import { ACCESS_REQUIRED_EVENT, apiGet, apiPost } from '@/lib/api';
import { AppLogo } from '@/components/AppLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const STATUS_KEY = ['/api/access/status'];

/**
 * Shows the access-code screen instead of the app until this browser has been
 * admitted (server/access). The developer console is outside the gate: it has
 * its own secret and needs no admitted browser.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => apiGet<AccessStatus>('/api/access/status'),
    staleTime: Infinity,
    retry: false,
  });

  // Any request refused for want of access (trust ran out, device revoked) brings the screen back.
  useEffect(() => {
    const onRequired = () => {
      queryClient.setQueryData<AccessStatus>(STATUS_KEY, { enabled: true, admitted: false });
    };
    window.addEventListener(ACCESS_REQUIRED_EVENT, onRequired);
    return () => {
      window.removeEventListener(ACCESS_REQUIRED_EVENT, onRequired);
    };
  }, [queryClient]);

  if (location.startsWith(ROUTES.CONSOLE)) return <>{children}</>;
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (status && status.enabled && !status.admitted) {
    return (
      <AccessCodeScreen
        onAdmitted={() => {
          queryClient.setQueryData<AccessStatus>(STATUS_KEY, { enabled: true, admitted: true });
          void queryClient.invalidateQueries();
        }}
      />
    );
  }
  return <>{children}</>;
}

function AccessCodeScreen({ onAdmitted }: { onAdmitted: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiPost<AccessStatus>('/api/access/admit', { code });
      onAdmitted();
    } catch (e) {
      const message =
        e instanceof Error ? e.message.replace(/^\d+:\s*/, '') : 'Something went wrong.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        className="w-full max-w-sm space-y-5 rounded-lg neo-raised p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        data-testid="access-code-screen"
      >
        <div className="flex items-center gap-3">
          <AppLogo className="h-8 w-8" />
          <div>
            <h1 className="text-lg font-bold">{import.meta.env.VITE_APP_NAME || 'Kanbando'}</h1>
            <p className="text-xs text-muted-foreground">This browser needs an access code.</p>
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="access-code" className="flex items-center gap-1.5 text-sm font-medium">
            <KeyRound className="h-4 w-4" aria-hidden />
            Access code
          </label>
          <Input
            id="access-code"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="KB-XXXX-XXXX-XXXX"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
            }}
            className="h-12 font-mono tracking-wider"
            aria-invalid={error !== null}
            aria-describedby={error ? 'access-code-error' : undefined}
            data-testid="input-access-code"
          />
          {error && (
            <p id="access-code-error" role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" className="h-12 w-full" disabled={busy || code.trim() === ''}>
          {busy ? 'Checking…' : 'Continue'}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Each code works in one browser, which then stays signed in for 90 days. Ask the owner of
          this board for a code.
        </p>
      </form>
    </main>
  );
}
