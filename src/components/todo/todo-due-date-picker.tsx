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
  disabled?: boolean;
}

export function TodoDueDatePicker({
  value,
  onChange,
  disabled = false,
}: TodoDueDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [tempDate, setTempDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  );
  const [tempTime, setTempTime] = React.useState<string>(
    value ? new Date(value).toTimeString().slice(0, 5) : "23:59"
  );

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
        <span className="text-sm text-muted-foreground">
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
          value && "text-primary hover:text-primary"
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
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>设置到期时间</DialogTitle>
          </DialogHeader>
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
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={tempDate}
                onSelect={handleDateSelect}
                initialFocus
                className="rounded-md border"
              />
            </div>
          </div>
          <div className="flex gap-2">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
