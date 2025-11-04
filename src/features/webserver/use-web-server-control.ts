import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { listen } from "@tauri-apps/api/event";

import {
  getWebServerStatus,
  startWebServer,
  stopWebServer,
  type WebServerStatus,
} from "@/lib/app-api";
import { reportError } from "@/lib/report-error";

function resolveAddress(status: WebServerStatus | null): string | undefined {
  if (!status) return undefined;
  if (status.address && status.address.length > 0) {
    return status.address;
  }
  if (status.host && status.port) {
    const host =
      status.host.startsWith("http://") || status.host.startsWith("https://")
        ? status.host
        : `http://${status.host}`;
    return `${host}:${status.port}`;
  }
  return undefined;
}

export function useWebServerControl() {
  const [serverStatus, setServerStatus] = useState<WebServerStatus | null>(null);
  const [isServerBusy, setIsServerBusy] = useState(false);
  const [isPlatformSupported, setIsPlatformSupported] = useState(true);

  const refreshServerStatus = useCallback(async () => {
    setIsServerBusy(true);
    try {
      const status = await getWebServerStatus();
      setServerStatus(status);
      setIsPlatformSupported(true);
    } catch (error) {
      // 检查是否是平台不支持的错误
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("not found") || errorMessage.includes("not implemented")) {
        setIsPlatformSupported(false);
      } else {
        reportError("获取外部 API 状态失败", error);
      }
    } finally {
      setIsServerBusy(false);
    }
  }, []);

  useEffect(() => {
    void refreshServerStatus();

    // 监听来自托盘菜单的状态变化事件
    const unlisten = listen<boolean>("webserver-status-changed", (event) => {
      console.log("Received webserver-status-changed event:", event.payload);
      // 刷新服务器状态
      void refreshServerStatus();
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refreshServerStatus]);

  const handleToggleApi = useCallback(
    async (nextEnabled: boolean) => {
      setIsServerBusy(true);
      try {
        const status = nextEnabled ? await startWebServer() : await stopWebServer();
        setServerStatus(status);
        const address = resolveAddress(status);
        if (nextEnabled) {
          toast.success(address ? `外部 API 已启动：${address}` : "外部 API 已启动");
        } else {
          toast.success("已停止外部 API");
        }
      } catch (error) {
        reportError(nextEnabled ? "启动外部 API 失败" : "停止外部 API 失败", error);
        await refreshServerStatus();
      } finally {
        setIsServerBusy(false);
      }
    },
    [refreshServerStatus],
  );

  const isServerRunning = serverStatus?.running ?? false;
  const apiDisplayAddress = useMemo(() => resolveAddress(serverStatus), [serverStatus]);

  const statusMessage = useMemo(() => {
    if (!isPlatformSupported) {
      return "该平台不支持";
    }

    if (isServerRunning) {
      return apiDisplayAddress ? `服务运行中：${apiDisplayAddress}` : "服务运行中";
    }

    if (serverStatus) {
      return "关闭后外部组件无法访问待办数据";
    }

    if (isServerBusy) {
      return "正在获取服务状态...";
    }

    return "尚未获取服务状态";
  }, [apiDisplayAddress, isServerBusy, isServerRunning, serverStatus, isPlatformSupported]);

  return {
    isServerRunning,
    isServerBusy,
    isPlatformSupported,
    statusMessage,
    toggleApi: handleToggleApi,
  };
}
