import { useState, useMemo, useEffect, useRef } from "react"
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
  onUpdateDueDate,
}: TodoListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
    // 尝试从 localStorage 读取保存的展开状态
    const saved = localStorage.getItem('todo-expanded-ids')
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as number[]
        return new Set(parsed)
      } catch {
        return new Set()
      }
    }
    return new Set()
  })
  const [activeId, setActiveId] = useState<number | null>(null)
  const [overId, setOverId] = useState<number | null>(null)
  const [offsetLeft, setOffsetLeft] = useState(0)
  const [openActionId, setOpenActionId] = useState<number | null>(null)
  // 保存拖动结束时的状态，用于在数据更新前保持列表顺序和 depth 不变
  const [pendingDrop, setPendingDrop] = useState<{
    activeId: number
    overId: number
    depth: number
    parentId: number | null
  } | null>(null)
  // 追踪设置 pendingDrop 时的 todos 引用，用于判断数据是否已更新
  const todosRefAtPendingDrop = useRef<typeof todos | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 降低激活距离
      },
    })
  )

  // 保存展开状态到 localStorage
  useEffect(() => {
    localStorage.setItem('todo-expanded-ids', JSON.stringify(Array.from(expandedIds)))
  }, [expandedIds])

  // 当 todos 加载完成且 expandedIds 为空时，默认全部展开
  useEffect(() => {
    if (todos.length > 0 && expandedIds.size === 0) {
      // 获取所有有子项的待办 ID
      const parentIds = new Set<number>()
      todos.forEach(todo => {
        if (todos.some(t => t.parent_id === todo.id)) {
          parentIds.add(todo.id)
        }
      })
      if (parentIds.size > 0) {
        setExpandedIds(parentIds)
      }
    }
  }, [todos, expandedIds.size])

  // 当数据更新后，清除 pendingDrop
  useEffect(() => {
    if (pendingDrop && todosRefAtPendingDrop.current !== null) {
      // 只有当 todos 引用变化时才清除 pendingDrop
      // 这表示数据已经从服务器更新
      if (todos !== todosRefAtPendingDrop.current) {
        setPendingDrop(null)
        todosRefAtPendingDrop.current = null
      }
    }
  }, [todos, pendingDrop])

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

    // 确定要排除子节点的 ID：使用当前拖动的 activeId 或 pendingDrop 的 activeId
    const excludeChildrenId = activeId ?? pendingDrop?.activeId ?? null
    
    // 移除被拖动项和折叠项的子节点
    const filteredItems = removeChildrenOf(
      flattenedTree,
      excludeChildrenId != null ? [excludeChildrenId, ...collapsedItems] : collapsedItems
    )
    
    // 如果有 pendingDrop，模拟 arrayMove 后的顺序
    if (pendingDrop && !activeId) {
      const activeIndex = filteredItems.findIndex(item => item.id === pendingDrop.activeId)
      const overIndex = filteredItems.findIndex(item => item.id === pendingDrop.overId)
      if (activeIndex !== -1 && overIndex !== -1) {
        const result = [...filteredItems]
        const [removed] = result.splice(activeIndex, 1)
        result.splice(overIndex, 0, removed)
        return result
      }
    }
    
    return filteredItems
  }, [todos, expandedIds, activeId, pendingDrop])

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
    if (!projected || !over) {
      resetState()
      return
    }

    const draggedTodoId = Number(active.id)
    const overTodoId = Number(over.id)

    const draggedTodo = todos.find((t) => t.id === draggedTodoId)
    if (!draggedTodo) {
      resetState()
      return
    }

    const newParentId = projected.parentId
    
    // 检查父级是否改变
    const parentChanged = (draggedTodo.parent_id ?? null) !== newParentId
    
    // 如果父级改变了，一定要执行重排序
    if (!parentChanged) {
      // 父级没变，检查是否在同一位置（拖到自己身上）
      if (draggedTodoId === overTodoId) {
        resetState()
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
      resetState()
      return
    }

    // 关键：getProjection 使用了 arrayMove 来确定 parentId，
    // 所以我们也必须用 arrayMove 后的顺序来查找 beforeId/afterId
    const activeIndex = flattenedItems.findIndex((item) => item.id === draggedTodoId)
    const overIndex = flattenedItems.findIndex((item) => item.id === overTodoId)
    
    if (activeIndex === -1 || overIndex === -1) {
      resetState()
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

    // 保存拖动结束时的状态，用于在数据更新前保持列表顺序和 depth
    // 同时保存当前 todos 引用，用于判断数据是否已更新
    todosRefAtPendingDrop.current = todos
    setPendingDrop({
      activeId: draggedTodoId,
      overId: overTodoId,
      depth: projected.depth,
      parentId: projected.parentId,
    })
    
    // 立即重置拖动状态
    resetState()
    
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
          {flattenedItems.map((item, index) => {
            const hasChildren = (childrenMap.get(item.id) || []).length > 0
            const isExpanded = expandedIds.has(item.id)
            // 计算 depth：
            // 1. 如果正在拖动该项，使用当前投影的 depth
            // 2. 如果拖动刚结束但数据未更新，使用保存的 pendingDrop.depth
            // 3. 否则使用 item 自身的 depth
            let depth = item.depth
            if (item.id === activeId && projected) {
              depth = projected.depth
            } else if (pendingDrop && item.id === pendingDrop.activeId) {
              // 检查数据是否已更新（parent_id 是否匹配）
              const currentParentId = item.parent_id ?? null
              if (currentParentId !== pendingDrop.parentId) {
                // 数据还未更新，使用保存的 depth
                depth = pendingDrop.depth
              }
            }

            // 计算每个层级是否是最后一个子项
            // 对于每个层级，如果下一个项的 depth 小于等于该层级，说明该层级在当前项之后没有后续项了
            const isLastInLevel: boolean[] = []
            for (let level = 0; level < depth; level++) {
              // 查找下一个项
              const nextItem = flattenedItems[index + 1]
              // 如果没有下一项，或下一项的层级 <= 当前层级，说明当前层级是最后的
              const isLast = !nextItem || nextItem.depth <= level
              isLastInLevel.push(isLast)
            }

            return (
              <SortableTodoItem
                key={item.id}
                id={item.id}
                todo={item}
                depth={depth}
                hasChildren={hasChildren}
                isExpanded={isExpanded}
                busyTodoIds={busyTodoIds}
                isLastInLevel={isLastInLevel}
                toggleExpanded={toggleExpanded}
                onToggleCompleted={onToggleCompleted}
                onUpdateTitle={onUpdateTitle}
                onOpenDetails={onOpenDetails}
                onDelete={onDelete}
                onAddSubtask={onAddSubtask}
                onStartFocus={onStartFocus}
                onUpdateDueDate={onUpdateDueDate}
                openActionId={openActionId}
                setOpenActionId={setOpenActionId}
              />
            )
          })}
        </ul>
      </SortableContext>
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {activeId && activeItem && projected ? (
            <SortableTodoItem
              id={activeId}
              todo={activeItem}
              depth={projected.depth}
              hasChildren={(childrenMap.get(activeId) || []).length > 0}
              isExpanded={false}
              busyTodoIds={busyTodoIds}
              clone={true}
              childCount={getChildCount(todos, activeId) + 1}
              isLastInLevel={Array.from({ length: projected.depth }, () => false)}
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
