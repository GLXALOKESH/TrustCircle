import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ethers } from "ethers";
import useLoanRequest from "../../hooks/useLoanRequest";
import CountdownTimer from "../../components/common/CountdownTimer";
import StatusBadge from "../../components/common/StatusBadge";

export default function Dispute() {
  const { loanId } = useParams();
  const navigate = useNavigate();
  const { getLoan, disputeDefault } = useLoanRequest();

  const [loan, setLoan] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const data = await getLoan(loanId);
        if (!active) return;
        setLoan(data);
      } catch (err) {
        if (!active) return;
        setError(err.reason || err.message || "Could not load dispute details");
      } finally {
        if (active) setLoading(false);
      }
    }

    if (loanId) load();
    return () => {
      active = false;
    };
  }, [getLoan, loanId]);

  async function handleDispute() {
    try {
      setSubmitting(true);
      setError("");
      const reasonHash = ethers.id(reason || "");
      await disputeDefault(loanId, reasonHash);
      navigate(`/borrow/${loanId}`);
    } catch (err) {
      setError(err.reason || err.message || "Dispute failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-[24px] border border-[#D6D3CE] bg-white p-8">Loading dispute window...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] p-6 text-[#B91C1C]">{error}</div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <section className="rounded-[24px] border border-[#FECACA] bg-[#FFF7F7] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.05)] md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#D32F2F]">Dispute</p>
            <h1 className="mt-2 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Default claimed on loan #{loanId}</h1>
            <p className="mt-3 max-w-2xl font-[DM Sans] text-base leading-7 text-[#4B4B4B]">
              If the lender has claimed a default incorrectly, you can challenge the claim before the dispute deadline closes.
            </p>
          </div>
          <StatusBadge state={loan.state} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[20px] bg-white p-5">
            <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#6B6B6B]">Dispute window</p>
            <div className="mt-3 font-[Fraunces] text-4xl font-semibold text-[#D32F2F]">
              <CountdownTimer dueTimestamp={loan.disputeDeadline} />
            </div>
            <p className="mt-3 font-[DM Sans] text-sm leading-7 text-[#4B4B4B]">
              Use this time to explain any repayment issue, lender error, or transaction dispute. The note is hashed with keccak256 before it is written to the chain.
            </p>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={6}
              placeholder="Explain why the default claim should be reversed..."
              className="mt-5 w-full rounded-xl border border-[#D6D3CE] px-4 py-3 font-[DM Sans] text-sm outline-none transition focus:border-[#D32F2F]"
            />
          </div>

          <div className="rounded-[20px] bg-[#1A1A1A] p-5 text-white">
            <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#FCA5A5]">What happens if you submit</p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-white/80">
              <p>1. The chain checks that you are the borrower.</p>
              <p>2. The loan state moves back into funded mode.</p>
              <p>3. The lender’s default claim becomes inactive if it was within the dispute window.</p>
              <p>4. Your reason hash is stored on-chain for the record.</p>
            </div>
            <button
              onClick={handleDispute}
              disabled={submitting || Number(loan.state) !== 4}
              className="mt-6 w-full rounded-lg bg-[#D32F2F] px-5 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#B71C1C] disabled:cursor-not-allowed disabled:bg-[#D6D3CE]"
            >
              {submitting ? "Submitting..." : "Submit Dispute"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
