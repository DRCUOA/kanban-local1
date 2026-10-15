import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAiSettings, useUpdateAiSettings } from '@/hooks/use-goal-plan';

const SOURCE_LABEL = {
  admin: 'Using the key saved here',
  env: 'Using OPENAI_API_KEY from the server environment',
  none: 'No key set: "Make this a goal" will not work until one is added',
} as const;

/**
 * Admin card for the AI assistant: which OpenAI model "Make this a goal" uses,
 * and the API key. The key is write-only: it is stored encrypted on the server
 * and only its last four characters ever come back.
 */
export function AiSection() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useAiSettings();
  const update = useUpdateAiSettings();
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (settings) setModel(settings.model);
  }, [settings]);

  const save = (body: { model?: string; apiKey?: string | null }, done: string) => {
    update.mutate(body, {
      onSuccess: () => {
        setApiKey('');
        toast({ description: done });
      },
      onError: (error) => {
        toast({ description: error.message, variant: 'destructive' });
      },
    });
  };

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
        <div className="space-y-5">
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              save({ model: model.trim() }, `Model set to ${model.trim()}`);
            }}
          >
            <label htmlFor="ai-model" className="text-xs font-medium">
              Model
            </label>
            <div className="flex gap-2">
              <Input
                id="ai-model"
                list="ai-model-suggestions"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                }}
                className="h-10"
                data-testid="input-ai-model"
              />
              <datalist id="ai-model-suggestions">
                {settings.suggestedModels.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <Button
                type="submit"
                disabled={
                  update.isPending || model.trim() === '' || model.trim() === settings.model
                }
              >
                Save
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Any OpenAI chat model id that supports structured output, e.g.{' '}
              {settings.suggestedModels.join(', ')}.
            </p>
          </form>

          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              save({ apiKey: apiKey.trim() }, 'API key saved');
            }}
          >
            <label htmlFor="ai-key" className="text-xs font-medium">
              OpenAI API key
            </label>
            <p className="text-xs" data-testid="ai-key-status">
              {SOURCE_LABEL[settings.keySource]}
              {settings.keyHint ? ` (${settings.keyHint})` : ''}.
            </p>
            {settings.canStoreKey ? (
              <>
                <div className="flex gap-2">
                  <Input
                    id="ai-key"
                    type="password"
                    autoComplete="off"
                    placeholder={settings.keySource === 'admin' ? 'Replace the key' : 'sk-…'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                    }}
                    className="h-10"
                    data-testid="input-ai-key"
                  />
                  <Button type="submit" disabled={update.isPending || apiKey.trim().length < 10}>
                    Save key
                  </Button>
                </div>
                {settings.keySource === 'admin' && (
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
                  Stored encrypted on the server and never shown again. Anyone who can open this
                  page can replace it.
                </p>
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                To save a key here, set SETTINGS_SECRET (16+ characters) on the server and restart.
                Until then the server’s OPENAI_API_KEY is used.
              </p>
            )}
          </form>
        </div>
      )}
    </Card>
  );
}
