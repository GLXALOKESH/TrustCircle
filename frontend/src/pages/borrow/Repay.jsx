import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useLoanRequest from "../../hooks/useLoanRequest";
import { formatDate, formatEth } from "../../utils/formatters";
import CountdownTimer from "../../components/common/CountdownTimer";

export default function Repay() {
  const { loanId } = useParams();
  const navigate = useNavigate();
  const { getLoan, getRepaymentAmount, repayLoan } = useLoanRequest();

  const [loan, setLoan] = useState(null);
  const [repayment, setRepayment] = useState("0");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const [loanData, repaymentAmount] = await Promise.all([getLoan(loanId), getRepaymentAmount(loanId)]);
        if (!active) return;
        setLoan(loanData);
        setRepayment(repaymentAmount);
      } catch (err) {
        if (!active) return;
        setError(err.reason || err.message || "Could not load repayment details");
      } finally {
        if (active) setLoading(false);
      }
    }

    if (loanId) load();
    return () => {
      active = false;
    };
  }, [getLoan, getRepaymentAmount, loanId]);

  async function handleRepay() {
    try {
      setSubmitting(true);
      setError("");
      await repayLoan(loanId);
      setConfirmed(true);
      setTimeout(() => navigate(`/borrow/${loanId}`), 2500);
    } catch (err) {
      setError(err.reason || err.message || "Repayment failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-[24px] border border-[#D6D3CE] bg-white p-8">Loading repayment details...</div>
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

  const interest = BigInt(repayment) - BigInt(loan.amount);
  const overdue = Number(loan.dueTimestamp) > 0 && Number(loan.dueTimestamp) < Math.floor(Date.now() / 1000);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      {confirmed ? (
        <div className="mb-6 rounded-[24px] border border-[#BBF7D0] bg-[#F0FDF4] p-5 font-[DM Sans] text-sm text-[#166534] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          Loan repaid successfully. Voucher stakes are being released on-chain and you will be redirected shortly.
        </div>
      ) : null}

      <section className="rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] md:p-8">
        <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#00897B]">Repay</p>
        <h1 className="mt-2 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Repay loan #{loanId}</h1>
        <p className="mt-3 max-w-2xl font-[DM Sans] text-base leading-7 text-[#4B4B4B]">
          Send the exact repayment amount from your connected wallet. This immediately settles the loan and triggers voucher release.
        </p>

        {overdue ? (
          <div className="mt-6 rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-4 font-[DM Sans] text-sm text-[#B91C1C]">
            This loan is overdue. Repay immediately to avoid default proceedings.
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[20px] bg-[#F5F3EE] p-5">
            <div className="space-y-3">
              <Row label="Principal" value={formatEth(loan.amount)} />
              <Row label="Interest" value={formatEth(interest.toString())} />
              <Row label="Total due" value={formatEth(repayment)} strong />
              <Row label="Due date" value={Number(loan.dueTimestamp) ? formatDate(loan.dueTimestamp) : "Pending"} />
              <Row label="Countdown" value={<CountdownTimer dueTimestamp={loan.dueTimestamp} />} />
            </div>
          </div>

          <div className="rounded-[20px] bg-[#1A1A1A] p-5 text-white">
            <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#A7F3D0]">Action</p>
            <h2 className="mt-3 font-[Fraunces] text-3xl font-semibold">Repay now</h2>
            <p className="mt-3 font-[DM Sans] text-sm leading-7 text-white/75">
              The exact `msg.value` will be pulled from the chain’s repayment calculation. Your wallet will be prompted once you confirm.
            </p>
            <button
              onClick={handleRepay}
              disabled={submitting || Number(loan.state) !== 2}
              className="mt-6 w-full rounded-lg bg-[#00897B] px-5 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#00574F] disabled:cursor-not-allowed disabled:bg-[#D6D3CE]"
            >
              {submitting ? "Submitting..." : `Repay ${formatEth(repayment)}`}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Row({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
      <span className="font-[DM Sans] text-sm text-[#6B6B6B]">{label}</span>
      <span className={`font-[DM Sans] text-sm ${strong ? "font-semibold text-[#1A1A1A]" : "text-[#1A1A1A]"}`}>
        {value}
      </span>
    </div>
  );
}
