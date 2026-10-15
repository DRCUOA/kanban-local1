import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Copy, KeyRound, LogOut, Terminal } from 'lucide-react';
import { DEVELOPER_SECRET_HEADER, type ConsoleDevice } from '@shared/access';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

/**
 * The developer console (after stageboard-pilot's): issue an access code per
 * device, issue a read-only export token for the briefing agent, list and
 * revoke them. The page itself holds nothing; every request carries the
 * developer secret, which is kept in this tab's session storage only and
 * dropped with the tab. A wrong secret gets the same answer as a page that
 * does not exist.
 */
const SECRET_KEY = 'kanban-console-secret';

const recall = (): string | null => {
  try {
    return window.sessionStorage.getItem(SECRET_KEY);
  } catch {
    return null;
  }
};
const remember = (secret: string | null) => {
  try {
    if (secret) window.sessionStorage.setItem(SECRET_KEY, secret);
    else window.sessionStorage.removeItem(SECRET_KEY);
  } catch {
    // Held in memory by the page only.
  }
};

async function consoleFetch<T>(secret: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/console/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      [DEVELOPER_SECRET_HEADER]: secret,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw Object.assign(new Error(json.error ?? res.statusText), { status: res.status });
  return json as T;
}

const when = (iso: string | null) => (iso ? format(new Date(iso), 'd MMM yyyy, HH:mm') : '—');

export default function DeveloperConsole() {
  const { toast } = useToast();
  const [secret, setSecret] = useState<string | null>(recall);
  const [typed, setTyped] = useState('');
  const [devices, setDevices] = useState<ConsoleDevice[] | null>(null);
  const [label, setLabel] = useState('');
  const [issued, setIssued] = useState<{
    kind: 'code' | 'token';
    label: string;
    value: string;
  } | null>(null);

  const load = useCallback(
    async (s: string) => {
      try {
        const out = await consoleFetch<{ devices: ConsoleDevice[] }>(s, '/devices');
        setDevices(out.devices);
        remember(s);
        setSecret(s);
      } catch {
        // Wrong secret and closed console look the same as no console.
        remember(null);
        setSecret(null);
        setDevices(null);
        toast({ description: 'Not found.', variant: 'destructive' });
      }
    },
    [toast],
  );

  useEffect(() => {
    if (secret) void load(secret);
    // Only on first open; later loads are explicit.
  }, []);

  const issue = async (kind: 'code' | 'token') => {
    if (!secret) return;
    try {
      const out = await consoleFetch<{ code?: string; token?: string }>(
        secret,
        kind === 'code' ? '/devices' : '/tokens',
        { label },
      );
      setIssued({ kind, label: label.trim(), value: out.code ?? out.token ?? '' });
      setLabel('');
      await load(secret);
    } catch (e) {
      toast({ description: (e as Error).message, variant: 'destructive' });
    }
  };

  const revoke = async (device: ConsoleDevice) => {
    if (!secret) return;
    if (!window.confirm(`Revoke “${device.label}”? It stops working at once.`)) return;
    try {
      await consoleFetch(secret, `/devices/${device.id}/revoke`, { confirm: true });
      toast({ description: `Revoked ${device.label}` });
      await load(secret);
    } catch (e) {
      toast({ description: (e as Error).message, variant: 'destructive' });
    }
  };

  if (!secret || !devices) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <form
          className="w-full max-w-sm space-y-4 rounded-lg neo-raised p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void load(typed.trim());
            setTyped('');
          }}
        >
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <Terminal className="h-5 w-5 text-primary" aria-hidden /> Developer console
          </h1>
          <label htmlFor="dev-secret" className="block text-sm font-medium">
            Developer secret
          </label>
          <Input
            id="dev-secret"
            type="password"
            autoComplete="off"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
            }}
            className="h-11"
          />
          <Button type="submit" className="h-11 w-full" disabled={typed.trim() === ''}>
            Open
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Kept in this tab only and forgotten when it closes.
          </p>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-4 bg-background px-4 py-6">
      <header className="flex items-center gap-2">
        <Terminal className="h-5 w-5 text-primary" aria-hidden />
        <h1 className="flex-1 text-lg font-bold">Developer console</h1>
        <Button
          variant="ghost"
          onClick={() => {
            remember(null);
            setSecret(null);
            setDevices(null);
            setIssued(null);
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Close
        </Button>
      </header>

      <Card className="space-y-3 p-4">
        <h2 className="text-base font-semibold">Issue</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label="Label"
            placeholder="Label, e.g. Rich iPhone or Briefing agent"
            value={label}
            maxLength={60}
            onChange={(e) => {
              setLabel(e.target.value);
            }}
            className="h-10 min-w-[16rem] flex-1"
          />
          <Button disabled={label.trim() === ''} onClick={() => void issue('code')}>
            <KeyRound className="mr-2 h-4 w-4" /> Access code
          </Button>
          <Button
            variant="outline"
            disabled={label.trim() === ''}
            onClick={() => void issue('token')}
          >
            Export token
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          An access code admits one browser for 90 days. An export token lets a script read GET
          /api/export only (send it as <code>Authorization: Bearer …</code>).
        </p>
        {issued && (
          <div
            className="space-y-2 rounded-md border border-primary/50 bg-primary/5 p-3"
            role="status"
          >
            <p className="text-sm font-medium">
              {issued.kind === 'code' ? 'Access code' : 'Export token'} for “{issued.label}”. Shown
              once: copy it now.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-background px-2 py-1.5 font-mono text-sm">
                {issued.value}
              </code>
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy"
                onClick={() => {
                  void navigator.clipboard.writeText(issued.value).then(() => {
                    toast({ description: 'Copied' });
                  });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">Devices and tokens</h2>
        {devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">None issued yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Label</th>
                  <th className="py-2 pr-3">Kind</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Issued</th>
                  <th className="py-2 pr-3">Last seen</th>
                  <th className="py-2 pr-3">Trusted until</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="py-2 pr-3 font-medium">{d.label}</td>
                    <td className="py-2 pr-3">{d.kind === 'device' ? 'Device' : 'Export token'}</td>
                    <td className="py-2 pr-3">
                      {d.status === 'not-used'
                        ? 'Not used yet'
                        : d.status === 'live'
                          ? 'Live'
                          : 'Revoked'}
                    </td>
                    <td className="py-2 pr-3">{when(d.issuedAt)}</td>
                    <td className="py-2 pr-3">{when(d.lastSeenAt)}</td>
                    <td className="py-2 pr-3">{when(d.trustedUntil)}</td>
                    <td className="py-2 text-right">
                      {d.status !== 'revoked' && (
                        <Button
                          variant="ghost"
                          className="h-8 text-danger"
                          onClick={() => void revoke(d)}
                        >
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}
