import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react"
import { Play, Trash, X, ChevronDown, ChevronRight, CalendarClock, Ellipsis, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Checkbox } from "@/components/ui/checkbox"
import { TodoDueDatePicker } from "@/features/todo/components/todo-due-date-picker"

import type { Todo } from "@/features/todo/types/todo.types"

type TodoItemProps = {
  todo: Todo
  hasChildren: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onAddSubtask: () => void
  moreActionsOpen: boolean
  setMoreActionsOpen: (open: boolean) => void
  disabled?: boolean
  onToggleCompleted: (id: number, completed: boolean) => void
  onUpdateTitle: (id: number, title: string) => void
  onOpenDetails: (todo: Todo) => void
  onDelete: (id: number) => void
  onStartFocus?: (todoId: number) => void
  onUpdateDueDate?: (id: number, dueDate: string | null, reminderOffsetMinutes?: number | null) => void
}

export function TodoItem({
  todo,
  hasChildren,
  isExpanded,
  onToggleExpand,
  onAddSubtask,
  moreActionsOpen,
  setMoreActionsOpen,
  disabled = false,
  onToggleCompleted,
  onUpdateTitle,
  onOpenDetails,
  onDelete,
  onStartFocus,
  onUpdateDueDate,
}: TodoItemProps) {
  const [draftTitle, setDraftTitle] = useState(todo.title)

  useEffect(() => {
    setDraftTitle(todo.title)
  }, [todo.title])

  const handleBlur = () => {
    const normalized = draftTitle.trim()
    if (normalized !== todo.title) {
      onUpdateTitle(todo.id, normalized)
    }
  }

  const handleToggle = (checked: true | false) => {
    onToggleCompleted(todo.id, checked === true)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraftTitle(event.target.value)
  }

  const handleDueDateChange = useCallback((value: string | null) => {
    if (onUpdateDueDate) {
      onUpdateDueDate(todo.id, value, todo.reminder_offset_minutes)
    }
  }, [todo.id, todo.reminder_offset_minutes, onUpdateDueDate])

  const handleReminderOffsetChange = useCallback((minutes: number) => {
    if (onUpdateDueDate) {
      onUpdateDueDate(todo.id, todo.due_date, minutes)
    }
  }, [todo.id, todo.due_date, onUpdateDueDate])

  const dueLabel = useMemo(() => {
    if (!todo.due_date) return null
    const date = new Date(todo.due_date)
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }, [todo.due_date])

  const hasDueTime = !!todo.due_date

  return (
    <ButtonGroup className="flex justify-between w-full">
      <ButtonGroup className="flex-none">
        {hasChildren && (
          <Button
            variant="outline"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
          >
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        )}
        {(!hasChildren || isExpanded) && (
          <Button
            variant="outline"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              onAddSubtask()
            }}
          >
            <Plus className="size-4" />
          </Button>
        )}
      </ButtonGroup>
      <ButtonGroup className="grow">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <Checkbox
              checked={todo.completed}
              onCheckedChange={handleToggle}
              disabled={disabled}
            />
          </InputGroupAddon>
          <InputGroupInput
            value={draftTitle}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Todo Title"
            className="text-ellipsis"
            disabled={disabled}
          />
          {!moreActionsOpen && (
            <InputGroupAddon align="inline-end">
              {onUpdateDueDate ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <TodoDueDatePicker
                    value={todo.due_date}
                    onChange={handleDueDateChange}
                    reminderOffsetMinutes={todo.reminder_offset_minutes ?? 15}
                    onReminderOffsetChange={handleReminderOffsetChange}
                    isCompleted={todo.completed}
                    isNotified={todo.notified}
                    disabled={disabled}
                  />
                </div>
              ) : (
                <InputGroupButton
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenDetails(todo)
                  }}
                >
                  {hasDueTime ? (
                    <span className="text-xs">{dueLabel}</span>
                  ) : (
                    <CalendarClock className="size-4" />
                  )}
                </InputGroupButton>
              )}
            </InputGroupAddon>
          )}
        </InputGroup>
      </ButtonGroup>
      {moreActionsOpen && (
        <>
          <ButtonGroup>
            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(todo.id)
              }}
            >
              <Trash className="size-4" />
            </Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                if (onStartFocus) onStartFocus(todo.id)
              }}
            >
              <Play className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onOpenDetails(todo)
              }}
            >
              <Ellipsis className="size-4" />
            </Button>
          </ButtonGroup>
        </>
      )}
      <ButtonGroup>
        <Button
          variant={moreActionsOpen ? "default" : "outline"}
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            setMoreActionsOpen(!moreActionsOpen)
          }}
        >
          {moreActionsOpen ? <X className="size-4" /> : <Ellipsis className="size-4" />}
        </Button>
      </ButtonGroup>
    </ButtonGroup>
  )
}
