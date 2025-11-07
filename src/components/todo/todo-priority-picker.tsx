import { useMemo } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface TodoPriorityPickerProps {
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
}

const PRIORITY_OPTIONS = [
  { label: "无", value: null },
  { label: "低", value: 9 },
  { label: "中", value: 5 },
  { label: "高", value: 1 },
] as const

/**
 * 将任意优先级值映射到最接近的选项值
 * 用于显示时确定应该激活哪个 tab
 */
function getNearestPriorityValue(priority: number | null): string {
  if (priority === null || priority === undefined) return "none"
  
  // 精确匹配
  if (priority === 1) return "1"
  if (priority === 5) return "5"
  if (priority === 9) return "9"
  
  // 找到最接近的值
  if (priority <= 3) return "1" // 1-3 显示为"高"
  if (priority <= 7) return "5" // 4-7 显示为"中"
  return "9" // 8-9 显示为"低"
}

export function TodoPriorityPicker({
  value,
  onChange,
  disabled = false,
}: TodoPriorityPickerProps) {
  // 计算当前应该显示的 tab 值
  const displayValue = useMemo(() => {
    return getNearestPriorityValue(value)
  }, [value])

  const handleValueChange = (newValue: string) => {
    if (newValue === "none") {
      onChange(null)
    } else {
      onChange(Number(newValue))
    }
  }

  return (
    <Tabs value={displayValue} onValueChange={handleValueChange}>
      <TabsList className="w-full">
        {PRIORITY_OPTIONS.map((option) => (
          <TabsTrigger
            key={option.value ?? "none"}
            value={option.value?.toString() ?? "none"}
            disabled={disabled}
            className="flex-1"
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
