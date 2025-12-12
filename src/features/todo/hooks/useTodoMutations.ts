import { useCallback, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { reportError } from "@/shared/lib/report-error"

import type { Todo, TodoDetailUpdate } from "@/features/todo/types/todo.types"

import { createTodo, deleteTodo, reorderTodo, updateTodo, updateTodoDetails, updateTodoParent } from "../api/todo.api"
import { todoKeys } from "../api/todo.keys"

type UpdateTitleInput = {
  id: number
  title: string
}

type ToggleCompletedInput = {
  id: number
  completed: boolean
}

type UpdateDetailsInput = {
  id: number
  details: TodoDetailUpdate
}

type UpdateParentInput = {
  id: number
  parentId: number | null
}

type ReorderInput = {
  id: number
  beforeId: number | null
  afterId: number | null
  newParentId: number | null
}

type DeleteTodoInput = {
  id: number
}

type MutationTuple<Input> = {
  mutateAsync: (input: Input) => Promise<unknown>
  isPending: boolean
}

type TodoMutations = {
  createTodo: (title?: string) => Promise<Todo | undefined>
  updateTitle: (id: number, title: string) => Promise<void>
  toggleCompleted: (id: number, completed: boolean) => Promise<void>
  updateDetails: (id: number, details: TodoDetailUpdate) => Promise<void>
  updateParent: (id: number, parentId: number | null) => Promise<void>
  reorder: (id: number, beforeId: number | null, afterId: number | null, newParentId: number | null) => Promise<void>
  deleteTodo: (id: number) => Promise<void>
  busyTodoIds: Set<number>
  isCreating: boolean
}

export function useTodoMutations(): TodoMutations {
  const queryClient = useQueryClient()
  const [busyTodoIds, setBusyTodoIds] = useState<Set<number>>(new Set())

  const setBusy = useCallback((id: number, busy: boolean) => {
    setBusyTodoIds((previous) => {
      const next = new Set(previous)
      if (busy) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  const invalidateTodos = useCallback(async () => {
    // 使用 refetchQueries 立即刷新，而不是 invalidateQueries
    // 这确保数据立即更新，避免快速操作时使用旧数据
    await queryClient.refetchQueries({ queryKey: todoKeys.all })
  }, [queryClient])

  const withBusy = useCallback(
    async <Input,>(id: number, action: () => Promise<Input>): Promise<Input> => {
      setBusy(id, true)
      try {
        return await action()
      } finally {
        setBusy(id, false)
      }
    },
    [setBusy],
  )

  const createTodoMutation = useMutation({
    mutationFn: (title?: string) => createTodo(title),
    onSuccess: async () => {
      await invalidateTodos()
      // 后端已通过 NotificationManager 发送成功通知
    },
    onError: (error) => {
      reportError("创建待办失败", error)
    },
  })

  const updateTitleMutation = useMutation({
    mutationFn: ({ id, title }: UpdateTitleInput) => updateTodo(id, { title }),
    onSuccess: async () => {
      await invalidateTodos()
    },
    onError: (error, { id }) => {
      reportError("更新待办标题失败", error)
      setBusy(id, false)
    },
  })

  const toggleCompletedMutation = useMutation({
    mutationFn: ({ id, completed }: ToggleCompletedInput) => updateTodo(id, { completed }),
    onSuccess: async () => {
      await invalidateTodos()
    },
    onError: (error, { id }) => {
      reportError("更新待办状态失败", error)
      setBusy(id, false)
    },
  })

  const updateDetailsMutation = useMutation({
    mutationFn: ({ id, details }: UpdateDetailsInput) => updateTodoDetails(id, details),
    onSuccess: async () => {
      await invalidateTodos()
    },
    onError: (error, { id }) => {
      reportError("更新待办详情失败", error)
      setBusy(id, false)
    },
  })

  const updateParentMutation = useMutation({
    mutationFn: ({ id, parentId }: UpdateParentInput) => updateTodoParent(id, parentId),
    onSuccess: async () => {
      await invalidateTodos()
    },
    onError: (error, { id }) => {
      reportError("更新父任务失败", error)
      setBusy(id, false)
    },
  })

  const deleteTodoMutation = useMutation({
    mutationFn: ({ id }: DeleteTodoInput) => deleteTodo(id),
    onSuccess: async () => {
      await invalidateTodos()
      // 后端已通过 NotificationManager 发送成功通知
    },
    onError: (error, { id }) => {
      reportError("删除待办失败", error)
      setBusy(id, false)
    },
  })

  const reorderMutation = useMutation({
    mutationFn: ({ id, beforeId, afterId, newParentId }: ReorderInput) => 
      reorderTodo(id, beforeId, afterId, newParentId),
    onSuccess: async () => {
      // 等待数据刷新完成，确保下次操作使用最新数据
      // 这对于 reorder 特别重要，因为可能触发 rebalance 更新多个 todos
      await invalidateTodos()
    },
    onError: (error, { id }) => {
      reportError("重新排序失败", error)
      setBusy(id, false)
    },
  })

  const runMutation = useCallback(
    async <Input,>(id: number, mutation: MutationTuple<Input>, input: Input, busy = true) => {
      const exec = async () => {
        await mutation.mutateAsync(input)
      }
      if (!busy) {
        try {
          await exec()
        } catch {
          /* 已在 onError 中处理 */
        }
        return
      }
      try {
        await withBusy(id, exec)
      } catch {
        /* 已在 onError 中处理 */
      }
    },
    [withBusy],
  )

  const api = useMemo<TodoMutations>(
    () => ({
      createTodo: async (title?: string) => {
        try {
          return await createTodoMutation.mutateAsync(title)
        } catch {
          /* 已在 onError 中处理 */
          return undefined
        }
      },
      updateTitle: async (id: number, title: string) => {
        await runMutation(id, updateTitleMutation, { id, title })
      },
      toggleCompleted: async (id: number, completed: boolean) => {
        await runMutation(id, toggleCompletedMutation, { id, completed })
      },
      updateDetails: async (id: number, details: TodoDetailUpdate) => {
        await withBusy(id, async () => {
          await updateDetailsMutation.mutateAsync({ id, details })
        })
      },
      updateParent: async (id: number, parentId: number | null) => {
        await runMutation(id, updateParentMutation, { id, parentId })
      },
      reorder: async (id: number, beforeId: number | null, afterId: number | null, newParentId: number | null) => {
        await runMutation(id, reorderMutation, { id, beforeId, afterId, newParentId })
      },
      deleteTodo: async (id: number) => {
        await runMutation(id, deleteTodoMutation, { id })
      },
      busyTodoIds,
      isCreating: createTodoMutation.isPending,
    }),
    [
      busyTodoIds,
      createTodoMutation,
      deleteTodoMutation,
      reorderMutation,
      runMutation,
      toggleCompletedMutation,
      updateDetailsMutation,
      updateParentMutation,
      updateTitleMutation,
      withBusy,
    ],
  )

  return api
}
