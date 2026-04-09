import { useEffect, useState } from "react";

function formatCountdown(seconds) {
  if (seconds <= 0) return "OVERDUE";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function CountdownTimer({ dueTimestamp }) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!dueTimestamp) {
      setValue("-");
      return undefined;
    }

    const update = () => {
      const remaining = Number(dueTimestamp) - Math.floor(Date.now() / 1000);
      setValue(formatCountdown(remaining));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [dueTimestamp]);

  const overdue = value === "OVERDUE";

  return (
    <span className={`font-[DM Sans] text-sm font-semibold ${overdue ? "text-[#D32F2F]" : "text-[#00574F]"}`}>
      {value}
    </span>
  );
}
