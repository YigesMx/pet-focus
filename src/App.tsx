import "./App.css";

import { useEffect, useState } from "react";

import { BottomNav } from "@/app/navigation/bottom-nav";
import { FocusPage, SettingsPage, StatsPage, TodosPage, type Page } from "@/app/pages";
import { NotificationCenter } from "@/components/app/notification-center";

// 已完成的专注会话类型定义
export interface CompletedFocusSession {
  id: string;
  todoId: number;
  todoTitle: string;
  durationSeconds: number;
  completedAt: string;
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("todos");
  const [currentFocusTodoId, setCurrentFocusTodoId] = useState<number | null>(null);
  const [completedSessions, setCompletedSessions] = useState<CompletedFocusSession[]>([]);

  // 从 localStorage 加载已完成的会话
  useEffect(() => {
    try {
      const stored = localStorage.getItem("focusSessions");
      if (stored) {
        setCompletedSessions(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load focus sessions from localStorage:", error);
    }
  }, []);

  // 保存已完成的会话到 localStorage
  const saveCompletedSession = (session: CompletedFocusSession) => {
    const updated = [...completedSessions, session];
    setCompletedSessions(updated);
    localStorage.setItem("focusSessions", JSON.stringify(updated));
  };

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
            onSessionComplete={(session) => {
              saveCompletedSession(session);
              setCurrentFocusTodoId(null);
              setCurrentPage("stats");
            }}
            onCancel={() => {
              setCurrentFocusTodoId(null);
              setCurrentPage("todos");
            }}
          />
        );
      case "stats":
        return <StatsPage completedSessions={completedSessions} />;
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
