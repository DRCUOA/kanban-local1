/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/return-await, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/require-await, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/prefer-optional-chain -- R2 baseline: strict fixes deferred to follow-up tasks */
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
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
import {
  insertStageSchema,
  insertSubStageSchema,
  type InsertStage,
  type InsertSubStage,
  type Stage,
  type SubStage,
} from '@shared/schema';
import { queryClient } from '@/lib/queryClient';
import { apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Trash2, Edit, ChevronLeft, Settings } from 'lucide-react';
import { ColorPicker } from '@/components/ColorPicker';
import { useState } from 'react';
import { useStages, useSubStages } from '@/hooks/use-stages';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- page component; props will grow during Phase 5 decomposition
export interface AdminProps {}

export default function Admin(_props: AdminProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubStageId, setEditingSubStageId] = useState<number | null>(null);
  const [subStageDialogOpen, setSubStageDialogOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);

  const { data: stages = [], isLoading } = useStages();

  const { data: subStages = [] } = useSubStages();

  const createMutation = useMutation({
    mutationFn: (data: InsertStage) => apiPost<Stage>(api.stages.create.path, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stages.list.path] });
      queryClient.refetchQueries({ queryKey: [api.stages.list.path] });
      toast({ description: 'Stage created' });
      setDialogOpen(false);
      form.reset({ name: '', order: 1, color: '#3B82F6' });
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
      form.reset({ name: '', order: 1, color: '#3B82F6' });
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

  const form = useForm<InsertStage>({
    resolver: zodResolver(insertStageSchema),
    defaultValues: { name: '', order: 1, color: '#3B82F6' },
  });

  const subStageForm = useForm<InsertSubStage>({
    resolver: zodResolver(insertSubStageSchema),
    defaultValues: {
      stageId: 0,
      name: '',
      tag: '',
      bgClass: 'bg-background/20',
      opacity: 20,
      order: 1,
    },
  });

  const createSubStageMutation = useMutation({
    mutationFn: (data: InsertSubStage) => apiPost<SubStage>(api.subStages.create.path, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.subStages.list.path] });
      toast({ description: 'Sub-stage created' });
      setSubStageDialogOpen(false);
      subStageForm.reset({
        stageId: 0,
        name: '',
        tag: '',
        bgClass: 'bg-background/20',
        opacity: 20,
        order: 1,
      });
    },
    onError: (error) => {
      toast({
        description: error instanceof Error ? error.message : 'Failed to create sub-stage',
        variant: 'destructive',
      });
    },
  });

  const updateSubStageMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertSubStage> }) => {
      const url = api.subStages.update.path.replace(':id', String(id));
      return apiPatch<SubStage>(url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.subStages.list.path] });
      toast({ description: 'Sub-stage updated' });
      setSubStageDialogOpen(false);
      setEditingSubStageId(null);
      subStageForm.reset({
        stageId: 0,
        name: '',
        tag: '',
        bgClass: 'bg-background/20',
        opacity: 20,
        order: 1,
      });
    },
    onError: (error) => {
      toast({
        description: error instanceof Error ? error.message : 'Failed to update sub-stage',
        variant: 'destructive',
      });
    },
  });

  const deleteSubStageMutation = useMutation({
    mutationFn: (id: number) => {
      const url = api.subStages.delete.path.replace(':id', String(id));
      return apiDelete(url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.subStages.list.path] });
      toast({ description: 'Sub-stage deleted' });
    },
    onError: (error) => {
      toast({
        description: error instanceof Error ? error.message : 'Failed to delete sub-stage',
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
    form.reset({ name: stage.name, order: stage.order, color: stage.color || '#3B82F6' });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    form.reset({ name: '', order: 1, color: '#3B82F6' });
  };

  const handleSubStageSubmit = subStageForm.handleSubmit((data) => {
    if (editingSubStageId) {
      updateSubStageMutation.mutate({ id: editingSubStageId, data });
    } else {
      createSubStageMutation.mutate(data);
    }
  });

  const openEditSubStageDialog = (subStage: any) => {
    setEditingSubStageId(subStage.id);
    setSelectedStageId(subStage.stageId);
    subStageForm.reset({
      stageId: subStage.stageId,
      name: subStage.name,
      tag: subStage.tag,
      bgClass: subStage.bgClass,
      opacity: subStage.opacity,
      order: subStage.order,
    });
    setSubStageDialogOpen(true);
  };

  const closeSubStageDialog = () => {
    setSubStageDialogOpen(false);
    setEditingSubStageId(null);
    setSelectedStageId(null);
    subStageForm.reset({
      stageId: 0,
      name: '',
      tag: '',
      bgClass: 'bg-background/20',
      opacity: 20,
      order: 1,
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 neo-container rounded-none px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              navigate('/');
            }}
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

      <div className="flex-1 overflow-y-auto scroll-container px-3 py-4 space-y-4">
        {/* Stages Section */}
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold">Stages</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="rounded-xl h-10 active:scale-95 transition-transform"
                  onClick={() => {
                    setEditingId(null);
                    form.reset({ name: '', order: 1, color: '#3B82F6' });
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
                              className="h-12 rounded-xl text-base"
                              data-testid="input-stage-name"
                            />
                          </FormControl>
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
                              className="h-12 rounded-xl text-base"
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
                        className="flex-1 h-12 rounded-xl"
                        onClick={closeDialog}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1 h-12 rounded-xl active:scale-95 transition-transform"
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
                  className="flex items-center justify-between p-3 neo-card rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    {stage.color && (
                      <div
                        className="w-6 h-6 rounded-lg"
                        style={{ backgroundColor: stage.color }}
                      />
                    )}
                    <div>
                      <p className="font-medium text-sm">{stage.name}</p>
                      <p className="text-[10px] text-muted-foreground">Order: {stage.order}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl"
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
                      className="h-10 w-10 rounded-xl"
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

        {/* Sub-Stages Section */}
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold">Sub-Stages</h2>
            <Dialog open={subStageDialogOpen} onOpenChange={setSubStageDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="rounded-xl h-10 active:scale-95 transition-transform"
                  onClick={() => {
                    setEditingSubStageId(null);
                    setSelectedStageId(null);
                    subStageForm.reset({
                      stageId: 0,
                      name: '',
                      tag: '',
                      bgClass: 'bg-background/20',
                      opacity: 20,
                      order: 1,
                    });
                  }}
                >
                  Add Sub-Stage
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-full h-full max-h-full rounded-none m-0 flex flex-col">
                <DialogHeader>
                  <DialogTitle className="text-lg">
                    {editingSubStageId ? 'Edit Sub-Stage' : 'Create Sub-Stage'}
                  </DialogTitle>
                </DialogHeader>
                <Form {...subStageForm}>
                  <form
                    onSubmit={handleSubStageSubmit}
                    className="flex-1 flex flex-col gap-4 overflow-y-auto scroll-container"
                  >
                    <FormField
                      control={subStageForm.control}
                      name="stageId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Parent Stage</FormLabel>
                          <Select
                            value={field.value?.toString() || ''}
                            onValueChange={(value) => {
                              field.onChange(parseInt(value));
                              setSelectedStageId(parseInt(value));
                            }}
                          >
                            <FormControl>
                              <SelectTrigger className="h-12 rounded-xl">
                                <SelectValue placeholder="Select a stage" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {stages.map((stage: any) => (
                                <SelectItem
                                  key={stage.id}
                                  value={stage.id.toString()}
                                  className="py-3"
                                >
                                  {stage.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={subStageForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. AM"
                              {...field}
                              className="h-12 rounded-xl text-base"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={subStageForm.control}
                      name="tag"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Tag</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. day-plan-am"
                              {...field}
                              className="h-12 rounded-xl text-base"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={subStageForm.control}
                      name="bgClass"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Background Class</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. bg-background/20"
                              {...field}
                              className="h-12 rounded-xl text-base"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={subStageForm.control}
                        name="opacity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Opacity (0-100)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                className="h-12 rounded-xl text-base"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(Number(e.target.value));
                                }}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={subStageForm.control}
                        name="order"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Order</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                className="h-12 rounded-xl text-base"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(Number(e.target.value));
                                }}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex-1" />
                    <div className="flex gap-3 pb-safe-bottom sticky bottom-0 bg-background pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-12 rounded-xl"
                        onClick={closeSubStageDialog}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1 h-12 rounded-xl active:scale-95 transition-transform"
                        disabled={
                          createSubStageMutation.isPending || updateSubStageMutation.isPending
                        }
                      >
                        {editingSubStageId ? 'Update' : 'Create'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {subStages.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No sub-stages found.
            </div>
          ) : (
            <div className="space-y-4">
              {stages.map((stage: any) => {
                const stageSubStages = subStages.filter((ss: any) => ss.stageId === stage.id);
                if (stageSubStages.length === 0) return null;

                return (
                  <div key={stage.id} className="space-y-2">
                    <h3 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
                      {stage.name}
                    </h3>
                    <div className="space-y-2 pl-2">
                      {stageSubStages.map((subStage: any) => (
                        <div
                          key={subStage.id}
                          className="flex items-center justify-between p-3 neo-card rounded-xl"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-5 h-5 rounded"
                              style={{ backgroundColor: `rgba(0,0,0,${subStage.opacity / 100})` }}
                            />
                            <div>
                              <p className="font-medium text-sm">{subStage.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {subStage.tag} | {subStage.opacity}%
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 rounded-xl"
                              onClick={() => {
                                openEditSubStageDialog(subStage);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-10 w-10 rounded-xl"
                              onClick={() => {
                                deleteSubStageMutation.mutate(subStage.id);
                              }}
                              disabled={deleteSubStageMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
