import { useQuery, type UseQueryOptions } from "@tanstack/react-query"

import type { Todo } from "@/features/todo/types/todo.types"

import { listTodos } from "./todo.api"
import { todoKeys } from "./todo.keys"

export function useTodosQuery(options?: UseQueryOptions<Todo[], Error, Todo[]>) {
  return useQuery({
    queryKey: todoKeys.all,
    queryFn: listTodos,
    staleTime: 30_000,
    ...options,
  })
}
