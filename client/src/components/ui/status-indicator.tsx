import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  status: "online" | "warning" | "error" | "offline";
  className?: string;
}

export const StatusIndicator = ({ status, className }: StatusIndicatorProps) => {
  const statusConfig = {
    online: {
      color: "bg-status-online",
      pulse: "animate-pulse",
    },
    warning: {
      color: "bg-status-warning",
      pulse: "animate-pulse",
    },
    error: {
      color: "bg-status-error",
      pulse: "animate-pulse",
    },
    offline: {
      color: "bg-status-offline",
      pulse: "",
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className={cn(
        "h-2 w-2 rounded-full",
        config.color,
        config.pulse,
        className
      )}
    />
  );
};