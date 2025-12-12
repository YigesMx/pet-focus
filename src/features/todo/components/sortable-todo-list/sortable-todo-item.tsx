import { type CSSProperties } from "react"
import { useSortable, type AnimateLayoutChanges } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { TodoItem } from "../todo-item"
import type { SortableTodoItemProps } from "./types"

// 禁用拖放过程中和结束时的布局动画，避免元素闪烁抖动
const animateLayoutChanges: AnimateLayoutChanges = ({ isSorting, wasDragging }) =>
  isSorting || wasDragging ? false : true

export function SortableTodoItem({
  id,
  todo,
  depth,
  hasChildren,
  isExpanded,
  busyTodoIds,
  clone,
  toggleExpanded,
  onToggleCompleted,
  onUpdateTitle,
  onOpenDetails,
  onDelete,
  onAddSubtask,
  onStartFocus,
  onUpdateDueDate,
  openActionId,
  setOpenActionId,
}: SortableTodoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: busyTodoIds.has(id) || clone,
    animateLayoutChanges,
  })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    paddingLeft: `${depth * 32}px`,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-50" : ""}
    >
      <div
        {...attributes}
        {...listeners}
        style={{
          touchAction: 'none',
        }}
      >
        <TodoItem
          todo={todo}
          hasChildren={hasChildren}
          isExpanded={isExpanded}
          onToggleExpand={() => !clone && toggleExpanded(todo.id)}
          onAddSubtask={() => !clone && onAddSubtask(todo.id)}
          moreActionsOpen={openActionId === todo.id}
          setMoreActionsOpen={(open) => !clone && setOpenActionId(open ? todo.id : null)}
          disabled={busyTodoIds.has(todo.id) || clone}
          onToggleCompleted={onToggleCompleted}
          onUpdateTitle={onUpdateTitle}
          onOpenDetails={onOpenDetails}
          onDelete={onDelete}
          onStartFocus={onStartFocus}
          onUpdateDueDate={onUpdateDueDate}
        />
      </div>
    </li>
  )
}
