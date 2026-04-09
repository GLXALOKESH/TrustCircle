import { LOAN_STATES } from "../../config/contracts";

const styles = {
  0: "bg-[#FEF3C7] text-[#92400E]",
  1: "bg-[#E0F2F1] text-[#00574F]",
  2: "bg-[#E3F2FD] text-[#0D3A7A]",
  3: "bg-[#DCFCE7] text-[#14532D]",
  4: "bg-[#FFEBEE] text-[#B71C1C]",
  5: "bg-[#D32F2F] text-white",
};

export default function StatusBadge({ state }) {
  const key = Number(state);
  return (
    <span className={`inline-flex rounded-full px-3 py-1 font-[DM Sans] text-[12px] font-semibold ${styles[key] || styles[0]}`}>
      {LOAN_STATES[key] || "Unknown"}
    </span>
  );
}
