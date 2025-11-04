import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";

import { createTodo, deleteTodo, listTodos, updateTodo, updateTodoDueDate } from "@/lib/todo-api";
import { reportError } from "@/lib/report-error";
import type { Todo } from "@/types/todo";

type TodoSyncEvent = {
  action?: string;
  todoId?: number | null;
};

export function useTodoManager() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [busyTodoIds, setBusyTodoIds] = useState<Set<number>>(new Set());

  const sortTodos = useCallback((items: Todo[]) => {
    return [...items].sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      const aTime = Date.parse(a.updated_at);
      const bTime = Date.parse(b.updated_at);
      return bTime - aTime;
    });
  }, []);

  const toggleBusy = useCallback((id: number, busy: boolean) => {
    setBusyTodoIds((previous) => {
      const next = new Set(previous);
      if (busy) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const loadTodos = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listTodos();
      setTodos(sortTodos(data));
    } catch (error) {
      reportError("加载待办失败", error);
    } finally {
      setIsLoading(false);
    }
  }, [sortTodos]);

  useEffect(() => {
    void loadTodos();
  }, [loadTodos]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const unsubscribe = await listen<TodoSyncEvent>("todo-data-updated", (event) => {
          if (disposed) return;
          switch (event.payload?.action) {
            case "created":
              toast.info("收到新待办 (外部)");
              break;
            case "updated":
              toast.info("待办内容已更新 (外部)");
              break;
            case "deleted":
              toast.info("待办已被删除 (外部)");
              break;
            default:
              toast.info("待办数据已变更 (外部)");
              break;
          }
          void loadTodos();
        });

        if (disposed) {
          unsubscribe();
        } else {
          unlisten = unsubscribe;
        }
      } catch (error) {
        console.error("监听待办同步事件失败", error);
      }
    };

    void setupListener();

    return () => {
      disposed = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, [loadTodos]);

  const createTodoEntry = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const todo = await createTodo();
      setTodos((previous) => sortTodos([todo, ...previous]));
      toast.success("已创建新的待办事项");
    } catch (error) {
      reportError("创建待办失败", error);
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, sortTodos]);

  const toggleCompleted = useCallback(
    async (id: number, completed: boolean) => {
      toggleBusy(id, true);
      try {
        const updated = await updateTodo(id, { completed });
        setTodos((previous) =>
          sortTodos(previous.map((todo) => (todo.id === id ? updated : todo))),
        );
      } catch (error) {
        reportError("更新完成状态失败", error);
      } finally {
        toggleBusy(id, false);
      }
    },
    [sortTodos, toggleBusy],
  );

  const updateTitle = useCallback(
    async (id: number, title: string) => {
      toggleBusy(id, true);
      try {
        const updated = await updateTodo(id, { title });
        setTodos((previous) =>
          sortTodos(previous.map((todo) => (todo.id === id ? updated : todo))),
        );
      } catch (error) {
        reportError("更新待办内容失败", error);
      } finally {
        toggleBusy(id, false);
      }
    },
    [sortTodos, toggleBusy],
  );

  const deleteTodoEntry = useCallback(
    async (id: number) => {
      toggleBusy(id, true);
      try {
        await deleteTodo(id);
        setTodos((previous) => previous.filter((todo) => todo.id !== id));
        toast.success("已删除待办");
      } catch (error) {
        reportError("删除待办失败", error);
      } finally {
        toggleBusy(id, false);
      }
    },
    [toggleBusy],
  );

  const updateDueDate = useCallback(
    async (id: number, dueDate: string | null) => {
      toggleBusy(id, true);
      try {
        const updated = await updateTodoDueDate(id, dueDate);
        setTodos((previous) =>
          sortTodos(previous.map((todo) => (todo.id === id ? updated : todo))),
        );
        toast.success(dueDate ? "已设置到期日期" : "已清除到期日期");
      } catch (error) {
        reportError("更新到期日期失败", error);
      } finally {
        toggleBusy(id, false);
      }
    },
    [sortTodos, toggleBusy],
  );

  const busyIdsMemo = useMemo(() => new Set(busyTodoIds), [busyTodoIds]);

  return {
    todos,
    isLoading,
    isCreating,
    busyTodoIds: busyIdsMemo,
    createTodo: createTodoEntry,
    toggleCompleted,
    updateTitle,
    updateDueDate,
    deleteTodo: deleteTodoEntry,
  };
}
