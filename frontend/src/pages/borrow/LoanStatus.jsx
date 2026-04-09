import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useLoanRequest from "../../hooks/useLoanRequest";
import useVouchPool from "../../hooks/useVouchPool";
import useUserDirectory from "../../hooks/useUserDirectory";
import { formatDate, formatEth } from "../../utils/formatters";
import StatusBadge from "../../components/common/StatusBadge";
import CountdownTimer from "../../components/common/CountdownTimer";

const stepLabels = ["Pending Vouches", "Fully Vouched", "Funded", "Repaid", "Defaulted"];

export default function LoanStatus() {
  const { loanId } = useParams();
  const navigate = useNavigate();
  const { getLoan } = useLoanRequest();
  const { getVouchers, getTotalStaked } = useVouchPool();
  const { getUserByWallet } = useUserDirectory();

  const [loan, setLoan] = useState(null);
  const [borrowerUser, setBorrowerUser] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [totalStaked, setTotalStaked] = useState("0");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!loanId) return;
      try {
        setLoading(true);
        setError("");
        const [loanData, voucherData, total] = await Promise.all([
          getLoan(loanId),
          getVouchers(loanId),
          getTotalStaked(loanId),
        ]);
        const offchainBorrower = await getUserByWallet(loanData.borrower).catch(() => null);
        if (!active) return;
        setLoan(loanData);
        setBorrowerUser(offchainBorrower);
        setVouchers(voucherData);
        setTotalStaked(total);
      } catch (err) {
        if (!active) return;
        setError(err.reason || err.message || "Could not load loan status");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 12000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [getLoan, getTotalStaked, getUserByWallet, getVouchers, loanId]);

  if (!loanId) {
    return <main className="mx-auto max-w-6xl px-4 py-10">Missing loan id.</main>;
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-[24px] border border-[#D6D3CE] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          Loading loan status from chain...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] p-6 text-[#B91C1C]">{error}</div>
      </main>
    );
  }

  const loanState = Number(loan.state);
  const amount = BigInt(loan.amount);
  const due = Number(loan.dueTimestamp);
  const totalCoverage = amount > 0n ? Number((BigInt(totalStaked) * 100n) / amount) : 0;
  const interest = (BigInt(loan.amount) * BigInt(loan.interestBps)) / 10000n;
  const totalRepayment = BigInt(loan.amount) + interest;
  const stepIndex = loanState >= 5 ? 4 : loanState === 4 ? 4 : loanState >= 3 ? 3 : loanState >= 2 ? 2 : loanState >= 1 ? 1 : 0;
  const repayWindowOpen = loanState === 2 && Number(loan.dueTimestamp) - Math.floor(Date.now() / 1000) <= 7 * 24 * 60 * 60;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#00897B]">Borrow</p>
              <h1 className="mt-2 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A] md:text-5xl">
                {formatEth(loan.amount)} loan request
              </h1>
              <p className="mt-3 font-[DM Sans] text-sm text-[#6B6B6B]">
                Loan #{loanId} · {loan.purpose}
              </p>
              {borrowerUser ? (
                <p className="mt-1 font-[DM Sans] text-xs text-[#4B4B4B]">
                  {borrowerUser.name} · Age {borrowerUser.age} · PAN {borrowerUser.panCardNumber} · CIBIL {borrowerUser.cibilScore ?? "-"}
                </p>
              ) : null}
            </div>
            <StatusBadge state={loanState} />
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="Term" value={`${Number(loan.termDays)} days`} />
            <InfoCard label="Interest" value={`${Number(loan.interestBps) / 100}%`} />
            <InfoCard label="Coverage" value={`${totalCoverage}%`} />
            <InfoCard label="Due" value={due ? formatDate(due) : "Pending"} />
          </div>

          <div className="mt-8 rounded-[20px] bg-[#F5F3EE] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[1.8px] text-[#6B6B6B]">Loan progress</p>
                <h2 className="mt-1 font-[Fraunces] text-2xl font-semibold text-[#1A1A1A]">{stepLabels[stepIndex]} stage</h2>
              </div>
              {loanState === 2 ? <CountdownTimer dueTimestamp={loan.dueTimestamp} /> : null}
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-5">
              {stepLabels.map((label, index) => (
                <div
                  key={label}
                  className={`rounded-2xl border px-3 py-3 text-center font-[DM Sans] text-sm font-semibold ${index <= stepIndex ? "border-[#00897B] bg-[#E0F2F1] text-[#00574F]" : "border-[#D6D3CE] bg-white text-[#6B6B6B]"}`}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-[20px] border border-[#D6D3CE] p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-[Fraunces] text-2xl font-semibold text-[#1A1A1A]">Voucher coverage</h2>
              <p className="font-[DM Sans] text-sm text-[#6B6B6B]">{vouchers.length} vouchers invited</p>
            </div>

            <div className="mt-5 overflow-hidden rounded-[18px] border border-[#E5E7EB]">
              {vouchers.length === 0 ? (
                <div className="bg-[#F9FAFB] p-5 font-[DM Sans] text-sm text-[#6B6B6B]">No voucher stakes recorded yet.</div>
              ) : (
                vouchers.map((voucher, index) => (
                  <div key={`${voucher.wallet}-${index}`} className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EB] bg-white p-4 last:border-none">
                    <div>
                      <p className="font-mono text-sm text-[#1A1A1A]">{voucher.wallet}</p>
                      <p className="mt-1 font-[DM Sans] text-xs text-[#6B6B6B]">{voucher.hasStaked ? "Staked" : "Invited"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{formatEth(voucher.stakeAmount)}</p>
                      <p className="mt-1 font-[DM Sans] text-xs text-[#6B6B6B]">
                        {voucher.hasStaked ? "Supporting your request" : "Awaiting stake"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#6B6B6B]">Funding status</p>
            <div className="mt-3 font-[Fraunces] text-4xl font-semibold text-[#00897B]">{formatEth(totalStaked)}</div>
            <p className="mt-2 font-[DM Sans] text-sm leading-7 text-[#4B4B4B]">
              Coverage is measured against the principal. Funding becomes available once staked ETH reaches 80% of the loan amount.
            </p>
            <div className="mt-5 h-3 rounded-full bg-[#E5E7EB]">
              <div className="h-3 rounded-full bg-[#00897B] transition-all" style={{ width: `${Math.min(totalCoverage, 100)}%` }} />
            </div>
            <p className="mt-2 font-[DM Sans] text-xs text-[#6B6B6B]">{totalCoverage}% coverage achieved</p>
          </div>

          <div className="rounded-[24px] border border-[#D6D3CE] bg-[#1A1A1A] p-6 text-white shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
            <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[2px] text-[#A7F3D0]">Next actions</p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-white/80">
              {loanState === 2 ? <p>Repay the loan before the due date to preserve your trust score.</p> : null}
              {loanState === 4 ? <p>Your loan is in the dispute window. You can challenge the default claim before finalization.</p> : null}
              {loanState === 3 ? <p>The loan is fully repaid. Reputation and voucher outcomes are now reflected on-chain.</p> : null}
              {loanState === 1 ? <p>Your request is fully vouched and ready for a lender to fund it.</p> : null}
              {loanState === 0 ? <p>Vouchers are still staking. Share the request link to complete coverage.</p> : null}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {repayWindowOpen ? (
                <Link to={`/borrow/${loanId}/repay`} className="rounded-lg bg-[#00897B] px-5 py-3 text-center font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#00574F]">
                  Repay Now
                </Link>
              ) : null}
              {loanState === 2 && !repayWindowOpen ? (
                <p className="rounded-lg border border-white/20 px-5 py-3 text-center font-[DM Sans] text-sm text-white/80">
                  Repay button appears within 7 days of due date.
                </p>
              ) : null}
              {loanState === 4 ? (
                <Link to={`/borrow/${loanId}/dispute`} className="rounded-lg bg-[#D32F2F] px-5 py-3 text-center font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#B71C1C]">
                  Dispute Default
                </Link>
              ) : null}
              {loanState !== 2 && loanState !== 4 ? (
                <button onClick={() => navigate("/borrow/new")} className="rounded-lg border border-white/20 px-5 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-white/10">
                  Create another request
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-[#F5F3EE] p-4">
      <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.4px] text-[#6B6B6B]">{label}</p>
      <p className="mt-2 font-[DM Sans] text-base font-semibold text-[#1A1A1A]">{value}</p>
    </div>
  );
}
