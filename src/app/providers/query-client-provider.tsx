import { type ReactNode, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

interface QueryClientWrapperProps {
  children: ReactNode
}

export function QueryClientWrapper({ children }: QueryClientWrapperProps) {
  const [client] = useState(() => new QueryClient())

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
