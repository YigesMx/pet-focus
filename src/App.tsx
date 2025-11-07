import "./App.css";

import { TodoHeader } from "@/components/app/todo-header";
import { TodoList } from "@/components/todo/todo-list";
import { Card, CardContent } from "@/components/ui/card";
import { TimerPanel } from "@/components/timer/timer-panel";
import { useTodoManager } from "@/features/todo/use-todo-manager";
import { useWebServerControl } from "@/features/webserver/use-web-server-control";

function App() {
  const {
    todos,
    isLoading,
    isCreating,
    busyTodoIds,
    createTodo,
    toggleCompleted,
    updateTitle,
    updateDueDate,
    updateRemindBefore,
    deleteTodo,
  } = useTodoManager();

  const { isServerRunning, isServerBusy, isPlatformSupported, statusMessage, toggleApi } = useWebServerControl();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
        <TimerPanel />
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
              onUpdateDueDate={(id, dueDate) => {
                void updateDueDate(id, dueDate);
              }}
              onUpdateRemindBefore={(id, minutes) => {
                void updateRemindBefore(id, minutes);
              }}
              onDelete={(id) => {
                void deleteTodo(id);
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default App;
