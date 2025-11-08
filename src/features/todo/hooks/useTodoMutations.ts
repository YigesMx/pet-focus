import { useCallback, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { reportError } from "@/shared/lib/report-error"

import type { TodoDetailUpdate } from "@/features/todo/types/todo.types"

import { createTodo, deleteTodo, updateTodo, updateTodoDetails } from "../api/todo.api"
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

type DeleteTodoInput = {
  id: number
}

type MutationTuple<Input> = {
  mutateAsync: (input: Input) => Promise<unknown>
  isPending: boolean
}

type TodoMutations = {
  createTodo: (title?: string) => Promise<void>
  updateTitle: (id: number, title: string) => Promise<void>
  toggleCompleted: (id: number, completed: boolean) => Promise<void>
  updateDetails: (id: number, details: TodoDetailUpdate) => Promise<void>
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

  const invalidateTodos = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: todoKeys.all })
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
    onSuccess: () => {
      invalidateTodos()
      toast.success("已创建新的待办事项")
    },
    onError: (error) => {
      reportError("创建待办失败", error)
    },
  })

  const updateTitleMutation = useMutation({
    mutationFn: ({ id, title }: UpdateTitleInput) => updateTodo(id, { title }),
    onSuccess: () => {
      invalidateTodos()
    },
    onError: (error, { id }) => {
      reportError("更新待办标题失败", error)
      setBusy(id, false)
    },
  })

  const toggleCompletedMutation = useMutation({
    mutationFn: ({ id, completed }: ToggleCompletedInput) => updateTodo(id, { completed }),
    onSuccess: () => {
      invalidateTodos()
    },
    onError: (error, { id }) => {
      reportError("更新待办状态失败", error)
      setBusy(id, false)
    },
  })

  const updateDetailsMutation = useMutation({
    mutationFn: ({ id, details }: UpdateDetailsInput) => updateTodoDetails(id, details),
    onSuccess: () => {
      invalidateTodos()
    },
    onError: (error, { id }) => {
      reportError("更新待办详情失败", error)
      setBusy(id, false)
    },
  })

  const deleteTodoMutation = useMutation({
    mutationFn: ({ id }: DeleteTodoInput) => deleteTodo(id),
    onSuccess: () => {
      invalidateTodos()
      toast.success("已删除待办")
    },
    onError: (error, { id }) => {
      reportError("删除待办失败", error)
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
          await createTodoMutation.mutateAsync(title)
        } catch {
          /* 已在 onError 中处理 */
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
      runMutation,
      toggleCompletedMutation,
      updateDetailsMutation,
      updateTitleMutation,
    ],
  )

  return api
}
