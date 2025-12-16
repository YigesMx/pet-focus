import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  quitApp,
  hideWindow,
  setCloseBehavior,
} from "@/features/settings/api/close-behavior.api"

interface CloseConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CloseConfirmationDialog({
  open,
  onOpenChange,
}: CloseConfirmationDialogProps) {
  const [rememberChoice, setRememberChoice] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleMinimize = async () => {
    setIsLoading(true)
    try {
      if (rememberChoice) {
        await setCloseBehavior("minimize")
      }
      await hideWindow()
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to minimize window:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuit = async () => {
    setIsLoading(true)
    try {
      if (rememberChoice) {
        await setCloseBehavior("quit")
      }
      await quitApp()
    } catch (error) {
      console.error("Failed to quit app:", error)
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>关闭应用</DialogTitle>
          <DialogDescription>
            您想要最小化到系统托盘还是完全退出应用？
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center space-x-2 py-4">
          <Checkbox
            id="remember-choice"
            checked={rememberChoice}
            onCheckedChange={(checked) => setRememberChoice(checked === true)}
          />
          <Label
            htmlFor="remember-choice"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            记住我的选择
          </Label>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleMinimize}
            disabled={isLoading}
          >
            最小化到托盘
          </Button>
          <Button
            variant="destructive"
            onClick={handleQuit}
            disabled={isLoading}
          >
            退出应用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
