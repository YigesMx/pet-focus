import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query"

import type { SessionTodoLink } from "../types/session-todo-link.types"
import {
  listSessionTodoLinks,
  addSessionTodoLink,
  removeSessionTodoLink,
  reorderSessionTodoLinks,
} from "../api/session-todo-link.api"

// ========== Query Keys ==========

export const sessionTodoLinkKeys = {
  all: ["session-todo-links"] as const,
  lists: () => [...sessionTodoLinkKeys.all, "list"] as const,
  list: (sessionId: number) => [...sessionTodoLinkKeys.lists(), sessionId] as const,
}

// ========== Query Hooks ==========

export function useSessionTodoLinksQuery(
  sessionId: number,
  options?: UseQueryOptions<SessionTodoLink[], Error, SessionTodoLink[]>,
) {
  return useQuery({
    queryKey: sessionTodoLinkKeys.list(sessionId),
    queryFn: () => listSessionTodoLinks(sessionId),
    staleTime: 30_000,
    enabled: sessionId > 0,
    ...options,
  })
}

// ========== Mutation Hooks ==========

export function useAddSessionTodoLinkMutation(
  options?: UseMutationOptions<SessionTodoLink, Error, { sessionId: number; todoId: number }>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sessionId, todoId }) => addSessionTodoLink(sessionId, todoId),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: sessionTodoLinkKeys.list(sessionId) })
    },
    ...options,
  })
}

export function useRemoveSessionTodoLinkMutation(
  options?: UseMutationOptions<void, Error, { sessionId: number; todoId: number }>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sessionId, todoId }) => removeSessionTodoLink(sessionId, todoId),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: sessionTodoLinkKeys.list(sessionId) })
    },
    ...options,
  })
}

export function useReorderSessionTodoLinksMutation(
  options?: UseMutationOptions<void, Error, { sessionId: number; todoIds: number[] }>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sessionId, todoIds }) => reorderSessionTodoLinks(sessionId, todoIds),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: sessionTodoLinkKeys.list(sessionId) })
    },
    ...options,
  })
}
