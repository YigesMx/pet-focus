import { toast } from "sonner"

export function reportError(message: string, error: unknown) {
  const details =
    error instanceof Error ? error.message : typeof error === "string" ? error : "未知错误"
  toast.error(`${message}：${details}`)
}
