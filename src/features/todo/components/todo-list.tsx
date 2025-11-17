import { useState } from "react"
import { ChevronDown, ChevronRight, ListTodo, Loader2 } from "lucide-react"
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core"

import type { Todo } from "@/features/todo/types/todo.types"

import { TodoItem } from "./todo-item"

type TodoListProps = {
  todos: Todo[]
  isLoading?: boolean
  busyTodoIds?: Set<number>
  onToggleCompleted: (id: number, completed: boolean) => void
  onUpdateTitle: (id: number, title: string) => void
  onOpenDetails: (todo: Todo) => void
  onDelete: (id: number) => void
  onUpdateParent: (id: number, parentId: number | null) => void
  onStartFocus?: (todoId: number) => void
}

type DropPosition = "before" | "after" | "child"

type DraggableTodoItemProps = {
  todo: Todo
  hasChildren: boolean
  isExpanded: boolean
  depth: number
  busyTodoIds: Set<number>
  expandedIds: Set<number>
  dropTarget: { id: number; position: DropPosition } | null
  childrenMap: Map<number, Todo[]>
  toggleExpanded: (id: number) => void
  onToggleCompleted: (id: number, completed: boolean) => void
  onUpdateTitle: (id: number, title: string) => void
  onOpenDetails: (todo: Todo) => void
  onDelete: (id: number) => void
  onStartFocus?: (todoId: number) => void
}

