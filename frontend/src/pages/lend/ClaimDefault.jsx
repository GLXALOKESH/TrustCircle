import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import useLoanRequest from "../../hooks/useLoanRequest";
import CountdownTimer from "../../components/common/CountdownTimer";
import StatusBadge from "../../components/common/StatusBadge";
import { formatDate, formatEth } from "../../utils/formatters";

export default function ClaimDefault() {
  const { loanId } = useParams();
  const navigate = useNavigate();
  const { getLoan, claimDefault, finalizeDefault } = useLoanRequest();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loan, setLoan] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!loanId) return;
      try {
        setLoading(true);
        setError("");
        const data = await getLoan(loanId);
        if (!active) return;
        setLoan(data);
      } catch (err) {
        if (!active) return;
        setError(err.reason || err.message || "Failed to load default claim details");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, 12000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [loanId, getLoan]);

  const now = Math.floor(Date.now() / 1000);

  const stateMeta = useMemo(() => {
    if (!loan) return { canClaim: false, canFinalize: false, duePassed: false };

    const state = Number(loan.state);
    const duePassed = now > Number(loan.dueTimestamp || 0);
    const canClaim = state === 2 && duePassed;
    const canFinalize = state === 4 && now >= Number(loan.disputeDeadline || 0);

    return { canClaim, canFinalize, duePassed };
  }, [loan, now]);

  async function handleClaim() {
    if (!loanId) return;
    try {
      setSubmitting(true);
      setError("");
      await claimDefault(loanId);
      toast.success("Default claim submitted. 48h dispute window started.");
      const refreshed = await getLoan(loanId);
      setLoan(refreshed);
    } catch (err) {
      setError(err.reason || err.message || "Claim default failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinalize() {
    if (!loanId) return;
    try {
      setSubmitting(true);
      setError("");
      await finalizeDefault(loanId);
      toast.success("Default finalized. Voucher stakes slashed to lender.");
      navigate("/lend/portfolio");
    } catch (err) {
      setError(err.reason || err.message || "Finalize default failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-[24px] border border-[#D6D3CE] bg-white p-8 font-[DM Sans] text-sm text-[#6B6B6B] shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          Loading default claim page...
        </div>
      </main>
    );
  }

  if (!loan) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] p-6 font-[DM Sans] text-sm text-[#B91C1C]">Loan not found.</div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <section className="rounded-[24px] border border-[#D6D3CE] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#D32F2F]">Lender protection</p>
            <h1 className="mt-2 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Claim Default · Loan #{loanId}</h1>
            <p className="mt-2 font-[DM Sans] text-sm text-[#4B4B4B]">Amount {formatEth(loan.amount)} · Due {formatDate(loan.dueTimestamp)}</p>
          </div>
          <StatusBadge state={loan.state} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-[#F5F3EE] p-4">
            <p className="font-[DM Sans] text-xs font-semibold uppercase tracking-[1.4px] text-[#6B6B6B]">Loan due countdown</p>
            <div className="mt-2"><CountdownTimer dueTimestamp={loan.dueTimestamp} /></div>
          </div>
          <div className="rounded-2xl bg-[#F5F3EE] p-4">
            <p className="font-[DM Sans] text-xs font-semibold uppercase tracking-[1.4px] text-[#6B6B6B]">Dispute window</p>
            {Number(loan.state) === 4 ? (
              <div className="mt-2">
                <CountdownTimer dueTimestamp={loan.disputeDeadline} />
              </div>
            ) : (
              <p className="mt-2 font-[DM Sans] text-sm text-[#4B4B4B]">Starts after claim.</p>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-[#FFEBEE] p-4 font-[DM Sans] text-sm leading-7 text-[#B71C1C]">
          Claiming default opens a 48-hour borrower dispute window. If borrower does not successfully dispute, you can finalize and slash voucher stakes.
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4 font-[DM Sans] text-sm text-[#B91C1C]">{error}</div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={handleClaim}
            disabled={!stateMeta.canClaim || submitting}
            className="rounded-lg bg-[#D32F2F] px-6 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#B71C1C] disabled:cursor-not-allowed disabled:bg-[#D6D3CE] disabled:text-[#9CA3AF]"
          >
            {submitting ? "Submitting..." : "Claim Default"}
          </button>

          <button
            onClick={handleFinalize}
            disabled={!stateMeta.canFinalize || submitting}
            className="rounded-lg bg-[#1A1A1A] px-6 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-[#D6D3CE] disabled:text-[#9CA3AF]"
          >
            {submitting ? "Finalizing..." : "Finalize Default"}
          </button>

          <Link
            to="/lend/portfolio"
            className="rounded-lg border border-[#D6D3CE] px-6 py-3 font-[DM Sans] text-sm font-semibold text-[#4B4B4B] transition hover:bg-[#F5F3EE]"
          >
            Back to Portfolio
          </Link>
        </div>
      </section>
    </main>
  );
}
