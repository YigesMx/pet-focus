import { arrayMove } from "@dnd-kit/sortable"

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

  // 关键修复：先执行 arrayMove，然后在移动后的数组中查找相邻项
  // 这样才能正确计算拖动后的 previousItem 和 nextItem
  const newItems = arrayMove(items, activeItemIndex, overItemIndex)
  const previousItem = newItems[overItemIndex - 1]
  const nextItem = newItems[overItemIndex + 1]

  // 计算拖动深度变化
  const dragDepth = Math.round(dragOffset / indentationWidth)
  const projectedDepth = activeItem.depth + dragDepth

  // 最大深度：
  // - 如果有前一项，可以是前一项的深度 + 1（成为其子项）
  // - 如果没有前一项，只能是 0（顶层）
  const maxDepth = previousItem ? previousItem.depth + 1 : 0
  
  // 最小深度：
  // - 如果有后一项，不能比它更浅
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
    const newParent = newItems
      .slice(0, overItemIndex)
      .reverse()
      .find((item) => item.depth === depth)?.parentId

    return newParent ?? null
  }

  const parentId = getParentId()

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
