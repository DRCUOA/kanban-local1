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
import { Trash2, Edit, ChevronLeft } from "lucide-react";
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
    mutationFn: (data: InsertStage) =>
      apiRequest(api.stages.create.path, {
        method: api.stages.create.method,
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stages.list.path] });
      toast({ description: "Stage created successfully" });
      setDialogOpen(false);
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertStage> }) =>
      apiRequest(`${api.stages.update.path.replace(":id", String(id))}`, {
        method: api.stages.update.method,
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stages.list.path] });
      toast({ description: "Stage updated successfully" });
      setEditingId(null);
      setDialogOpen(false);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`${api.stages.delete.path.replace(":id", String(id))}`, {
        method: api.stages.delete.method,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stages.list.path] });
      toast({ description: "Stage deleted successfully" });
    },
  });

  const form = useForm<InsertStage>({
    resolver: zodResolver(insertStageSchema),
    defaultValues: { name: "", order: 1 },
  });

  const handleSubmit = form.handleSubmit((data) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  });

  const openEditDialog = (stage: any) => {
    setEditingId(stage.id);
    form.reset({ name: stage.name, order: stage.order });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    form.reset();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/")}
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-3xl font-bold">Task Stages Admin</h1>
        </div>

        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Manage Stages</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingId(null);
                    form.reset();
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
            <div className="space-y-2">
              {stages.map((stage: any) => (
                <div key={stage.id} className="flex items-center justify-between p-4 border rounded-lg hover-elevate">
                  <div>
                    <p className="font-medium">{stage.name}</p>
                    <p className="text-sm text-muted-foreground">Order: {stage.order}</p>
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
