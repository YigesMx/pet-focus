import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import "./App.css";

import { TodoList } from "@/components/todo/todo-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createTodo, deleteTodo, listTodos, updateTodo } from "@/lib/todo-api";
import type { Todo } from "@/types/todo";
import { toast } from "sonner";

function App() {
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

  const busyIdsMemo = useMemo(() => new Set(busyTodoIds), [busyTodoIds]);

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

  const handleCreateTodo = useCallback(async () => {
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

  const handleToggleCompleted = useCallback(
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

  const handleUpdateTitle = useCallback(
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

  const handleDeleteTodo = useCallback(
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

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="text-2xl font-semibold">待办清单</CardTitle>
              <CardDescription>使用宠物专注管理每日任务。</CardDescription>
            </div>
            <CardAction>
              <Button onClick={handleCreateTodo} disabled={isCreating}>
                {isCreating ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="mr-2 size-4" aria-hidden="true" />
                )}
                新建待办
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="pb-6">
            <TodoList
              todos={todos}
              isLoading={isLoading}
              busyTodoIds={busyIdsMemo}
              onToggleCompleted={(id, completed) => {
                void handleToggleCompleted(id, completed);
              }}
              onUpdateTitle={(id, title) => {
                void handleUpdateTitle(id, title);
              }}
              onDelete={(id) => {
                void handleDeleteTodo(id);
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function reportError(message: string, error: unknown) {
  const details =
    error instanceof Error ? error.message : typeof error === "string" ? error : "未知错误";
  toast.error(`${message}：${details}`);
}

export default App;
