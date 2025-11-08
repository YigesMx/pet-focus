export const todoKeys = {
  all: ["todos"] as const,
  detail: (id: number) => ["todos", id] as const,
}
