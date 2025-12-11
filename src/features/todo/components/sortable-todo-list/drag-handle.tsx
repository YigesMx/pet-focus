import { forwardRef, type HTMLAttributes } from "react"
import { GripVertical } from "lucide-react"

export const DragHandle = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, style, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`flex items-center justify-center px-1 cursor-grab active:cursor-grabbing touch-none ${className || ""}`}
      style={{
        ...style,
        touchAction: 'none',
      }}
      {...props}
    >
      <GripVertical className="size-4 text-muted-foreground hover:text-foreground transition-colors" />
    </div>
  )
})

DragHandle.displayName = "DragHandle"
