import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertTask } from "@shared/routes";
import { Task } from "@shared/schema";

export function useTasks() {
  return useQuery({
    queryKey: [api.tasks.list.path],
    queryFn: async () => {
      try {
        const res = await fetch(api.tasks.list.path);
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to fetch tasks: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`);
        }
        return api.tasks.list.responses[200].parse(await res.json());
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error("Network error: Unable to connect to server. Please check if the server is running.");
        }
        throw error;
      }
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: InsertTask) => {
      try {
        const res = await fetch(api.tasks.create.path, {
          method: api.tasks.create.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(task),
        });
        if (!res.ok) {
          let errorMessage = "Failed to create task";
          try {
            const error = await res.json();
            errorMessage = error.message || errorMessage;
          } catch {
            errorMessage = `${res.status} ${res.statusText}`;
          }
          throw new Error(errorMessage);
        }
        return api.tasks.create.responses[201].parse(await res.json());
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error("Network error: Unable to connect to server. Please check if the server is running.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertTask>) => {
      try {
        const url = api.tasks.update.path.replace(":id", id.toString());
        
        const res = await fetch(url, {
          method: api.tasks.update.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        
        if (!res.ok) {
          let errorMessage = "Failed to update task";
          try {
            const error = await res.json();
            errorMessage = error.message || errorMessage;
          } catch {
            errorMessage = `${res.status} ${res.statusText}`;
          }
          throw new Error(errorMessage);
        }
        return api.tasks.update.responses[200].parse(await res.json());
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error("Network error: Unable to connect to server. Please check if the server is running.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      try {
        const url = api.tasks.delete.path.replace(":id", id.toString());
        const res = await fetch(url, {
          method: api.tasks.delete.method,
        });
        
        if (!res.ok) {
          let errorMessage = "Failed to delete task";
          try {
            const error = await res.json();
            errorMessage = error.message || errorMessage;
          } catch {
            errorMessage = `${res.status} ${res.statusText}`;
          }
          throw new Error(errorMessage);
        }
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error("Network error: Unable to connect to server. Please check if the server is running.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
    },
  });
}

export function useArchivedTasks() {
  return useQuery({
    queryKey: [api.tasks.archived.path],
    queryFn: async () => {
      try {
        const res = await fetch(api.tasks.archived.path);
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to fetch archived tasks: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`);
        }
        return api.tasks.archived.responses[200].parse(await res.json());
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error("Network error: Unable to connect to server. Please check if the server is running.");
        }
        throw error;
      }
    },
  });
}

export function useArchiveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      try {
        const url = api.tasks.archive.path.replace(":id", id.toString());
        const res = await fetch(url, {
          method: api.tasks.archive.method,
        });
        if (!res.ok) {
          let errorMessage = "Failed to archive task";
          try {
            const error = await res.json();
            errorMessage = error.message || errorMessage;
          } catch {
            errorMessage = `${res.status} ${res.statusText}`;
          }
          throw new Error(errorMessage);
        }
        return api.tasks.archive.responses[200].parse(await res.json());
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error("Network error: Unable to connect to server. Please check if the server is running.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.tasks.archived.path] });
    },
  });
}

export function useUnarchiveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      try {
        const url = api.tasks.unarchive.path.replace(":id", id.toString());
        const res = await fetch(url, {
          method: api.tasks.unarchive.method,
        });
        if (!res.ok) {
          let errorMessage = "Failed to unarchive task";
          try {
            const error = await res.json();
            errorMessage = error.message || errorMessage;
          } catch {
            errorMessage = `${res.status} ${res.statusText}`;
          }
          throw new Error(errorMessage);
        }
        return api.tasks.unarchive.responses[200].parse(await res.json());
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error("Network error: Unable to connect to server. Please check if the server is running.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.tasks.archived.path] });
    },
  });
}
