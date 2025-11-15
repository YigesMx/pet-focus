import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface TimeAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "focus" | "rest";
  defaultMinutes?: number;
  onConfirm: (minutes: number) => void;
  countdown?: number;
  isAutoTransition?: boolean;
}

export function TimeAdjustmentDialog({
  open,
  onOpenChange,
  type,
  defaultMinutes = 25,
  onConfirm,
  countdown,
  isAutoTransition = false,
}: TimeAdjustmentDialogProps) {
  const [minutes, setMinutes] = useState(defaultMinutes);

  useEffect(() => {
    if (open) {
      setMinutes(defaultMinutes);
    }
  }, [open, defaultMinutes]);

  const handleConfirm = () => {
    onConfirm(minutes);
    onOpenChange(false);
  };

  const getTitle = () => {
    if (isAutoTransition) {
      switch (type) {
        case "focus":
          return "即将开始专注";
        case "rest":
          return "即将开始休息";
        default:
          return "阶段切换";
      }
    }
    switch (type) {
      case "focus":
        return "调整专注时长";
      case "rest":
        return "调整休息时长";
      default:
        return "调整时长";
    }
  };

  const getDescription = () => {
    if (isAutoTransition) {
      return `${countdown}秒后自动开始，可调整时长`;
    }
    switch (type) {
      case "focus":
        return "设置本次专注时长（分钟）";
      case "rest":
        return "设置本次休息时长（分钟）";
      default:
        return "设置时长（分钟）";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getTitle()}
            {isAutoTransition && countdown !== undefined && (
              <Badge variant="secondary" className="ml-2">
                {countdown}s
              </Badge>
            )}
          </DialogTitle>
          {(isAutoTransition || getDescription()) && (
            <DialogDescription>{getDescription()}</DialogDescription>
          )}
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="minutes" className="text-right">
              时长
            </Label>
            <Input
              id="minutes"
              type="number"
              min="1"
              max="120"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm}>
            {isAutoTransition ? "立即开始" : "确认"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
