import { type ReactNode, useCallback, useState, useEffect } from "react"
import { Loader2, Minimize2, XCircle, HelpCircle } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { CloseBehavior } from "@/features/settings/api/close-behavior.api"
import { getCloseBehavior, setCloseBehavior } from "@/features/settings/api/close-behavior.api"

const CLOSE_BEHAVIOR_OPTIONS: Array<{
  value: CloseBehavior
  label: string
  description: string
  icon: ReactNode
}> = [
  {
    value: "ask",
    label: "每次询问",
    description: "每次关闭时询问您的选择。",
    icon: <HelpCircle className="size-4" aria-hidden="true" />,
  },
  {
    value: "minimize",
    label: "最小化到托盘",
    description: "关闭窗口时隐藏到系统托盘，应用继续在后台运行。",
    icon: <Minimize2 className="size-4" aria-hidden="true" />,
  },
  {
    value: "quit",
    label: "退出应用",
    description: "关闭窗口时完全退出应用，包括桌面宠物。",
    icon: <XCircle className="size-4" aria-hidden="true" />,
  },
]

export function CloseBehaviorSelector() {
  const queryClient = useQueryClient()
  const [current, setCurrent] = useState<CloseBehavior>("ask")

  const { data, isLoading } = useQuery({
    queryKey: ["close-behavior"],
    queryFn: getCloseBehavior,
  })

  useEffect(() => {
    if (data) {
      setCurrent(data)
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: setCloseBehavior,
    onSuccess: (newBehavior) => {
      queryClient.setQueryData(["close-behavior"], newBehavior)
    },
  })

  const handleChange = useCallback(
    (value: string) => {
      if (mutation.isPending) return
      if (value !== "ask" && value !== "minimize" && value !== "quit") {
        console.error("Invalid close behavior value:", value)
        return
      }

      const previous = current
      setCurrent(value)

      mutation.mutate(value, {
        onError: (error) => {
          console.error(error)
          setCurrent(previous)
        },
      })
    },
    [current, mutation],
  )

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">加载中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h4 className="text-base font-semibold">关闭按钮行为</h4>
        {mutation.isPending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : null}
      </div>
      <RadioGroup
        value={current}
        onValueChange={handleChange}
        className="grid gap-3 sm:grid-cols-2"
        aria-label="选择关闭按钮行为"
      >
        {CLOSE_BEHAVIOR_OPTIONS.map((option) => (
          <label
            key={option.value}
            htmlFor={`close-behavior-${option.value}`}
            className="border-input hover:border-ring hover:bg-accent group flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition-colors"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id={`close-behavior-${option.value}`} value={option.value} />
              <span className="flex items-center gap-2 text-sm font-medium">
                {option.icon}
                {option.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{option.description}</p>
          </label>
        ))}
      </RadioGroup>
    </div>
  )
}
