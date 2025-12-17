import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface CatIllustrationProps {
  className?: string
  variant?: "idle" | "focusing" | "sleeping" | "sad"
  progress?: number // 0-100
}

/**
 * 可爱的猫猫插图
 * - idle: 待机状态（坐着）
 * - focusing: 专注中（认真看书/工作）
 * - sleeping: 休息中（睡觉）
 * - sad: 放弃专注（难过）
 */
export function CatIllustration({ className, variant = "idle", progress = 0 }: CatIllustrationProps) {
  const bodyColor = variant === "sad" ? "hsl(var(--muted-foreground))" : "hsl(30 20% 50%)"
  const accentColor = variant === "sad" ? "hsl(var(--muted))" : "hsl(30 30% 65%)"
  const cheekColor = "hsl(0 60% 80%)"
  
  return (
    <svg
      viewBox="0 0 200 200"
      className={cn("w-full h-full", className)}
      style={{ maxWidth: 200, maxHeight: 200 }}
    >
      {/* 尾巴 */}
      <path
        d={variant === "sleeping" 
          ? "M160 150 Q190 140 185 120 Q180 100 170 110"
          : "M160 150 Q190 130 180 100 Q175 80 165 90"
        }
        fill="none"
        stroke={bodyColor}
        strokeWidth="12"
        strokeLinecap="round"
        className={variant === "focusing" ? "animate-[wiggle_2s_ease-in-out_infinite]" : ""}
      />

      {/* 身体 */}
      <ellipse
        cx="100"
        cy="145"
        rx={variant === "sleeping" ? "55" : "45"}
        ry={variant === "sleeping" ? "30" : "35"}
        fill={bodyColor}
      />

      {/* 后腿 */}
      {variant !== "sleeping" && (
        <>
          <ellipse cx="65" cy="165" rx="18" ry="12" fill={bodyColor} />
          <ellipse cx="135" cy="165" rx="18" ry="12" fill={bodyColor} />
        </>
      )}

      {/* 前腿 */}
      {variant === "sleeping" ? (
        <ellipse cx="100" cy="165" rx="40" ry="10" fill={accentColor} />
      ) : (
        <>
          <ellipse cx="75" cy="170" rx="10" ry="15" fill={accentColor} />
          <ellipse cx="125" cy="170" rx="10" ry="15" fill={accentColor} />
        </>
      )}

      {/* 头 */}
      <circle
        cx="100"
        cy={variant === "sleeping" ? "130" : "95"}
        r="45"
        fill={bodyColor}
      />

      {/* 内耳 */}
      <path
        d="M62 55 L70 75 L55 70 Z"
        fill={accentColor}
      />
      <path
        d="M138 55 L130 75 L145 70 Z"
        fill={accentColor}
      />

      {/* 耳朵 */}
      <path
        d="M55 75 L65 45 L80 75 Z"
        fill={bodyColor}
      />
      <path
        d="M145 75 L135 45 L120 75 Z"
        fill={bodyColor}
      />

      {/* 脸部细节 */}
      {variant === "sleeping" ? (
        /* 睡觉 - 闭眼 */
        <>
          <path
            d="M75 125 Q85 130 95 125"
            fill="none"
            stroke="hsl(30 10% 30%)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M105 125 Q115 130 125 125"
            fill="none"
            stroke="hsl(30 10% 30%)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* ZZZ */}
          <text x="145" y="100" fontSize="14" fill="hsl(var(--primary))" className="animate-pulse">Z</text>
          <text x="155" y="90" fontSize="12" fill="hsl(var(--primary))" className="animate-pulse" style={{ animationDelay: "0.2s" }}>z</text>
          <text x="162" y="82" fontSize="10" fill="hsl(var(--primary))" className="animate-pulse" style={{ animationDelay: "0.4s" }}>z</text>
        </>
      ) : variant === "sad" ? (
        /* 难过 - 泪眼 */
        <>
          <circle cx="80" cy="90" r="8" fill="white" />
          <circle cx="120" cy="90" r="8" fill="white" />
          <circle cx="82" cy="92" r="4" fill="hsl(200 80% 50%)" />
          <circle cx="122" cy="92" r="4" fill="hsl(200 80% 50%)" />
          {/* 眼泪 */}
          <ellipse cx="80" cy="105" rx="3" ry="5" fill="hsl(200 80% 70%)" className="animate-bounce" />
          <ellipse cx="120" cy="108" rx="3" ry="5" fill="hsl(200 80% 70%)" className="animate-bounce" style={{ animationDelay: "0.3s" }} />
          {/* 难过的嘴 */}
          <path
            d="M90 115 Q100 110 110 115"
            fill="none"
            stroke="hsl(30 10% 30%)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : variant === "focusing" ? (
        /* 专注 - 认真的眼神 */
        <>
          <circle cx="80" cy="90" r="10" fill="white" />
          <circle cx="120" cy="90" r="10" fill="white" />
          <circle cx="83" cy="90" r="6" fill="hsl(30 10% 20%)" />
          <circle cx="123" cy="90" r="6" fill="hsl(30 10% 20%)" />
          <circle cx="85" cy="88" r="2" fill="white" />
          <circle cx="125" cy="88" r="2" fill="white" />
          {/* 认真的眉毛 */}
          <path d="M70 78 L90 82" stroke="hsl(30 10% 30%)" strokeWidth="2" strokeLinecap="round" />
          <path d="M130 78 L110 82" stroke="hsl(30 10% 30%)" strokeWidth="2" strokeLinecap="round" />
          {/* 腮红 */}
          <ellipse cx="65" cy="100" rx="8" ry="5" fill={cheekColor} opacity="0.6" />
          <ellipse cx="135" cy="100" rx="8" ry="5" fill={cheekColor} opacity="0.6" />
          {/* 嘴巴 */}
          <path
            d="M95 112 Q100 118 105 112"
            fill="none"
            stroke="hsl(30 10% 30%)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* 专注光效 */}
          <circle
            cx="100"
            cy="95"
            r="55"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            opacity={0.15 + (progress / 100) * 0.15}
            className="animate-pulse"
          />
        </>
      ) : (
        /* 待机 - 普通表情 */
        <>
          <circle cx="80" cy="90" r="8" fill="white" />
          <circle cx="120" cy="90" r="8" fill="white" />
          <circle cx="82" cy="91" r="5" fill="hsl(30 10% 20%)" />
          <circle cx="122" cy="91" r="5" fill="hsl(30 10% 20%)" />
          <circle cx="84" cy="89" r="2" fill="white" />
          <circle cx="124" cy="89" r="2" fill="white" />
          {/* 腮红 */}
          <ellipse cx="65" cy="100" rx="8" ry="5" fill={cheekColor} opacity="0.5" />
          <ellipse cx="135" cy="100" rx="8" ry="5" fill={cheekColor} opacity="0.5" />
          {/* 嘴巴 */}
          <path
            d="M95 110 Q100 116 105 110"
            fill="none"
            stroke="hsl(30 10% 30%)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}

      {/* 鼻子 */}
      <ellipse
        cx="100"
        cy={variant === "sleeping" ? "138" : "105"}
        rx="5"
        ry="4"
        fill="hsl(350 50% 60%)"
      />

      {/* 胡须 */}
      <g stroke="hsl(30 10% 40%)" strokeWidth="1.5" opacity="0.6">
        <line x1="60" y1={variant === "sleeping" ? "135" : "100"} x2="40" y2={variant === "sleeping" ? "130" : "95"} />
        <line x1="60" y1={variant === "sleeping" ? "140" : "105"} x2="40" y2={variant === "sleeping" ? "142" : "107"} />
        <line x1="140" y1={variant === "sleeping" ? "135" : "100"} x2="160" y2={variant === "sleeping" ? "130" : "95"} />
        <line x1="140" y1={variant === "sleeping" ? "140" : "105"} x2="160" y2={variant === "sleeping" ? "142" : "107"} />
      </g>
    </svg>
  )
}

/**
 * 圆形进度环
 */
interface ProgressRingProps {
  progress: number // 0-100
  size?: number
  strokeWidth?: number
  className?: string
  children?: React.ReactNode
}

export function ProgressRing({
  progress,
  size = 240,
  strokeWidth = 8,
  className,
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* 背景圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        {/* 进度圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* 中心内容 */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}

/**
 * 时长滑动条 - 改进版，带可编辑输入框
 */
interface DurationSliderProps {
  value: number // 分钟
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
  color?: "primary" | "emerald"
  label?: string
}

export function DurationSlider({
  value,
  onChange,
  min = 5,
  max = 120,
  step = 5,
  disabled = false,
  className,
  color = "primary",
  label,
}: DurationSliderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(value.toString())
  const inputRef = useRef<HTMLInputElement>(null)

  const percentage = ((value - min) / (max - min)) * 100
  const trackColor = color === "emerald" ? "bg-emerald-500" : "bg-primary"
  const thumbColor = color === "emerald" ? "bg-emerald-500" : "bg-primary"
  const textColor = color === "emerald" ? "text-emerald-600" : "text-primary"

  // 当外部值改变时，同步到输入框
  useEffect(() => {
    if (!isEditing) {
      setInputValue(value.toString())
    }
  }, [value, isEditing])

  const handleInputBlur = () => {
    setIsEditing(false)
    let newValue = parseInt(inputValue, 10)
    if (isNaN(newValue)) {
      newValue = value
    } else {
      // 限制在 min-max 范围内
      newValue = Math.max(min, Math.min(max, newValue))
      // 对齐到步进值
      newValue = Math.round(newValue / step) * step
      newValue = Math.max(min, Math.min(max, newValue))
    }
    setInputValue(newValue.toString())
    if (newValue !== value) {
      onChange(newValue)
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      inputRef.current?.blur()
    } else if (e.key === "Escape") {
      setInputValue(value.toString())
      setIsEditing(false)
    }
  }

  const handleValueClick = () => {
    if (!disabled) {
      setIsEditing(true)
      setTimeout(() => {
        inputRef.current?.select()
      }, 0)
    }
  }

  return (
    <div className={cn("w-full select-none", className)}>
      {/* 标题和数值 */}
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {isEditing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="number"
                min={min}
                max={max}
                step={step}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
                className={cn(
                  "w-12 h-6 text-sm font-bold text-center border rounded",
                  textColor,
                  "focus:outline-none focus:ring-2 focus:ring-primary/50"
                )}
                autoFocus
              />
              <span className="text-xs text-muted-foreground">分</span>
            </div>
          ) : (
            <button
              onClick={handleValueClick}
              disabled={disabled}
              className={cn(
                "text-sm font-bold px-2 py-0.5 rounded hover:bg-muted/50 transition-colors",
                textColor,
                disabled && "opacity-50 cursor-not-allowed"
              )}
              title="点击编辑"
            >
              {value}分
            </button>
          )}
        </div>
      )}

      <div className="relative h-8 flex items-center">
        {/* 滑动条轨道 */}
        <div className="absolute inset-x-0 h-2 bg-muted rounded-full overflow-hidden">
          {/* 已填充部分 */}
          <div
            className={cn("h-full rounded-full", trackColor)}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        {/* 原生滑块 - 全覆盖，更大触控区域 */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
          disabled={disabled}
          className={cn(
            "absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed",
            "touch-none" // 防止移动端滚动干扰
          )}
          style={{ margin: 0 }}
        />
        
        {/* 自定义滑块手柄 */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full shadow-lg border-2 border-white pointer-events-none",
            "flex items-center justify-center",
            thumbColor,
            disabled && "opacity-50"
          )}
          style={{ left: `calc(${percentage}% - 14px)` }}
        >
          <div className="w-2 h-2 rounded-full bg-white/80" />
        </div>
      </div>
      
      {/* 时间刻度 */}
      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
        <span>{min}分</span>
        <span>{max}分</span>
      </div>
    </div>
  )
}

/**
 * 装饰性的爪印
 */
export function PawPrints({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 40" className={cn("w-full h-full opacity-10", className)}>
      {/* 爪印1 */}
      <g transform="translate(10, 10)">
        <ellipse cx="10" cy="15" rx="6" ry="8" fill="currentColor" />
        <circle cx="3" cy="5" r="3" fill="currentColor" />
        <circle cx="10" cy="2" r="3" fill="currentColor" />
        <circle cx="17" cy="5" r="3" fill="currentColor" />
      </g>
      {/* 爪印2 */}
      <g transform="translate(50, 5) rotate(15)">
        <ellipse cx="10" cy="15" rx="5" ry="7" fill="currentColor" />
        <circle cx="4" cy="6" r="2.5" fill="currentColor" />
        <circle cx="10" cy="3" r="2.5" fill="currentColor" />
        <circle cx="16" cy="6" r="2.5" fill="currentColor" />
      </g>
      {/* 爪印3 */}
      <g transform="translate(80, 12) rotate(-10)">
        <ellipse cx="8" cy="12" rx="4" ry="6" fill="currentColor" />
        <circle cx="3" cy="4" r="2" fill="currentColor" />
        <circle cx="8" cy="2" r="2" fill="currentColor" />
        <circle cx="13" cy="4" r="2" fill="currentColor" />
      </g>
    </svg>
  )
}

// 保留旧的导出以保持兼容性
export { CatIllustration as TreeIllustration }

/**
 * 装饰性的云朵
 */
export function CloudDecoration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 50" className={cn("w-full h-full opacity-20", className)}>
      <ellipse cx="25" cy="35" rx="20" ry="12" fill="currentColor" />
      <ellipse cx="50" cy="30" rx="25" ry="15" fill="currentColor" />
      <ellipse cx="75" cy="35" rx="20" ry="12" fill="currentColor" />
      <ellipse cx="40" cy="25" rx="15" ry="10" fill="currentColor" />
      <ellipse cx="60" cy="25" rx="15" ry="10" fill="currentColor" />
    </svg>
  )
}

/**
 * 装饰性的山脉背景
 */
export function MountainBackground({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 100" className={cn("w-full h-full", className)} preserveAspectRatio="xMidYMax slice">
      {/* 远山 */}
      <path
        d="M0 100 L80 40 L120 70 L180 30 L240 60 L300 25 L360 55 L400 35 L400 100 Z"
        fill="hsl(var(--primary))"
        opacity={0.08}
      />
      {/* 近山 */}
      <path
        d="M0 100 L60 60 L100 80 L160 50 L220 75 L280 45 L340 70 L400 55 L400 100 Z"
        fill="hsl(var(--primary))"
        opacity={0.12}
      />
    </svg>
  )
}
