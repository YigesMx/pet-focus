import type { Todo } from "@/features/todo/types/todo.types"
import type { FlattenedTodo } from "./types"

// 按 order_index 排序 todos
export function sortTodosByOrderIndex(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    const aIdx = a.order_index ?? Number.MAX_VALUE
    const bIdx = b.order_index ?? Number.MAX_VALUE
    return aIdx - bIdx
  })
}

// 将树形结构扁平化
export function flattenTree(
  todos: Todo[],
  parentId: number | null = null,
  depth: number = 0
): FlattenedTodo[] {
  // 构建父子关系映射
  const childrenMap = new Map<number | null, Todo[]>()
  todos.forEach((todo) => {
    const pid = todo.parent_id ?? null
    const siblings = childrenMap.get(pid) || []
    siblings.push(todo)
    childrenMap.set(pid, siblings)
  })

  // 对每组兄弟节点排序
  childrenMap.forEach((children, pid) => {
    childrenMap.set(pid, sortTodosByOrderIndex(children))
  })

  // 递归扁平化
  function flatten(
    parentId: number | null,
    depth: number
  ): FlattenedTodo[] {
    const children = childrenMap.get(parentId) || []
    const result: FlattenedTodo[] = []

    children.forEach((todo, index) => {
      result.push({
        ...todo,
        parentId,
        depth,
        index,
      })
      // 递归添加子节点
      result.push(...flatten(todo.id, depth + 1))
    })

    return result
  }

  return flatten(parentId, depth)
}

// 移除指定节点的子节点（用于折叠状态）
export function removeChildrenOf(
  items: FlattenedTodo[],
  ids: number[]
): FlattenedTodo[] {
  const excludeParentIds = new Set(ids)

  return items.filter((item) => {
    if (item.parentId && excludeParentIds.has(item.parentId)) {
      // 标记该项，以便其子节点也被排除
      excludeParentIds.add(item.id)
      return false
    }
    return true
  })
}

// 计算拖动投影（新的 depth 和 parentId）
export function getProjection(
  items: FlattenedTodo[],
  activeId: number,
  overId: number,
  dragOffset: number,
  indentationWidth: number = 32
): {
  depth: number
  parentId: number | null
  maxDepth: number
  minDepth: number
} | null {
  const overItemIndex = items.findIndex((item) => item.id === overId)
  const activeItemIndex = items.findIndex((item) => item.id === activeId)

  if (overItemIndex === -1 || activeItemIndex === -1) {
    return null
  }

  const activeItem = items[activeItemIndex]
  const overItem = items[overItemIndex]

  // 计算拖动深度变化
  const dragDepth = Math.round(dragOffset / indentationWidth)
  const projectedDepth = activeItem.depth + dragDepth

  // 计算最大和最小允许深度
  const previousItem = items[overItemIndex - 1]
  const nextItem = items[overItemIndex + 1]

  // 最大深度：
  // - 如果有前一项，可以是前一项的深度 + 1（成为其子项）
  // - 如果没有前一项，只能是 0（顶层）
  // 但是，如果拖动到一个项的下方，也应该允许成为该项的子项
  let maxDepth = 0
  if (previousItem) {
    maxDepth = previousItem.depth + 1
  }
  
  // 最小深度：
  // - 如果有后一项，不能比它更深
  // - 如果没有后一项，最小为 0
  const minDepth = nextItem ? nextItem.depth : 0

  // 限制深度在合理范围内
  let depth = Math.max(0, projectedDepth)
  if (projectedDepth >= maxDepth) {
    depth = maxDepth
  } else if (projectedDepth < minDepth) {
    depth = minDepth
  }

  // 根据深度确定父节点
  function getParentId(): number | null {
    if (depth === 0 || !previousItem) {
      return null
    }

    if (depth === previousItem.depth) {
      // 与前一项同级，共享父节点
      return previousItem.parentId
    }

    if (depth > previousItem.depth) {
      // 比前一项更深，成为前一项的子项
      return previousItem.id
    }

    // 比前一项浅，向上查找相同深度的节点的父节点
    const newParent = items
      .slice(0, overItemIndex)
      .reverse()
      .find((item) => item.depth === depth)?.parentId

    return newParent ?? null
  }

  const parentId = getParentId()

  if (depth !== activeItem.depth || parentId !== activeItem.parentId) {
    console.log('[getProjection] DETAILED', {
      activeId,
      activeItem: { id: activeItem.id, depth: activeItem.depth, parentId: activeItem.parentId },
      overId,
      overItem: { id: overItem.id, depth: overItem.depth, parentId: overItem.parentId },
      dragOffset,
      projectedDepth,
      finalDepth: depth,
      maxDepth,
      minDepth,
      previousItem: previousItem ? { id: previousItem.id, depth: previousItem.depth, parentId: previousItem.parentId } : null,
      nextItem: nextItem ? { id: nextItem.id, depth: nextItem.depth, parentId: nextItem.parentId } : null,
      calculatedParentId: parentId,
      logic: depth > (previousItem?.depth ?? -1) ? 'become child of previous' : 
             depth === previousItem?.depth ? 'same level as previous' : 
             'shallower than previous'
    })
  }

  return {
    depth,
    parentId,
    maxDepth,
    minDepth,
  }
}

// 从扁平化列表重建树形结构
export function buildTree(flattenedItems: FlattenedTodo[]): Todo[] {
  const root: { id: string; children: Todo[] } = { id: 'root', children: [] }
  const nodes: Record<string | number, { id: string | number; children: Todo[] }> = {
    [root.id]: root,
  }

  const items = flattenedItems.map((item) => ({
    ...item,
    children: [] as Todo[],
  }))

  for (const item of items) {
    const { id } = item
    const parentId = item.parentId ?? root.id

    const parent = nodes[parentId] ?? items.find((i) => i.id === parentId)

    if (parent) {
      nodes[id] = { id, children: [] }
      parent.children.push(item)
    }
  }

  return root.children
}

// 计算子节点数量
export function getChildCount(
  todos: Todo[],
  parentId: number
): number {
  let count = 0

  function countRecursive(pid: number) {
    const children = todos.filter((t) => t.parent_id === pid)
    count += children.length
    children.forEach((child) => countRecursive(child.id))
  }

  countRecursive(parentId)
  return count
}
