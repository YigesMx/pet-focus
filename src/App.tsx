import "./App.css";

import { useState } from "react";

import { BottomNav } from "@/components/app/bottom-nav";
import { FocusPage, SettingsPage, StatsPage, TodosPage, type Page } from "@/pages";

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
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
        {renderPage()}
      </div>

      <BottomNav currentPage={currentPage} onSelect={setCurrentPage} />
    </div>
  );
}

export default App;
