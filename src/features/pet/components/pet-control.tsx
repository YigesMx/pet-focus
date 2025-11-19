import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, PawPrint } from "lucide-react"
import { toast } from "sonner"

export function PetControl() {
  const [isRunning, setIsRunning] = useState(false)
  const [isAutoStart, setIsAutoStart] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      const [status, autoStart] = await Promise.all([
        invoke<boolean>("pet_status"),
        invoke<boolean>("get_pet_auto_start"),
      ])
      setIsRunning(status)
      setIsAutoStart(autoStart)
    } catch (error) {
      console.error("Failed to get pet status:", error)
    }
  }

  const togglePet = async () => {
    setIsLoading(true)
    try {
      if (isRunning) {
        await invoke("pet_stop")
        setIsRunning(false)
        toast.success("宠物已关闭")
      } else {
        await invoke("pet_start")
        setIsRunning(true)
        toast.success("宠物已启动")
      }
    } catch (error) {
      console.error("Failed to toggle pet:", error)
      toast.error(`操作失败: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleAutoStart = async (checked: boolean) => {
    try {
      await invoke("set_pet_auto_start", { enabled: checked })
      setIsAutoStart(checked)
      toast.success(checked ? "已开启开机自启" : "已关闭开机自启")
    } catch (error) {
      console.error("Failed to toggle auto start:", error)
      toast.error("设置失败")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
        <div className="flex items-center space-x-4">
          <div className="rounded-full bg-primary/10 p-2">
            <PawPrint className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-0.5">
            <Label className="text-base">桌面宠物</Label>
            <p className="text-sm text-muted-foreground">
              {isRunning ? "宠物正在运行中" : "宠物已休息"}
            </p>
          </div>
        </div>
        <Button
          variant={isRunning ? "destructive" : "default"}
          onClick={togglePet}
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isRunning ? "关闭" : "启动"}
        </Button>
      </div>

      <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-base">跟随应用启动</Label>
          <p className="text-sm text-muted-foreground">
            启动应用时自动打开桌面宠物
          </p>
        </div>
        <Checkbox
          checked={isAutoStart}
          onCheckedChange={toggleAutoStart}
        />
      </div>
    </div>
  )
}
