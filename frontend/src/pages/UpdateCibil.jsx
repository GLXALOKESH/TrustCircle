import { useState } from "react";
import toast from "react-hot-toast";
import useAuth from "../hooks/useAuth";

const API_BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";

export default function UpdateCibil() {
  const { token } = useAuth();
  const [panCardNumber, setPanCardNumber] = useState("");
  const [cibilScore, setCibilScore] = useState(750);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [updatedUser, setUpdatedUser] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");
      setUpdatedUser(null);

      const response = await fetch(`${API_BASE}/api/auth/cibil`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          panCardNumber: panCardNumber.trim().toUpperCase(),
          cibilScore: Number(cibilScore),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Failed to update CIBIL score");
      }

      setUpdatedUser(data.user || null);
      toast.success("CIBIL score updated");
    } catch (err) {
      setError(err.message || "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <section className="rounded-[24px] border border-[#D6D3CE] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#1565C0]">Admin utility</p>
        <h1 className="mt-2 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Update CIBIL Score</h1>
        <p className="mt-3 font-[DM Sans] text-sm text-[#4B4B4B]">
          Enter PAN and CIBIL score to update off-chain profile data. This change will reflect in profile and loan application views.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="PAN Card Number">
            <input
              value={panCardNumber}
              onChange={(event) => setPanCardNumber(event.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              required
              className="w-full rounded-xl border border-[#D6D3CE] px-4 py-3 font-mono text-sm uppercase outline-none transition focus:border-[#1565C0]"
            />
          </Field>

          <Field label="CIBIL Score (300 - 900)">
            <input
              type="number"
              min={300}
              max={900}
              value={cibilScore}
              onChange={(event) => setCibilScore(event.target.value)}
              required
              className="w-full rounded-xl border border-[#D6D3CE] px-4 py-3 font-[DM Sans] text-sm outline-none transition focus:border-[#1565C0]"
            />
          </Field>

          {error ? (
            <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 font-[DM Sans] text-sm text-[#B91C1C]">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[#1565C0] px-6 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#0D47A1] disabled:cursor-not-allowed disabled:bg-[#D6D3CE] disabled:text-[#9CA3AF]"
          >
            {submitting ? "Updating..." : "Update CIBIL"}
          </button>
        </form>

        {updatedUser ? (
          <div className="mt-6 rounded-2xl bg-[#E3F2FD] p-4">
            <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[1.4px] text-[#0D47A1]">Updated record</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DataChip label="Name" value={updatedUser.name} />
              <DataChip label="PAN" value={updatedUser.panCardNumber} />
              <DataChip label="Age" value={String(updatedUser.age)} />
              <DataChip label="CIBIL" value={String(updatedUser.cibilScore ?? "-")} />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{label}</span>
      {children}
    </label>
  );
}

function DataChip({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.2px] text-[#6B6B6B]">{label}</p>
      <p className="mt-1 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{value}</p>
    </div>
  );
}
