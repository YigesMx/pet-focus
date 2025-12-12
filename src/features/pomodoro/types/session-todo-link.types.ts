// Session-Todo 关联类型定义

export interface SessionTodoLink {
  id: number
  sessionId: number
  todoId: number
  sortOrder: number
  createdAt: string
}
