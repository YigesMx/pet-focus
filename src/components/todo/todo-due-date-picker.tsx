import * as React from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TodoDueDatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  reminderOffsetMinutes?: number;
  onReminderOffsetChange?: (minutes: number) => void;
  isNotified?: boolean;
  isCompleted?: boolean;
  disabled?: boolean;
}

export function TodoDueDatePicker({
  value,
  onChange,
  reminderOffsetMinutes = 15,
  onReminderOffsetChange,
  isNotified = false,
  isCompleted = false,
  disabled = false,
}: TodoDueDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [tempDate, setTempDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  );
  const [tempTime, setTempTime] = React.useState<string>(
    value ? new Date(value).toTimeString().slice(0, 5) : "23:59"
  );
  const [tempReminderOffset, setTempReminderOffset] = React.useState<number>(reminderOffsetMinutes);

  // 当外部 value 改变时更新临时状态
  React.useEffect(() => {
    if (value) {
      const d = new Date(value);
      setTempDate(d);
      setTempTime(d.toTimeString().slice(0, 5));
    } else {
      setTempDate(undefined);
      setTempTime("23:59");
    }
  }, [value]);

  // 当外部提醒提前分钟改变时更新临时状态
  React.useEffect(() => {
    setTempReminderOffset(reminderOffsetMinutes);
  }, [reminderOffsetMinutes]);

  // 打开时重置临时状态为当前值
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      if (value) {
        const d = new Date(value);
        setTempDate(d);
        setTempTime(d.toTimeString().slice(0, 5));
      } else {
        setTempDate(undefined);
        setTempTime("23:59");
      }
  setTempReminderOffset(reminderOffsetMinutes);
    }
    setOpen(isOpen);
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setTempDate(selectedDate);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempTime(e.target.value);
  };

  const handleConfirm = () => {
    if (tempDate) {
      const [hours, minutes] = tempTime.split(":");
      const finalDate = new Date(tempDate);
      finalDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      onChange(finalDate.toISOString());
    } else {
      onChange(null);
    }
    
    // 更新提醒时间（如果有变化且提供了回调）
    if (onReminderOffsetChange && tempReminderOffset !== reminderOffsetMinutes) {
      onReminderOffsetChange(tempReminderOffset);
    }
    
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const formatDateTime = (dateValue: string | null) => {
    if (!dateValue) return "";
    const date = new Date(dateValue);
    const localDate = date.toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
    });
    const localTime = date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${localDate} ${localTime}`;
  };

  return (
    <div className="flex items-center gap-2">
      {value && (
        <span className={cn(
          "text-sm",
          isNotified && !isCompleted ? "text-destructive font-medium" : "text-muted-foreground"
        )}>
          到期: {formatDateTime(value)}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "size-8 text-muted-foreground hover:text-foreground",
          value && !isNotified && "text-primary hover:text-primary",
          value && isNotified && !isCompleted && "text-destructive hover:text-destructive"
        )}
        aria-label="设置到期日期"
      >
        <CalendarIcon className="size-4" />
      </Button>
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          onClick={handleClear}
          disabled={disabled}
          aria-label="清除到期日期"
        >
          <X className="size-4" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100%-2rem)] overflow-hidden p-0 sm:max-h-[calc(100vh-4rem)] sm:max-w-sm md:max-w-[calc(100%-4rem)]">
          <div className="flex h-full max-h-[calc(100vh-2rem)] flex-col sm:max-h-[calc(100vh-4rem)]">
            <DialogHeader className="px-6 pt-6 flex-shrink-0">
              <DialogTitle>设置到期时间</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 min-h-0">
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="time-picker" className="text-sm">
                    时间
                  </Label>
                  <Input
                    type="time"
                    id="time-picker"
                    value={tempTime}
                    onChange={handleTimeChange}
                    className="h-9"
                  />
                </div>
                {tempDate && (
                  <div className="space-y-2">
                    <Label htmlFor="remind-before" className="text-sm">
                      提前提醒（分钟）
                    </Label>
                    <Input
                      type="number"
                      id="remind-before"
                      min={0}
                      max={1440}
                      step={1}
                      value={tempReminderOffset}
                      onChange={(e) => setTempReminderOffset(parseInt(e.target.value) || 0)}
                      className="h-9"
                      placeholder="15"
                    />
                  </div>
                )}
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={tempDate}
                    onSelect={handleDateSelect}
                    autoFocus
                    className="rounded-md border"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 border-t px-6 py-4 flex-shrink-0">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
              >
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirm}
                disabled={!tempDate}
              >
                确定
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
