import "./App.css";

import { useCallback, useMemo, useState } from "react";

import { CalDavSettings } from "@/components/app/caldav-settings";
import { TodoHeader } from "@/components/app/todo-header";
import { TodoDetailDialog } from "@/components/todo/todo-detail-dialog";
import { TodoList } from "@/components/todo/todo-list";
import { Card, CardContent } from "@/components/ui/card";
import { useTodoManager } from "@/features/todo/use-todo-manager";
import { useWebServerControl } from "@/features/webserver/use-web-server-control";
import type { Todo } from "@/types/todo";

function App() {
  const {
    todos,
    isLoading,
    isCreating,
    busyTodoIds,
    createTodo,
    toggleCompleted,
    updateTitle,
    updateDetails,
    deleteTodo,
  } = useTodoManager();

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTodoId, setDetailTodoId] = useState<number | null>(null);

  const activeTodo = useMemo<Todo | null>(() => {
    if (detailTodoId === null) return null;
    return todos.find((item) => item.id === detailTodoId) ?? null;
  }, [detailTodoId, todos]);

  const handleOpenDetails = useCallback((todo: Todo) => {
    setDetailTodoId(todo.id);
    setDetailOpen(true);
  }, []);

  const handleDetailOpenChange = useCallback((open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      setDetailTodoId(null);
    }
  }, []);

  const handleSubmitDetails = useCallback(
    async (id: number, payload: Parameters<typeof updateDetails>[1]) => {
      await updateDetails(id, payload);
    },
    [updateDetails],
  );

  const { isServerRunning, isServerBusy, isPlatformSupported, statusMessage, toggleApi } = useWebServerControl();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
        <CalDavSettings />
        <Card>
          <TodoHeader
            isCreating={isCreating}
            onCreateTodo={() => {
              void createTodo();
            }}
            isServerRunning={isServerRunning}
            isServerBusy={isServerBusy}
            isPlatformSupported={isPlatformSupported}
            statusMessage={statusMessage}
            onToggleApi={(nextEnabled) => {
              void toggleApi(nextEnabled);
            }}
          />
          <CardContent className="pb-6">
            <TodoList
              todos={todos}
              isLoading={isLoading}
              busyTodoIds={busyTodoIds}
              onToggleCompleted={(id, completed) => {
                void toggleCompleted(id, completed);
              }}
              onUpdateTitle={(id, title) => {
                void updateTitle(id, title);
              }}
              onOpenDetails={handleOpenDetails}
              onDelete={(id) => {
                void deleteTodo(id);
              }}
            />
          </CardContent>
        </Card>
      </div>

      <TodoDetailDialog
        todo={activeTodo}
        open={detailOpen}
        onOpenChange={handleDetailOpenChange}
        onSubmit={handleSubmitDetails}
        isSubmitting={activeTodo ? busyTodoIds.has(activeTodo.id) : false}
      />
    </div>
  );
}

export default App;
