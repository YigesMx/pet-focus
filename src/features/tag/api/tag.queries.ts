import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query"

import type { Tag, CreateTagPayload, UpdateTagPayload } from "../types"
import {
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
  getTagsForTask,
  setTagsForTask,
  getTagsForSession,
  setTagsForSession,
} from "./tag.api"
import { tagKeys } from "./tag.keys"

// ========== Query Hooks ==========

export function useTagsQuery(options?: UseQueryOptions<Tag[], Error, Tag[]>) {
  return useQuery({
    queryKey: tagKeys.list(),
    queryFn: getAllTags,
    staleTime: 60_000, // 1 minute
    ...options,
  })
}

export function useTaskTagsQuery(
  taskId: number,
  options?: UseQueryOptions<Tag[], Error, Tag[]>,
) {
  return useQuery({
    queryKey: tagKeys.taskTags(taskId),
    queryFn: () => getTagsForTask(taskId),
    staleTime: 30_000,
    enabled: taskId > 0,
    ...options,
  })
}

export function useSessionTagsQuery(
  sessionId: number,
  options?: UseQueryOptions<Tag[], Error, Tag[]>,
) {
  return useQuery({
    queryKey: tagKeys.sessionTags(sessionId),
    queryFn: () => getTagsForSession(sessionId),
    staleTime: 30_000,
    enabled: sessionId > 0,
    ...options,
  })
}

// ========== Mutation Hooks ==========

export function useCreateTagMutation(
  options?: UseMutationOptions<Tag, Error, CreateTagPayload>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() })
    },
    ...options,
  })
}

export function useUpdateTagMutation(
  options?: UseMutationOptions<Tag, Error, UpdateTagPayload>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() })
    },
    ...options,
  })
}

export function useDeleteTagMutation(
  options?: UseMutationOptions<void, Error, number>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all })
    },
    ...options,
  })
}

export function useSetTaskTagsMutation(
  options?: UseMutationOptions<void, Error, { taskId: number; tagIds: number[] }>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, tagIds }) =>
      setTagsForTask({ task_id: taskId, tag_ids: tagIds }),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.taskTags(taskId) })
    },
    ...options,
  })
}

export function useSetSessionTagsMutation(
  options?: UseMutationOptions<void, Error, { sessionId: number; tagIds: number[] }>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sessionId, tagIds }) =>
      setTagsForSession({ session_id: sessionId, tag_ids: tagIds }),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.sessionTags(sessionId) })
    },
    ...options,
  })
}
