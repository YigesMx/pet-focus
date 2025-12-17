import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

export function DebugClearDataButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  const handleClearData = async () => {
    setIsClearing(true)
    try {
      const result = await invoke<string>("debug_clear_all_user_data")
      toast.success("数据清理完成", {
        description: result,
      })
      setIsOpen(false)
      // 刷新页面以重新加载数据
      window.location.reload()
    } catch (error) {
      toast.error("清理失败", {
        description: String(error),
      })
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">清理所有用户数据</div>
          <div className="text-xs text-muted-foreground">
            删除所有专注记录、待办事项、标签、成就和金币数据
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setIsOpen(true)}
        >
          <Trash2 className="size-4 mr-1" />
          清理数据
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认清理所有数据？</DialogTitle>
            <DialogDescription>
              此操作将永久删除以下所有数据，且无法恢复：
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>所有专注会话和记录</li>
                <li>所有待办事项</li>
                <li>所有标签</li>
                <li>所有成就和金币</li>
                <li>所有统计数据</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isClearing}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearData}
              disabled={isClearing}
            >
              {isClearing ? (
                <>
                  <Loader2 className="size-4 mr-1 animate-spin" />
                  清理中...
                </>
              ) : (
                "确认清理"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
