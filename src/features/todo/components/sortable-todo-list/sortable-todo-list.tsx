import { useState, useMemo } from "react"
import { createPortal } from "react-dom"
import { ListTodo, Loader2 } from "lucide-react"
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"

import type { Todo } from "@/features/todo/types/todo.types"
import { SortableTodoItem } from "./sortable-todo-item"
import {
  flattenTree,
  removeChildrenOf,
  getProjection,
  getChildCount,
} from "./utilities"
import type { TodoListProps } from "./types"

export function TodoList({
  todos,
  isLoading = false,
  busyTodoIds = new Set<number>(),
  onToggleCompleted,
  onUpdateTitle,
  onOpenDetails,
  onDelete,
  onUpdateParent: _onUpdateParent,
  onReorder,
  onAddSubtask,
  onStartFocus,
}: TodoListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [activeId, setActiveId] = useState<number | null>(null)
  const [overId, setOverId] = useState<number | null>(null)
  const [offsetLeft, setOffsetLeft] = useState(0)
  const [openActionId, setOpenActionId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 降低激活距离
      },
    })
  )

  // 扁平化 todos，处理展开/折叠状态
  const flattenedItems = useMemo(() => {
    const flattenedTree = flattenTree(todos)

    // 收集折叠的项
    const collapsedItems = flattenedTree.reduce<number[]>(
      (acc, item) => {
        const hasChildren = todos.some((t) => t.parent_id === item.id)
        if (hasChildren && !expandedIds.has(item.id)) {
          return [...acc, item.id]
        }
        return acc
      },
      []
    )

    // 移除被拖动项和折叠项的子节点
    return removeChildrenOf(
      flattenedTree,
      activeId != null ? [activeId, ...collapsedItems] : collapsedItems
    )
  }, [todos, expandedIds, activeId])

  // 计算投影
  const projected =
    activeId && overId
      ? getProjection(flattenedItems, activeId, overId, offsetLeft, 32)
      : null

  const sortedIds = useMemo(
    () => flattenedItems.map((item) => item.id),
    [flattenedItems]
  )

  const activeItem = activeId
    ? flattenedItems.find((item) => item.id === activeId)
    : null

  // 构建子节点映射
  const childrenMap = useMemo(() => {
    const map = new Map<number, Todo[]>()
    todos.forEach((todo) => {
      if (todo.parent_id !== null && todo.parent_id !== undefined) {
        const siblings = map.get(todo.parent_id) || []
        siblings.push(todo)
        map.set(todo.parent_id, siblings)
      }
    })
    return map
  }, [todos])

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
        <p className="max-w-sm text-sm">点击顶部的"新建待办"按钮开始记录你的任务。</p>
      </div>
    )
  }

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

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(Number(active.id))
    setOverId(Number(active.id))
    document.body.style.setProperty('cursor', 'grabbing')
  }

  const handleDragMove = ({ delta }: DragMoveEvent) => {
    setOffsetLeft(delta.x)
  }

  const handleDragOver = ({ over }: DragOverEvent) => {
    setOverId(over?.id ? Number(over.id) : null)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    resetState()

    if (!projected || !over) {
      return
    }

    const draggedTodoId = Number(active.id)
    const overTodoId = Number(over.id)

    const draggedTodo = todos.find((t) => t.id === draggedTodoId)
    if (!draggedTodo) {
      return
    }

    const newParentId = projected.parentId
    
    // 检查父级是否改变
    const parentChanged = (draggedTodo.parent_id ?? null) !== newParentId
    
    // 如果父级改变了，一定要执行重排序
    if (!parentChanged) {
      // 父级没变，检查是否在同一位置（拖到自己身上）
      if (draggedTodoId === overTodoId) {
        return
      }
    }

    // 检查循环引用
    function isDescendant(parentId: number | null, targetId: number): boolean {
      if (!parentId) return false
      if (parentId === targetId) return true
      const parent = todos.find((t) => t.id === parentId)
      if (!parent) return false
      return isDescendant(parent.parent_id ?? null, targetId)
    }

    if (isDescendant(projected.parentId, draggedTodoId)) {
      return
    }

    // 关键：getProjection 使用了 arrayMove 来确定 parentId，
    // 所以我们也必须用 arrayMove 后的顺序来查找 beforeId/afterId
    const activeIndex = flattenedItems.findIndex((item) => item.id === draggedTodoId)
    const overIndex = flattenedItems.findIndex((item) => item.id === overTodoId)
    
    if (activeIndex === -1 || overIndex === -1) {
      return
    }

    // 模拟拖动后的顺序（与 getProjection 一致）
    const clonedItems = flattenedItems.map(item => ({...item}))
    clonedItems[activeIndex] = {
      ...clonedItems[activeIndex],
      depth: projected.depth,
      parentId: projected.parentId,
    }
    const newItems = arrayMove(clonedItems, activeIndex, overIndex)
    
    // 在新顺序中找到被拖动项的位置
    const draggedNewIndex = newItems.findIndex(item => item.id === draggedTodoId)
    
    // 向上查找同父级的兄弟（beforeId）
    let beforeId: number | null = null
    for (let i = draggedNewIndex - 1; i >= 0; i--) {
      const item = newItems[i]
      if ((item.parentId ?? null) === projected.parentId) {
        beforeId = item.id
        break
      }
      // 遇到更浅层级，停止
      if (item.depth < projected.depth) {
        break
      }
    }

    // 向下查找同父级的兄弟（afterId）
    let afterId: number | null = null
    for (let i = draggedNewIndex + 1; i < newItems.length; i++) {
      const item = newItems[i]
      if ((item.parentId ?? null) === projected.parentId) {
        afterId = item.id
        break
      }
      // 遇到更浅层级，停止
      if (item.depth < projected.depth) {
        break
      }
    }

    console.log('[Todo Reorder]', {
      id: draggedTodoId,
      beforeId,
      afterId,
      parentId: newParentId,
    })

    void onReorder(draggedTodoId, beforeId, afterId, newParentId)
  }

  const handleDragCancel = () => {
    resetState()
  }

  function resetState() {
    setActiveId(null)
    setOverId(null)
    setOffsetLeft(0)
    document.body.style.setProperty('cursor', '')
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1">
          {flattenedItems.map((item) => {
            const hasChildren = (childrenMap.get(item.id) || []).length > 0
            const isExpanded = expandedIds.has(item.id)
            // 关键：如果是正在拖动的项，使用投影的 depth
            const depth = item.id === activeId && projected ? projected.depth : item.depth

            return (
              <SortableTodoItem
                key={item.id}
                id={item.id}
                todo={item}
                depth={depth}
                hasChildren={hasChildren}
                isExpanded={isExpanded}
                busyTodoIds={busyTodoIds}
                toggleExpanded={toggleExpanded}
                onToggleCompleted={onToggleCompleted}
                onUpdateTitle={onUpdateTitle}
                onOpenDetails={onOpenDetails}
                onDelete={onDelete}
                onAddSubtask={onAddSubtask}
                onStartFocus={onStartFocus}
                openActionId={openActionId}
                setOpenActionId={setOpenActionId}
              />
            )
          })}
        </ul>
      </SortableContext>
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {activeId && activeItem ? (
            <SortableTodoItem
              id={activeId}
              todo={activeItem}
              depth={activeItem.depth}
              hasChildren={(childrenMap.get(activeId) || []).length > 0}
              isExpanded={false}
              busyTodoIds={busyTodoIds}
              clone={true}
              childCount={getChildCount(todos, activeId) + 1}
              toggleExpanded={() => {}}
              onToggleCompleted={() => {}}
              onUpdateTitle={() => {}}
              onOpenDetails={() => {}}
              onDelete={() => {}}
              onAddSubtask={() => {}}
              openActionId={null}
              setOpenActionId={() => {}}
            />
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  )
}
