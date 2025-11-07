import "./App.css";

import { useCallback, useMemo, useState } from "react";

import { CalDavSettings, ExternalApiToggle, TodoHeader, FocusTimer } from "@/components/app";
import { TodoDetailDialog } from "@/components/todo/todo-detail-dialog";
import { TodoList } from "@/components/todo/todo-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTodoManager } from "@/features/todo/use-todo-manager";
import { useWebServerControl } from "@/features/webserver/use-web-server-control";
import { CheckCircle2, Clock, BarChart3, Settings } from "lucide-react";
import type { Todo } from "@/types/todo";

type Page = "todos" | "focus" | "stats" | "settings";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("todos");

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
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
        <Card>
          {currentPage === "todos" && (
            <TodoHeader
              isCreating={isCreating}
              onCreateTodo={() => {
                void createTodo();
              }}
            />
          )}
          <CardContent className="pb-6">
            {currentPage === "todos" && (
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
            )}
            {currentPage === "focus" && <FocusTimer initialDuration={25 * 60} />}
            {currentPage === "stats" && (
              <div className="py-12 text-center text-muted-foreground">统计页面（开发中）</div>
            )}
            {currentPage === "settings" && (
              <div className="space-y-6">
                {/* CalDav 同步设置 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">日历同步</h3>
                  <CalDavSettings />
                </div>

                {/* Websocket API 设置 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">外部API</h3>
                  <ExternalApiToggle
                    isRunning={isServerRunning}
                    isBusy={isServerBusy}
                    isPlatformSupported={isPlatformSupported}
                    statusMessage={statusMessage}
                    onToggle={(nextEnabled) => {
                      void toggleApi(nextEnabled);
                    }}
                  />
                </div>
              </div>
            )}
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

      {/* 底部导航栏 */}
      <div className="border-t bg-background sticky bottom-0">
        <div className="mx-auto w-full max-w-2xl px-6 py-2">
          <div className="flex gap-1 justify-around">
            <button
              onClick={() => setCurrentPage("todos")}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
                currentPage === "todos"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="size-5" />
              <span className="text-xs">待办</span>
            </button>
            <button
              onClick={() => setCurrentPage("focus")}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
                currentPage === "focus"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="size-5" />
              <span className="text-xs">专注</span>
            </button>
            <button
              onClick={() => setCurrentPage("stats")}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
                currentPage === "stats"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="size-5" />
              <span className="text-xs">统计</span>
            </button>
            <button
              onClick={() => setCurrentPage("settings")}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
                currentPage === "settings"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings className="size-5" />
              <span className="text-xs">设置</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
