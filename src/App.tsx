import "./App.css";

import { useEffect, useState } from "react";

import { BottomNav } from "@/app/navigation/bottom-nav";
import { FocusPage, SettingsPage, StatsPage, TodosPage, type Page } from "@/app/pages";
import { NotificationCenter } from "@/components/app/notification-center";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("todos");
  const [currentFocusTodoId, setCurrentFocusTodoId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // 在 App 级别监听会话记录更新事件，确保无论在哪个页面都能接收到
  useEffect(() => {
    console.log("App: 开始监听 pomodoro-session-recorded 事件");
    
    const unlisten = listen("pomodoro-session-recorded", () => {
      console.log("App: 收到 pomodoro-session-recorded 事件，刷新会话数据");
      // 刷新所有 pomodoro 相关的查询
      queryClient.invalidateQueries({ queryKey: ["pomodoro-sessions"] }); // 旧的
      queryClient.invalidateQueries({ queryKey: ["pomodoro"] }); // 新的所有查询
    });

    return () => {
      console.log("App: 清理事件监听器");
      unlisten.then((fn) => fn());
    };
  }, [queryClient]);

  const renderPage = () => {
    switch (currentPage) {
      case "todos":
        return (
          <TodosPage
            onStartFocus={(todoId) => {
              setCurrentFocusTodoId(todoId);
              setCurrentPage("focus");
            }}
          />
        );
      case "focus":
        return (
          <FocusPage
            focusTodoId={currentFocusTodoId}
            onCancel={() => {
              setCurrentFocusTodoId(null);
              setCurrentPage("todos");
            }}
          />
        );
      case "stats":
        return <StatsPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* 统一的通知管理中心 */}
      <NotificationCenter />

      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10 pb-24">
          {renderPage()}
          </div>
        </div>

        <BottomNav currentPage={currentPage} onSelect={setCurrentPage} />
      </div>
    </>
  );
}

export default App;
