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

function getNearestPriorityValue(priority: number | null): string {
  if (priority === null || priority === undefined) return "none"
  if (priority === 1) return "1"
  if (priority === 5) return "5"
  if (priority === 9) return "9"
  if (priority <= 3) return "1"
  if (priority <= 7) return "5"
  return "9"
}

export function TodoPriorityPicker({
  value,
  onChange,
  disabled = false,
}: TodoPriorityPickerProps) {
  const displayValue = useMemo(() => getNearestPriorityValue(value), [value])

  const handleValueChange = (nextValue: string) => {
    if (nextValue === "none") {
      onChange(null)
    } else {
      onChange(Number(nextValue))
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
