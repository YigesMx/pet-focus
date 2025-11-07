import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause, RotateCcw } from "lucide-react";

interface FocusTimerProps {
  initialDuration?: number; // 秒数，默认 25 分钟
}

export function FocusTimer({ initialDuration = 25 * 60 }: FocusTimerProps) {
  const [totalSeconds] = useState(initialDuration);
  const [remainingSeconds, setRemainingSeconds] = useState(initialDuration);
  const [isRunning, setIsRunning] = useState(false);

  // 计时器效果
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isRunning && remainingSeconds > 0) {
      interval = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, remainingSeconds]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const progress = ((totalSeconds - remainingSeconds) / totalSeconds) * 100;

  const handleToggle = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setRemainingSeconds(totalSeconds);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div>
          <CardTitle className="text-2xl font-semibold">番茄钟计时</CardTitle>
          <CardDescription>专注工作，提升效率</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 时间显示 */}
        <div className="text-center py-4">
          <div className="text-7xl font-bold tabular-nums text-primary">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
        </div>

        {/* 进度条 */}
        <div className="space-y-2">
          <Progress value={Math.max(0, Math.min(100, progress))} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            {Math.round(progress)}% 已完成
          </p>
        </div>

        {/* 控制按钮 */}
        <div className="flex gap-3 justify-center pt-2">
          <Button
            size="lg"
            onClick={handleToggle}
            variant={isRunning ? "default" : "outline"}
            className="gap-2 min-w-24"
          >
            {isRunning ? (
              <>
                <Pause className="size-4" />
                暂停
              </>
            ) : (
              <>
                <Play className="size-4" />
                开始
              </>
            )}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={handleReset}
            className="gap-2 min-w-24"
          >
            <RotateCcw className="size-4" />
            重置
          </Button>
        </div>

        {/* 状态提示 */}
        {remainingSeconds === 0 && (
          <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg mt-4">
            <p className="text-green-700 dark:text-green-300 font-medium">✓ 太棒了！完成了一个番茄钟</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
