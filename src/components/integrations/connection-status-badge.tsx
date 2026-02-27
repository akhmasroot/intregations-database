import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";

export type ConnectionStatus = "connected" | "disconnected" | "connecting" | "error";

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
  projectName?: string;
  errorMessage?: string;
  className?: string;
}

const statusConfig = {
  connected: {
    icon: CheckCircle2,
    label: "Connected",
    className: "text-green-400 bg-green-500/10 border-green-500/20",
    iconClassName: "text-green-400",
  },
  disconnected: {
    icon: XCircle,
    label: "Not Connected",
    className: "text-muted-foreground bg-muted/50 border-border",
    iconClassName: "text-muted-foreground",
  },
  connecting: {
    icon: Loader2,
    label: "Connecting...",
    className: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    iconClassName: "text-yellow-400 animate-spin",
  },
  error: {
    icon: AlertCircle,
    label: "Error",
    className: "text-red-400 bg-red-500/10 border-red-500/20",
    iconClassName: "text-red-400",
  },
};

export function ConnectionStatusBadge({
  status,
  projectName,
  errorMessage,
  className,
}: ConnectionStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium",
        config.className,
        className
      )}
      title={errorMessage}
    >
      <Icon className={cn("h-3.5 w-3.5", config.iconClassName)} />
      <span>
        {status === "connected" && projectName
          ? projectName
          : config.label}
      </span>
    </div>
  );
}
