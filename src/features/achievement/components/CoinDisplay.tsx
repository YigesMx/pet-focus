import { useCoins } from "../hooks"
import { cn } from "@/lib/utils"

interface CoinDisplayProps {
  className?: string
  showLabel?: boolean
}

export function CoinDisplay({ className, showLabel = true }: CoinDisplayProps) {
  const coins = useCoins()

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="text-lg">🪙</span>
      <span className="font-medium tabular-nums">{coins.toLocaleString()}</span>
      {showLabel && <span className="text-muted-foreground text-sm">金币</span>}
    </div>
  )
}
