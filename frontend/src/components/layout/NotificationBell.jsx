import { useState } from "react";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const notifications = [];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-[#4B4B4B] transition hover:bg-[#F5F3EE]"
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 rounded-full bg-[#D32F2F] px-1.5 py-0.5 font-[DM Sans] text-[10px] font-bold text-white">
          0
        </span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-lg border border-[#D6D3CE] bg-white p-3 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          <p className="font-[DM Sans] text-sm text-[#6B6B6B]">No notifications yet.</p>
        </div>
      )}
    </div>
  );
}
