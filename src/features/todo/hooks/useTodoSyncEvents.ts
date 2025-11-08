import { useEffect } from "react"
import { listen } from "@tauri-apps/api/event"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { todoKeys } from "@/features/todo/api/todo.keys"

type TodoSyncEvent = {
  action?: string
  todoId?: number | null
  source?: "local" | "webserver"
}

export function useTodoSyncEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let disposed = false
    let unsubscribe: (() => void) | null = null

    const setup = async () => {
      try {
        const off = await listen<TodoSyncEvent>("todo-data-updated", (event) => {
          if (disposed) return
          if (event.payload?.source !== "webserver") {
            return
          }

          void queryClient.invalidateQueries({ queryKey: todoKeys.all })

          switch (event.payload?.action) {
            case "created":
              toast.info("收到新待办 (外部)")
              break
            case "updated":
              toast.info("待办内容已更新 (外部)")
              break
            case "deleted":
              toast.info("待办已删除 (外部)")
              break
            default:
              toast.info("待办列表来自外部更新")
              break
          }
        })

        if (disposed) {
          off()
        } else {
          unsubscribe = off
        }
      } catch (error) {
        console.error("监听待办同步事件失败", error)
      }
    }

    void setup()

    return () => {
      disposed = true
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [queryClient])
}
