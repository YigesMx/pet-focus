import { type ReactNode } from "react"
import { CheckCircle2, Clock, BarChart3, Settings } from "lucide-react"

import type { Page } from "@/pages"

const NAV_ITEMS: Array<{ page: Page; label: string; icon: ReactNode }> = [
  { page: "todos", label: "待办", icon: <CheckCircle2 className="size-5" aria-hidden="true" /> },
  { page: "focus", label: "专注", icon: <Clock className="size-5" aria-hidden="true" /> },
  { page: "stats", label: "统计", icon: <BarChart3 className="size-5" aria-hidden="true" /> },
  { page: "settings", label: "设置", icon: <Settings className="size-5" aria-hidden="true" /> },
]

interface BottomNavProps {
  currentPage: Page
  onSelect: (page: Page) => void
}

export function BottomNav({ currentPage, onSelect }: BottomNavProps) {
  return (
    <nav className="sticky bottom-0 border-t bg-background">
      <div className="mx-auto w-full max-w-2xl px-6 py-2">
        <div className="flex justify-around gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.page === currentPage
            return (
              <button
                key={item.page}
                type="button"
                onClick={() => onSelect(item.page)}
                className={
                  isActive
                    ? "flex flex-col items-center gap-1 rounded-lg px-4 py-2 text-primary transition"
                    : "flex flex-col items-center gap-1 rounded-lg px-4 py-2 text-muted-foreground transition hover:text-foreground"
                }
              >
                {item.icon}
                <span className="text-xs">{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
