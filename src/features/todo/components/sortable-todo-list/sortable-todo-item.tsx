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
  isLastInLevel,
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
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-50" : ""}
    >
      <div className="relative flex">
        {/* 渲染层级缩进和参考线 */}
        {depth > 0 && (
          <>
            {Array.from({ length: depth }).map((_, index) => {
              // 如果这个层级是最后一个，只显示上半部分的线
              const isLastAtThisLevel = isLastInLevel[index]
              return (
                <div
                  key={index}
                  className="relative shrink-0"
                  style={{ width: '32px' }}
                >
                  {/* 垂直连接线 - 延伸到上下，覆盖 gap */}
                  {/* 拖动中(isDragging)或克隆元素(clone)时不显示参考线 */}
                  {!isDragging && !clone && (
                    <div 
                      className="absolute left-4 w-px bg-border/40"
                      style={{
                        top: '-0.25rem',
                        bottom: isLastAtThisLevel ? '50%' : '-0.25rem',
                      }}
                    />
                  )}
                </div>
              )
            })}
          </>
        )}
        <div
          className="flex-1 min-w-0"
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
      </div>
    </li>
  )
}
