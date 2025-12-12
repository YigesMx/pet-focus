// Tag API Query Keys

export const tagKeys = {
  all: ["tags"] as const,
  lists: () => [...tagKeys.all, "list"] as const,
  list: () => [...tagKeys.lists()] as const,
  taskTags: (taskId: number) => [...tagKeys.all, "task", taskId] as const,
  sessionTags: (sessionId: number) => [...tagKeys.all, "session", sessionId] as const,
}
