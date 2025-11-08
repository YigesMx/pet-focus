import "./App.css";

import { useState } from "react";

import { BottomNav } from "@/app/navigation/bottom-nav";
import { FocusPage, SettingsPage, StatsPage, TodosPage, type Page } from "@/app/pages";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("todos");

  const renderPage = () => {
    switch (currentPage) {
      case "todos":
        return <TodosPage />;
      case "focus":
        return <FocusPage />;
      case "stats":
        return <StatsPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10 pb-24">
        {renderPage()}
        </div>
      </div>

      <BottomNav currentPage={currentPage} onSelect={setCurrentPage} />
    </div>
  );
}

export default App;
