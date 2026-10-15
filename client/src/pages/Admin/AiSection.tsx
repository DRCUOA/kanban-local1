import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { AiSettingsResponse } from '@shared/goal-plan';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAiSettings, useUpdateAiSettings } from '@/hooks/use-goal-plan';

const SOURCE_LABEL: Record<AiSettingsResponse['keySource'], string> = {
  admin: 'Using the key saved here',
  env: 'Using OPENAI_API_KEY from the server environment; a key saved here takes over from it',
  none: 'No key set: “Make this a goal” will not work until one is added',
  unreadable:
    'A key was saved but can no longer be decrypted (the server secret changed). Enter it again',
};

const ENCRYPTION_LABEL: Record<AiSettingsResponse['encryption'], string> = {
  'settings-secret': 'encrypted with the server’s SETTINGS_SECRET',
  'database-derived':
    'encrypted with a key derived from the server’s database connection (set SETTINGS_SECRET for a separate secret)',
};

/**
 * Admin card for the AI assistant: which OpenAI model “Make this a goal” uses,
 * and the API key. Models are GPT-5 or later only; with a key set, the list is
 * what that key can call. The key is write-only: checked with OpenAI before it
 * is saved, stored encrypted, and only its last four characters come back.
 */
export function AiSection() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useAiSettings();
  const update = useUpdateAiSettings();
  const [apiKey, setApiKey] = useState('');

  const save = (body: { model?: string; apiKey?: string | null }, done: string) => {
    update.mutate(body, {
      onSuccess: () => {
        setApiKey('');
        toast({ description: done });
      },
      onError: (error) => {
        toast({ title: 'Not saved', description: error.message, variant: 'destructive' });
      },
    });
  };

  // Keep the current model selectable even if the account list does not include it.
  const options =
    settings && !settings.models.some((m) => m.id === settings.model)
      ? [{ id: settings.model, note: 'Current setting' }, ...settings.models]
      : (settings?.models ?? []);

  return (
    <Card className="p-4" data-testid="admin-ai-section">
      <div className="mb-4 flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
        <div>
          <h2 className="text-base font-semibold">AI assistant</h2>
          <p className="text-[10px] text-muted-foreground">
            Powers “Make this a goal” on the task form. Calls OpenAI with the goal’s details.
          </p>
        </div>
      </div>

      {isLoading || !settings ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="ai-model" className="text-xs font-medium">
              Model
            </label>
            <Select
              value={settings.model}
              disabled={update.isPending}
              onValueChange={(model) => {
                save({ model }, `Model set to ${model}`);
              }}
            >
              <SelectTrigger id="ai-model" className="h-11" data-testid="select-ai-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="py-2.5">
                    <span className="font-medium">{m.id}</span>
                    {m.note && <span className="ml-2 text-xs text-muted-foreground">{m.note}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              {settings.modelsSource === 'account'
                ? 'GPT-5 and later models your API key can use.'
                : 'GPT-5 and later models from OpenAI’s documentation. Add a key to list exactly what your account can use.'}{' '}
              Saved as soon as you choose.
            </p>
          </div>

          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              save({ apiKey: apiKey.trim() }, 'API key checked with OpenAI and saved');
            }}
          >
            <label htmlFor="ai-key" className="text-xs font-medium">
              OpenAI API key
            </label>
            <p className="text-xs" data-testid="ai-key-status">
              {SOURCE_LABEL[settings.keySource]}
              {settings.keyHint ? ` (${settings.keyHint})` : ''}.
            </p>
            <div className="flex gap-2">
              <Input
                id="ai-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={settings.keySource === 'admin' ? 'Replace the saved key' : 'sk-…'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                }}
                className="h-10"
                data-testid="input-ai-key"
              />
              <Button type="submit" disabled={update.isPending || apiKey.trim().length < 10}>
                {update.isPending ? 'Checking…' : 'Save key'}
              </Button>
            </div>
            {(settings.keySource === 'admin' || settings.keySource === 'unreadable') && (
              <Button
                type="button"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={() => {
                  save({ apiKey: null }, 'Saved key removed');
                }}
              >
                Remove saved key
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground">
              Checked with OpenAI before saving, then stored {ENCRYPTION_LABEL[settings.encryption]}
              . The key is never sent back to the browser. This page has no login, so anyone who can
              open it can replace the key.
            </p>
          </form>
        </div>
      )}
    </Card>
  );
}
