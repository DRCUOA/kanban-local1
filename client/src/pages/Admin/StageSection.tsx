/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { api } from '@shared/routes';
import { insertStageSchema, type InsertStage, type Stage } from '@shared/schema';
import {
  STAGE_KIND_VALUES,
  STAGE_KIND_LABEL,
  STAGE_KIND_DESCRIPTION,
  DEFAULT_STAGE_KIND,
} from '@shared/constants';
import { stageKind } from '@shared/stage-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { queryClient } from '@/lib/queryClient';
import { apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Trash2, Edit } from 'lucide-react';
import { ColorPicker } from '@/components/ColorPicker';
import { useState } from 'react';

export interface StageSectionProps {
  stages: Stage[];
  isLoading: boolean;
}

export function StageSection({ stages, isLoading }: StageSectionProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<InsertStage>({
    resolver: zodResolver(insertStageSchema),
    defaultValues: { name: '', order: 1, color: '#3B82F6', kind: DEFAULT_STAGE_KIND },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertStage) => apiPost<Stage>(api.stages.create.path, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stages.list.path] });
      queryClient.refetchQueries({ queryKey: [api.stages.list.path] });
      toast({ description: 'Stage created' });
      setDialogOpen(false);
      form.reset({ name: '', order: 1, color: '#3B82F6', kind: DEFAULT_STAGE_KIND });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertStage> }) => {
      const url = api.stages.update.path.replace(':id', String(id));
      return apiPatch<Stage>(url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stages.list.path] });
      queryClient.refetchQueries({ queryKey: [api.stages.list.path] });
      toast({ description: 'Stage updated' });
      setEditingId(null);
      setDialogOpen(false);
      form.reset({ name: '', order: 1, color: '#3B82F6', kind: DEFAULT_STAGE_KIND });
    },
    onError: (error) => {
      toast({
        description: error instanceof Error ? error.message : 'Failed to update stage',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => {
      const url = api.stages.delete.path.replace(':id', String(id));
      return apiDelete(url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stages.list.path] });
      queryClient.refetchQueries({ queryKey: [api.stages.list.path] });
      toast({ description: 'Stage deleted' });
    },
    onError: (error) => {
      toast({
        description: error instanceof Error ? error.message : 'Failed to delete stage',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    const submitData = {
      ...data,
      color:
        data.color && data.color.trim() !== '' && data.color.startsWith('#')
          ? data.color
          : '#3B82F6',
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  });

  const openEditDialog = (stage: any) => {
    setEditingId(stage.id);
    form.reset({
      name: stage.name,
      order: stage.order,
      color: stage.color || '#3B82F6',
      kind: stageKind(stage),
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    form.reset({ name: '', order: 1, color: '#3B82F6', kind: DEFAULT_STAGE_KIND });
  };

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-base font-semibold">Stages</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="rounded-md h-10 active:scale-95 transition-transform"
              onClick={() => {
                setEditingId(null);
                form.reset({ name: '', order: 1, color: '#3B82F6', kind: DEFAULT_STAGE_KIND });
              }}
              data-testid="button-add-stage"
            >
              Add Stage
            </Button>
          </DialogTrigger>
          <DialogContent
            className="max-w-full h-full max-h-full rounded-none m-0 flex flex-col"
            data-testid="dialog-stage-form"
          >
            <DialogHeader>
              <DialogTitle className="text-lg">
                {editingId ? 'Edit Stage' : 'Create Stage'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Stage Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Backlog"
                          {...field}
                          className="h-12 rounded-md text-base"
                          data-testid="input-stage-name"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {/* The column's meaning, and so the state of every task in
                    it. Explicit since EPIC-03 story 1: it used to be guessed
                    from the name above, which made renaming a column restate
                    its tasks. */}
                <FormField
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">
                        Kind — what tasks in this column mean
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || DEFAULT_STAGE_KIND}
                      >
                        <FormControl>
                          <SelectTrigger
                            className="h-12 rounded-md"
                            data-testid="select-stage-kind"
                          >
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STAGE_KIND_VALUES.map((kind) => (
                            <SelectItem key={kind} value={kind} className="py-3">
                              <span>{STAGE_KIND_LABEL[kind]}</span>
                              <span className="ml-2 text-[11px] text-muted-foreground">
                                {STAGE_KIND_DESCRIPTION[kind]}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Order</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          className="h-12 rounded-md text-base"
                          {...field}
                          onChange={(e) => {
                            field.onChange(Number(e.target.value));
                          }}
                          data-testid="input-stage-order"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => {
                    const colorValue = field.value || '#3B82F6';
                    return (
                      <FormItem>
                        <FormControl>
                          <ColorPicker
                            value={colorValue}
                            onChange={(color) => {
                              const normalizedColor =
                                color && color.startsWith('#') ? color : '#3B82F6';
                              field.onChange(normalizedColor);
                            }}
                            label="Stage Color"
                          />
                        </FormControl>
                      </FormItem>
                    );
                  }}
                />
                <div className="flex-1" />
                <div className="flex gap-3 pb-safe-bottom sticky bottom-0 bg-background pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-12 rounded-md"
                    onClick={closeDialog}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-12 rounded-md active:scale-95 transition-transform"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit-stage"
                  >
                    {editingId ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-sm text-muted-foreground">Loading stages...</div>
      ) : stages.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          No stages found. Create one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {stages.map((stage: any) => (
            <div
              key={stage.id}
              className="flex items-center justify-between p-3 neo-card rounded-md"
            >
              <div className="flex items-center gap-3">
                {stage.color && (
                  <div className="w-6 h-6 rounded-lg" style={{ backgroundColor: stage.color }} />
                )}
                <div>
                  <p className="font-medium text-sm">{stage.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {STAGE_KIND_LABEL[stageKind(stage)]} · Order: {stage.order}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-md"
                  onClick={() => {
                    openEditDialog(stage);
                  }}
                  data-testid={`button-edit-stage-${stage.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-10 w-10 rounded-md"
                  onClick={() => {
                    deleteMutation.mutate(stage.id);
                  }}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-stage-${stage.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
