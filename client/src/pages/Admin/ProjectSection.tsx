import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, ArchiveRestore, Edit, Trash2 } from 'lucide-react';
import { insertProjectSchema, type InsertProject, type ProjectSummary } from '@shared/schema';
import {
  DEFAULT_PROJECT_COLOR,
  PROJECT_KEY_MAX_LEN,
  PROJECT_NAME_MAX_LEN,
} from '@shared/constants';
import { useCreateProject, useDeleteProject, useUpdateProject } from '@/hooks/use-projects';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ColorPicker } from '@/components/ColorPicker';

export interface ProjectSectionProps {
  projects: ProjectSummary[];
  isLoading: boolean;
}

const emptyForm = (): InsertProject => ({ name: '', key: null, color: DEFAULT_PROJECT_COLOR });

/**
 * Admin card for projects: create, rename, recolour, archive and delete. A
 * project is a set of tasks related to a common goal; deleting one releases
 * its tasks (they stay on the board with no project), so only the delete asks
 * first — and only to explain that.
 */
export function ProjectSection({ projects, isLoading }: ProjectSectionProps) {
  const { toast } = useToast();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProjectSummary | null>(null);

  const form = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: emptyForm(),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    form.reset(emptyForm());
  };

  const fail = (error: unknown, fallback: string) => {
    toast({
      description: error instanceof Error ? error.message : fallback,
      variant: 'destructive',
    });
  };

  const handleSubmit = form.handleSubmit((data) => {
    if (editingId !== null) {
      updateProject.mutate(
        { id: editingId, ...data },
        {
          onSuccess: () => {
            toast({ description: 'Project updated' });
            closeDialog();
          },
          onError: (error) => {
            fail(error, 'Failed to update project');
          },
        },
      );
    } else {
      createProject.mutate(data, {
        onSuccess: () => {
          toast({ description: 'Project created' });
          closeDialog();
        },
        onError: (error) => {
          fail(error, 'Failed to create project');
        },
      });
    }
  });

  const openEdit = (project: ProjectSummary) => {
    setEditingId(project.id);
    form.reset({
      name: project.name,
      key: project.key,
      color: project.color ?? DEFAULT_PROJECT_COLOR,
    });
    setDialogOpen(true);
  };

  const toggleArchived = (project: ProjectSummary) => {
    updateProject.mutate(
      { id: project.id, archived: !project.archived },
      {
        onSuccess: () => {
          toast({ description: project.archived ? 'Project unarchived' : 'Project archived' });
        },
        onError: (error) => {
          fail(error, 'Failed to update project');
        },
      },
    );
  };

  const confirmDelete = () => {
    const project = pendingDelete;
    setPendingDelete(null);
    if (!project) return;
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        toast({
          description: `“${project.name}” deleted. Its tasks stay on the board with no project.`,
        });
      },
      onError: (error) => {
        fail(error, 'Failed to delete project');
      },
    });
  };

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold">Projects</h2>
          <p className="text-[10px] text-muted-foreground">
            A set of tasks with a common goal. Scope the board to one from the header.
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (open) setDialogOpen(true);
            else closeDialog();
          }}
        >
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="rounded-xl h-10 active:scale-95 transition-transform"
              onClick={() => {
                setEditingId(null);
                form.reset(emptyForm());
              }}
              data-testid="button-add-project"
            >
              Add Project
            </Button>
          </DialogTrigger>
          <DialogContent
            className="max-w-full h-full max-h-full rounded-none m-0 flex flex-col"
            data-testid="dialog-project-form"
          >
            <DialogHeader>
              <DialogTitle className="text-lg">
                {editingId !== null ? 'Edit Project' : 'Create Project'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={(event) => {
                  void handleSubmit(event);
                }}
                className="flex-1 flex flex-col gap-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Project Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Solar install"
                          maxLength={PROJECT_NAME_MAX_LEN}
                          {...field}
                          className="h-12 rounded-xl text-base"
                          data-testid="input-project-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">
                        Short key (optional, up to {PROJECT_KEY_MAX_LEN} characters)
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. SOLAR"
                          maxLength={PROJECT_KEY_MAX_LEN}
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            field.onChange(e.target.value.toUpperCase());
                          }}
                          className="h-12 rounded-xl text-base uppercase"
                          data-testid="input-project-key"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <ColorPicker
                          value={field.value ?? DEFAULT_PROJECT_COLOR}
                          onChange={(color) => {
                            field.onChange(color.startsWith('#') ? color : DEFAULT_PROJECT_COLOR);
                          }}
                          label="Project Color"
                        />
                      </FormControl>
                    </FormItem>
                  )}
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
                    disabled={createProject.isPending || updateProject.isPending}
                    data-testid="button-submit-project"
                  >
                    {editingId !== null ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-sm text-muted-foreground">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          No projects yet. Create one and a project selector appears in the board header.
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between gap-3 p-3 neo-card rounded-xl"
              data-testid={`project-row-${project.id}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="w-6 h-6 shrink-0 rounded-lg"
                  style={{ backgroundColor: project.color ?? DEFAULT_PROJECT_COLOR }}
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-sm">
                    <span className="truncate">{project.name}</span>
                    {project.key && (
                      <Badge
                        variant="secondary"
                        className="h-5 min-h-0 min-w-0 px-1.5 py-0 font-mono text-[10px] neo-pressed"
                      >
                        {project.key}
                      </Badge>
                    )}
                    {project.archived && (
                      <Badge
                        variant="outline"
                        className="h-5 min-h-0 min-w-0 px-1.5 py-0 text-[10px] font-normal"
                      >
                        Archived
                      </Badge>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {project.taskCount} {project.taskCount === 1 ? 'task' : 'tasks'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => {
                    openEdit(project);
                  }}
                  aria-label={`Edit ${project.name}`}
                  data-testid={`button-edit-project-${project.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => {
                    toggleArchived(project);
                  }}
                  disabled={updateProject.isPending}
                  aria-label={
                    project.archived ? `Unarchive ${project.name}` : `Archive ${project.name}`
                  }
                  data-testid={`button-archive-project-${project.id}`}
                >
                  {project.archived ? (
                    <ArchiveRestore className="w-4 h-4" />
                  ) : (
                    <Archive className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => {
                    setPendingDelete(project);
                  }}
                  disabled={deleteProject.isPending}
                  aria-label={`Delete ${project.name}`}
                  data-testid={`button-delete-project-${project.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” will be removed. Its {pendingDelete?.taskCount ?? 0}{' '}
              {pendingDelete?.taskCount === 1 ? 'task stays' : 'tasks stay'} on the board with no
              project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} data-testid="button-confirm-delete-project">
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
