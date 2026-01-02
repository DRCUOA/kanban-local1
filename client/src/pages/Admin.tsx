import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { insertStageSchema, type InsertStage } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Trash2, Edit, ChevronLeft, Settings } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ColorPicker } from "@/components/ColorPicker";
import { useState } from "react";

export default function Admin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: stages = [], isLoading } = useQuery({
    queryKey: [api.stages.list.path],
    queryFn: async () => {
      const res = await fetch(api.stages.list.path);
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertStage) => {
      console.log('[UI] [CREATE_STAGE] Starting mutation with data:', JSON.stringify(data));
      const response = await apiRequest(api.stages.create.method, api.stages.create.path, data);
      console.log('[UI] [CREATE_STAGE] Request completed, response status:', response.status);
      const responseData = await response.json();
      console.log('[UI] [CREATE_STAGE] Response data:', JSON.stringify(responseData));
      return responseData;
    },
    onSuccess: (data) => {
      console.log('[UI] [CREATE_STAGE] Mutation successful, received data:', JSON.stringify(data));
      queryClient.invalidateQueries({ queryKey: [api.stages.list.path] });
      queryClient.refetchQueries({ queryKey: [api.stages.list.path] });
      console.log('[UI] [CREATE_STAGE] Cache invalidated and refetched, showing toast');
      toast({ description: "Stage created successfully" });
      setDialogOpen(false);
      form.reset({ name: "", order: 1, color: "#3B82F6" });
      console.log('[UI] [CREATE_STAGE] Form reset and dialog closed');
    },
    onError: (error) => {
      console.error('[UI] [CREATE_STAGE] Mutation error:', error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertStage> }) => {
      console.log('[UI] [UPDATE_STAGE] Starting mutation with id:', id, 'data:', JSON.stringify(data));
      const url = api.stages.update.path.replace(":id", String(id));
      const response = await apiRequest(api.stages.update.method, url, data);
      console.log('[UI] [UPDATE_STAGE] Request completed, response status:', response.status);
      const responseData = await response.json();
      console.log('[UI] [UPDATE_STAGE] Response data:', JSON.stringify(responseData));
      return responseData;
    },
    onSuccess: (data) => {
      console.log('[UI] [UPDATE_STAGE] Mutation successful, received data:', JSON.stringify(data));
      queryClient.invalidateQueries({ queryKey: [api.stages.list.path] });
      queryClient.refetchQueries({ queryKey: [api.stages.list.path] });
      console.log('[UI] [UPDATE_STAGE] Cache invalidated and refetched, showing toast');
      toast({ description: "Stage updated successfully" });
      setEditingId(null);
      setDialogOpen(false);
      form.reset({ name: "", order: 1, color: "#3B82F6" });
      console.log('[UI] [UPDATE_STAGE] Form reset and dialog closed');
    },
    onError: (error) => {
      console.error('[UI] [UPDATE_STAGE] Mutation error:', error);
      toast({ 
        description: error instanceof Error ? error.message : "Failed to update stage",
        variant: "destructive"
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log('[UI] [DELETE_STAGE] Starting mutation with id:', id);
      const url = api.stages.delete.path.replace(":id", String(id));
      const response = await apiRequest(api.stages.delete.method, url);
      console.log('[UI] [DELETE_STAGE] Request completed, response status:', response.status);
      return response;
    },
    onSuccess: () => {
      console.log('[UI] [DELETE_STAGE] Mutation successful');
      queryClient.invalidateQueries({ queryKey: [api.stages.list.path] });
      queryClient.refetchQueries({ queryKey: [api.stages.list.path] });
      console.log('[UI] [DELETE_STAGE] Cache invalidated and refetched, showing toast');
      toast({ description: "Stage deleted successfully" });
    },
    onError: (error) => {
      console.error('[UI] [DELETE_STAGE] Mutation error:', error);
      toast({ 
        description: error instanceof Error ? error.message : "Failed to delete stage",
        variant: "destructive"
      });
    },
  });

  const form = useForm<InsertStage>({
    resolver: zodResolver(insertStageSchema),
    defaultValues: { name: "", order: 1, color: "#3B82F6" },
  });

  const handleSubmit = form.handleSubmit((data) => {
    console.log('[UI] [FORM_SUBMIT] Form data:', JSON.stringify(data, null, 2));
    console.log('[UI] [FORM_SUBMIT] Color value:', data.color);
    console.log('[UI] [FORM_SUBMIT] Color type:', typeof data.color);
    
    // Ensure color is always a valid hex string (never undefined or empty)
    const submitData = {
      ...data,
      color: (data.color && data.color.trim() !== "" && data.color.startsWith("#")) 
        ? data.color 
        : "#3B82F6", // Default to blue if invalid
    };
    
    console.log('[UI] [FORM_SUBMIT] Submit data after cleanup:', JSON.stringify(submitData, null, 2));
    
    if (editingId) {
      console.log('[UI] [UPDATE_STAGE] Form submitted with data:', JSON.stringify(submitData), 'id:', editingId);
      updateMutation.mutate({ id: editingId, data: submitData });
    } else {
      console.log('[UI] [CREATE_STAGE] Form submitted with data:', JSON.stringify(submitData));
      console.log('[UI] [CREATE_STAGE] Calling createMutation.mutate');
      createMutation.mutate(submitData);
    }
  });

  const openEditDialog = (stage: any) => {
    setEditingId(stage.id);
    const formData = { 
      name: stage.name, 
      order: stage.order,
      color: stage.color || "#3B82F6"
    };
    console.log('[UI] [EDIT_DIALOG] Opening edit dialog for stage:', stage.id);
    console.log('[UI] [EDIT_DIALOG] Stage color from DB:', stage.color);
    console.log('[UI] [EDIT_DIALOG] Form data to set:', JSON.stringify(formData));
    form.reset(formData);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    form.reset({ name: "", order: 1, color: "#3B82F6" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 neo-container rounded-none border-0 border-b-0">
        <div className="container mx-auto px-6 py-4">
          {/* Top Row - Logo */}
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 neo-raised rounded-xl flex items-center justify-center">
                <Settings className="text-primary h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Task Stages Admin</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Manage Stages</p>
              </div>
            </div>
          </div>
          
          {/* Bottom Row - Navigation */}
          <div className="flex items-center justify-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigate("/")}
                  className="rounded-xl h-11 w-11"
                  data-testid="button-back"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Back to Board</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 flex-1">

        <Card className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Manage Stages</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingId(null);
                    form.reset({ name: "", order: 1, color: "#3B82F6" });
                  }}
                  data-testid="button-add-stage"
                >
                  Add Stage
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-stage-form">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Edit Stage" : "Create Stage"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stage Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Backlog" {...field} data-testid="input-stage-name" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="order"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Order</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
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
                        const colorValue = field.value || "#3B82F6";
                        console.log('[UI] [COLOR_FIELD] Field value:', field.value);
                        console.log('[UI] [COLOR_FIELD] Using color value:', colorValue);
                        return (
                          <FormItem>
                            <FormControl>
                              <ColorPicker
                                value={colorValue}
                                onChange={(color) => {
                                  console.log('[UI] [COLOR_FIELD] Color changed to:', color);
                                  // Always ensure we set a valid hex color
                                  const normalizedColor = color && color.startsWith("#") ? color : "#3B82F6";
                                  console.log('[UI] [COLOR_FIELD] Setting normalized color:', normalizedColor);
                                  field.onChange(normalizedColor);
                                }}
                                label="Stage Color"
                              />
                            </FormControl>
                          </FormItem>
                        );
                      }}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-submit-stage"
                    >
                      {editingId ? "Update" : "Create"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="text-center py-8">Loading stages...</div>
          ) : stages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No stages found. Create one to get started.</div>
          ) : (
            <div className="space-y-4">
              {stages.map((stage: any) => (
                <div key={stage.id} className="flex items-center justify-between p-6 neo-card rounded-xl">
                  <div className="flex items-center gap-4">
                    {stage.color && (
                      <div 
                        className="w-8 h-8 rounded-lg border-2"
                        style={{ backgroundColor: stage.color, borderColor: stage.color }}
                      />
                    )}
                    <div>
                      <p className="font-medium">{stage.name}</p>
                      <p className="text-sm text-muted-foreground">Order: {stage.order}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openEditDialog(stage)}
                      data-testid={`button-edit-stage-${stage.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => deleteMutation.mutate(stage.id)}
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
      </div>
    </div>
  );
}
