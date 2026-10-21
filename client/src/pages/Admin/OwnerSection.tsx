import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, ArchiveRestore, Edit, Trash2 } from 'lucide-react';
import { insertOwnerSchema, type InsertOwner, type OwnerSummary } from '@shared/schema';
import { DEFAULT_OWNER_COLOR, OWNER_KEY_MAX_LEN, OWNER_NAME_MAX_LEN } from '@shared/constants';
import { useCreateOwner, useDeleteOwner, useUpdateOwner } from '@/hooks/use-owners';
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

export interface OwnerSectionProps {
  owners: OwnerSummary[];
  isLoading: boolean;
}

const emptyForm = (): InsertOwner => ({ name: '', key: null, color: DEFAULT_OWNER_COLOR });

/**
 * Admin card for owners: create, rename, recolour, archive and delete.
 *
 * This is the only place a person is named, which is the point of EPIC-06 — a
 * rename here is one write that reaches every task and every lane bound to
 * them, where before the name was copied into each row that mentioned it.
 * Deleting an owner releases their tasks (they stay on the board, Unassigned)
 * and unbinds their lanes, so only the delete asks first.
 */
export function OwnerSection({ owners, isLoading }: OwnerSectionProps) {
  const { toast } = useToast();
  const createOwner = useCreateOwner();
  const updateOwner = useUpdateOwner();
  const deleteOwner = useDeleteOwner();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OwnerSummary | null>(null);

  const form = useForm<InsertOwner>({
    resolver: zodResolver(insertOwnerSchema),
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
      updateOwner.mutate(
        { id: editingId, ...data },
        {
          onSuccess: () => {
            toast({ description: 'Owner updated everywhere it appears' });
            closeDialog();
          },
          onError: (error) => {
            fail(error, 'Failed to update owner');
          },
        },
      );
    } else {
      createOwner.mutate(data, {
        onSuccess: () => {
          toast({ description: 'Owner created' });
          closeDialog();
        },
        onError: (error) => {
          fail(error, 'Failed to create owner');
        },
      });
    }
  });

  const openEdit = (owner: OwnerSummary) => {
    setEditingId(owner.id);
    form.reset({
      name: owner.name,
      key: owner.key,
      color: owner.color ?? DEFAULT_OWNER_COLOR,
    });
    setDialogOpen(true);
  };

  const toggleArchived = (owner: OwnerSummary) => {
    updateOwner.mutate(
      { id: owner.id, archived: !owner.archived },
      {
        onSuccess: () => {
          toast({ description: owner.archived ? 'Owner unarchived' : 'Owner archived' });
        },
        onError: (error) => {
          fail(error, 'Failed to update owner');
        },
      },
    );
  };

  const confirmDelete = () => {
    const owner = pendingDelete;
    setPendingDelete(null);
    if (!owner) return;
    deleteOwner.mutate(owner.id, {
      onSuccess: () => {
        toast({
          description: `“${owner.name}” deleted. Their tasks stay on the board, Unassigned.`,
        });
      },
      onError: (error) => {
        fail(error, 'Failed to delete owner');
      },
    });
  };

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-base font-semibold">Owners</h2>
          <p className="text-[10px] text-muted-foreground">
            Who work can be assigned to. Rename once here and every task follows. Archived owners
            leave the filter page.
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
              className="rounded-md h-10 active:scale-95 transition-transform"
              onClick={() => {
                setEditingId(null);
                form.reset(emptyForm());
              }}
              data-testid="button-add-owner"
            >
              Add Owner
            </Button>
          </DialogTrigger>
          <DialogContent
            className="max-w-full h-full max-h-full rounded-none m-0 flex flex-col"
            data-testid="dialog-owner-form"
          >
            <DialogHeader>
              <DialogTitle className="text-lg">
                {editingId !== null ? 'Edit Owner' : 'Create Owner'}
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
                      <FormLabel className="text-xs">Owner Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Rich"
                          maxLength={OWNER_NAME_MAX_LEN}
                          {...field}
                          className="h-12 rounded-md text-base"
                          data-testid="input-owner-name"
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
                        Initials (optional, up to {OWNER_KEY_MAX_LEN} characters) — shown on the
                        card when the name is too long for it
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. RC"
                          maxLength={OWNER_KEY_MAX_LEN}
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            field.onChange(e.target.value.toUpperCase());
                          }}
                          className="h-12 rounded-md text-base uppercase"
                          data-testid="input-owner-key"
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
                          value={field.value ?? DEFAULT_OWNER_COLOR}
                          onChange={(color) => {
                            field.onChange(color.startsWith('#') ? color : DEFAULT_OWNER_COLOR);
                          }}
                          label="Owner Color"
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
                    className="flex-1 h-12 rounded-md"
                    onClick={closeDialog}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-12 rounded-md active:scale-95 transition-transform"
                    disabled={createOwner.isPending || updateOwner.isPending}
                    data-testid="button-submit-owner"
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
        <div className="text-center py-6 text-sm text-muted-foreground">Loading owners...</div>
      ) : owners.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          No owners yet. Create one and it appears in every task&apos;s owner picker.
        </div>
      ) : (
        <div className="space-y-2">
          {owners.map((owner) => (
            <div
              key={owner.id}
              className="flex items-center justify-between gap-3 p-3 neo-card rounded-md"
              data-testid={`owner-row-${owner.id}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="w-6 h-6 shrink-0 rounded-lg"
                  style={{ backgroundColor: owner.color ?? DEFAULT_OWNER_COLOR }}
                />
                <div className="min-w-0">
                  {/* A div, not a p: the badges below render as divs, and a
                      div inside a p is invalid HTML the browser silently
                      restructures. */}
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <span className="truncate">{owner.name}</span>
                    {owner.key && (
                      <Badge
                        variant="secondary"
                        className="h-5 min-h-0 min-w-0 px-1.5 py-0 font-mono text-[10px] neo-pressed"
                      >
                        {owner.key}
                      </Badge>
                    )}
                    {owner.archived && (
                      <Badge
                        variant="outline"
                        className="h-5 min-h-0 min-w-0 px-1.5 py-0 text-[10px] font-normal"
                      >
                        Archived
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {owner.taskCount} {owner.taskCount === 1 ? 'task' : 'tasks'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-md"
                  onClick={() => {
                    openEdit(owner);
                  }}
                  aria-label={`Edit ${owner.name}`}
                  data-testid={`button-edit-owner-${owner.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-md"
                  onClick={() => {
                    toggleArchived(owner);
                  }}
                  disabled={updateOwner.isPending}
                  aria-label={owner.archived ? `Unarchive ${owner.name}` : `Archive ${owner.name}`}
                  data-testid={`button-archive-owner-${owner.id}`}
                >
                  {owner.archived ? (
                    <ArchiveRestore className="w-4 h-4" />
                  ) : (
                    <Archive className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-11 w-11 rounded-md"
                  onClick={() => {
                    setPendingDelete(owner);
                  }}
                  disabled={deleteOwner.isPending}
                  aria-label={`Delete ${owner.name}`}
                  data-testid={`button-delete-owner-${owner.id}`}
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
            <AlertDialogTitle>Delete this owner?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” will be removed. Their {pendingDelete?.taskCount ?? 0}{' '}
              {pendingDelete?.taskCount === 1 ? 'task stays' : 'tasks stay'} on the board as
              Unassigned, and any lane of theirs becomes a plain lane. Archive instead to keep the
              assignments and take them out of the picker.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} data-testid="button-confirm-delete-owner">
              Delete owner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