function DraggableTodoItem({
  todo,
  hasChildren,
  isExpanded,
  depth,
  busyTodoIds,
  expandedIds,
  dropTarget,
  childrenMap,
  toggleExpanded,
  onToggleCompleted,
  onUpdateTitle,
  onOpenDetails,
  onDelete,
  onStartFocus,
}: DraggableTodoItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `todo-${todo.id}`,
    data: { type: "todo", todoId: todo.id },
    disabled: busyTodoIds.has(todo.id),
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `todo-${todo.id}-child`,
    data: { type: "drop-child", todoId: todo.id, position: "child" as DropPosition },
  })

  const isDropChild = dropTarget?.id === todo.id && dropTarget.position === "child"
  const children = childrenMap.get(todo.id) || []

  return (
    <div>
      <div
        ref={(node) => {
          setNodeRef(node)
          setDropRef(node)
        }}
        className={`flex items-start gap-1 rounded-lg transition-all px-1 py-0.5 ${
          isDragging ? "opacity-40" : "opacity-100"
        } ${isDropChild || isOver ? "ring-2 ring-primary bg-primary/5" : ""}`}
        {...attributes}
        {...listeners}
      >
        {hasChildren && (
          <button
            onClick={() => toggleExpanded(todo.id)}
            className="mt-2 shrink-0 p-1 hover:bg-accent rounded"
            aria-label={isExpanded ? "折叠子任务" : "展开子任务"}
          >
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        )}
        <div className="flex-1" style={{ marginLeft: hasChildren ? 0 : 24 }}>
          <TodoItem
            todo={todo}
            disabled={busyTodoIds.has(todo.id)}
            onToggleCompleted={onToggleCompleted}
            onUpdateTitle={onUpdateTitle}
            onOpenDetails={onOpenDetails}
            onDelete={onDelete}
            onStartFocus={onStartFocus}
          />
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-8 flex flex-col border-l-2 border-border pl-4 mt-2">
          {children.map((child, index) => (
            <div key={`child-wrapper-${child.id}`}>
              {index === 0 && <DropZone todoId={child.id} position="before" dropTarget={dropTarget} />}
              <DraggableTodoItem
                todo={child}
                hasChildren={(childrenMap.get(child.id) || []).length > 0}
                isExpanded={expandedIds.has(child.id)}
                depth={depth + 1}
                busyTodoIds={busyTodoIds}
                expandedIds={expandedIds}
                dropTarget={dropTarget}
                childrenMap={childrenMap}
                toggleExpanded={toggleExpanded}
                onToggleCompleted={onToggleCompleted}
                onUpdateTitle={onUpdateTitle}
                onOpenDetails={onOpenDetails}
                onDelete={onDelete}
                onStartFocus={onStartFocus}
              />
              <DropZone todoId={child.id} position="after" dropTarget={dropTarget} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type DropZoneProps = {
  todoId: number
  position: DropPosition
  dropTarget: { id: number; position: DropPosition } | null
}

function DropZone({ todoId, position, dropTarget }: DropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `todo-${todoId}-${position}`,
    data: { type: "drop-zone", todoId, position },
  })

  const isActive = dropTarget?.id === todoId && dropTarget.position === position

  return (
    <div
      ref={setNodeRef}
      className={`transition-all ${isActive || isOver ? "bg-primary/10" : "hover:bg-accent/50"}`}
      style={{ minHeight: 16, height: isActive || isOver ? 24 : 16 }}
    >
      {(isActive || isOver) && (
        <div className="h-0.5 bg-primary relative" style={{ top: "50%" }}>
          <div className="absolute -left-1 -top-1 size-2 rounded-full bg-primary" />
        </div>
      )}
    </div>
  )
}

export function TodoList({
  todos,
  isLoading = false,
  busyTodoIds = new Set<number>(),
  onToggleCompleted,
  onUpdateTitle,
  onOpenDetails,
  onDelete,
  onUpdateParent,
  onStartFocus,
}: TodoListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: number; position: DropPosition } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        <span>正在加载待办...</span>
      </div>
    )
  }

  if (todos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center text-muted-foreground">
        <ListTodo className="size-8" aria-hidden="true" />
        <div className="text-base font-medium">暂无待办</div>
        <p className="max-w-sm text-sm">点击顶部的“新建待办”按钮开始记录你的任务。</p>
      </div>
    )
  }

  // 构建父子关系映射
  const childrenMap = new Map<number, Todo[]>()
  todos.forEach((todo) => {
    if (todo.parent_id !== null && todo.parent_id !== undefined) {
      const siblings = childrenMap.get(todo.parent_id) || []
      siblings.push(todo)
      childrenMap.set(todo.parent_id, siblings)
    }
  })

  // 获取顶层任务（没有父任务的）
  const topLevelTodos = todos.filter((todo) => todo.parent_id === null || todo.parent_id === undefined)

  const toggleExpanded = (todoId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(todoId)) {
        next.delete(todoId)
      } else {
        next.add(todoId)
      }
      return next
    })
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const todoId = active.data.current?.todoId as number
    if (todoId) {
      setDraggedId(todoId)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) {
      setDropTarget(null)
      return
    }

    const draggedTodoId = active.data.current?.todoId as number
    const overData = over.data.current as { type: string; todoId: number; position: DropPosition } | undefined

    if (!draggedTodoId || !overData) {
      setDropTarget(null)
      return
    }

    const { todoId: targetId, position } = overData

    // 不能拖到自己身上
    if (draggedTodoId === targetId && position === "child") {
      setDropTarget(null)
      return
    }

    // 检查是否会创建循环引用
    if (position === "child") {
      let currentParentId: number | null = targetId
      while (currentParentId) {
        if (currentParentId === draggedTodoId) {
          setDropTarget(null)
          return
        }
        const parent = todos.find((t) => t.id === currentParentId)
        currentParentId = parent?.parent_id ?? null
      }
    }

    setDropTarget({ id: targetId, position })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    setDraggedId(null)

    if (!over) {
      setDropTarget(null)
      return
    }

    const draggedTodoId = active.data.current?.todoId as number
    const overData = over.data.current as { type: string; todoId: number; position: DropPosition } | undefined

    if (!draggedTodoId || !overData) {
      setDropTarget(null)
      return
    }

    const { todoId: targetId, position } = overData

    if (draggedTodoId === targetId && position === "child") {
      setDropTarget(null)
      return
    }

    const targetTodo = todos.find((t) => t.id === targetId)
    if (!targetTodo) {
      setDropTarget(null)
      return
    }

    let newParentId: number | null = null

    if (position === "child") {
      newParentId = targetId
      // 自动展开父任务
      if (!expandedIds.has(targetId)) {
        setExpandedIds((prev) => new Set([...prev, targetId]))
      }
    } else {
      // before/after: 成为目标任务的兄弟任务
      newParentId = targetTodo.parent_id ?? null
    }

    void onUpdateParent(draggedTodoId, newParentId)
    setDropTarget(null)
  }

  const draggedTodo = draggedId ? todos.find((t) => t.id === draggedId) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="flex flex-col">
        {topLevelTodos.map((todo, index) => (
          <div key={`wrapper-${todo.id}`}>
            {index === 0 && <DropZone todoId={todo.id} position="before" dropTarget={dropTarget} />}
            <DraggableTodoItem
              todo={todo}
              hasChildren={(childrenMap.get(todo.id) || []).length > 0}
              isExpanded={expandedIds.has(todo.id)}
              depth={0}
              busyTodoIds={busyTodoIds}
              expandedIds={expandedIds}
              dropTarget={dropTarget}
              childrenMap={childrenMap}
              toggleExpanded={toggleExpanded}
              onToggleCompleted={onToggleCompleted}
              onUpdateTitle={onUpdateTitle}
              onOpenDetails={onOpenDetails}
              onDelete={onDelete}
              onStartFocus={onStartFocus}
            />
            <DropZone todoId={todo.id} position="after" dropTarget={dropTarget} />
          </div>
        ))}
      </div>
      <DragOverlay>
        {draggedTodo ? (
          <div className="opacity-80 bg-background border-2 border-primary rounded-lg p-2 shadow-lg">
            <TodoItem
              todo={draggedTodo}
              disabled={true}
              onToggleCompleted={() => {}}
              onUpdateTitle={() => {}}
              onOpenDetails={() => {}}
              onDelete={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
