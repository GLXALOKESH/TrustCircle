import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useLoanRequest from "../hooks/useLoanRequest";
import useVouchPool from "../hooks/useVouchPool";
import StatusBadge from "../components/common/StatusBadge";
import { formatDate, formatEth } from "../utils/formatters";

function toBigInt(value) {
  return BigInt(value || 0);
}

function StatCard({ label, value, tone = "teal" }) {
  const tones = {
    teal: "from-[#E0F2F1] to-[#F4FBFA] text-[#00574F]",
    amber: "from-[#FEF3C7] to-[#FFFAEB] text-[#92400E]",
    blue: "from-[#E3F2FD] to-[#F2F8FE] text-[#0D3A7A]",
    purple: "from-[#EDE7F6] to-[#F7F4FC] text-[#3B1F7A]",
  };

  return (
    <div className={`rounded-[20px] border border-[#D6D3CE] bg-gradient-to-br p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] ${tones[tone]}`}>
      <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[2px]">{label}</p>
      <p className="mt-3 font-[Fraunces] text-4xl font-semibold">{value}</p>
    </div>
  );
}

export default function Stats() {
  const { getTotalLoanCount, getLoan } = useLoanRequest();
  const { getVouchers } = useVouchPool();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalLoans, setTotalLoans] = useState(0);
  const [totalEthLent, setTotalEthLent] = useState(0n);
  const [repaymentRate, setRepaymentRate] = useState(0);
  const [activeVouchers, setActiveVouchers] = useState(0);
  const [recentLoans, setRecentLoans] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadStats() {
      try {
        setLoading(true);
        setError("");

        const count = await getTotalLoanCount();
        if (count === 0) {
          if (!active) return;
          setTotalLoans(0);
          setTotalEthLent(0n);
          setRepaymentRate(0);
          setActiveVouchers(0);
          setRecentLoans([]);
          return;
        }

        const ids = Array.from({ length: count }, (_, i) => i + 1);
        const loans = await Promise.all(
          ids.map(async (id) => {
            const loan = await getLoan(id);
            let vouchers = [];
            try {
              vouchers = await getVouchers(id);
            } catch {
              vouchers = [];
            }
            return {
              ...loan,
              id: String(id),
              vouchers,
            };
          }),
        );

        let totalLent = 0n;
        let repaidCount = 0;
        let fundedOrCompletedCount = 0;
        const activeVoucherSet = new Set();

        for (const loan of loans) {
          const state = Number(loan.state);
          if (state >= 2) {
            totalLent += toBigInt(loan.amount);
            fundedOrCompletedCount += 1;
          }
          if (state === 3) {
            repaidCount += 1;
          }

          if (state === 0 || state === 1 || state === 2 || state === 4) {
            for (const voucher of loan.vouchers || []) {
              if (voucher?.wallet) {
                activeVoucherSet.add(String(voucher.wallet).toLowerCase());
              }
            }
          }
        }

        const rate = fundedOrCompletedCount > 0
          ? Math.round((repaidCount / fundedOrCompletedCount) * 100)
          : 0;

        if (!active) return;
        setTotalLoans(count);
        setTotalEthLent(totalLent);
        setRepaymentRate(rate);
        setActiveVouchers(activeVoucherSet.size);
        setRecentLoans(loans.sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 10));
      } catch (err) {
        if (!active) return;
        setError(err.reason || err.message || "Failed to load stats");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadStats();
    return () => {
      active = false;
    };
  }, [getTotalLoanCount, getLoan, getVouchers]);

  const totalEthLentText = useMemo(() => formatEth(totalEthLent), [totalEthLent]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <section className="rounded-[24px] border border-[#D6D3CE] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#00897B]">Platform overview</p>
        <h1 className="mt-2 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">TrustCircle Stats</h1>
        <p className="mt-3 max-w-3xl font-[DM Sans] text-base leading-7 text-[#4B4B4B]">
          Live platform analytics from on-chain data: loan volumes, repayment reliability, and active voucher participation.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total loans created" value={String(totalLoans)} tone="teal" />
          <StatCard label="Total ETH lent" value={totalEthLentText} tone="amber" />
          <StatCard label="Repayment rate" value={`${repaymentRate}%`} tone="blue" />
          <StatCard label="Active vouchers" value={String(activeVouchers)} tone="purple" />
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4 font-[DM Sans] text-sm text-[#B91C1C]">
            {error}
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[Fraunces] text-2xl font-semibold text-[#1A1A1A]">Recent loans</h2>
          <p className="font-[DM Sans] text-sm text-[#6B6B6B]">Latest 10 on-chain loan requests</p>
        </div>

        {loading ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#D6D3CE] bg-[#F5F3EE] p-8 text-center font-[DM Sans] text-sm text-[#6B6B6B]">
            Loading platform data...
          </div>
        ) : recentLoans.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#D6D3CE] bg-[#F5F3EE] p-8 text-center font-[DM Sans] text-sm text-[#4B4B4B]">
            No loans found yet.
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left font-[DM Sans] text-xs font-semibold uppercase tracking-[1.3px] text-[#6B6B6B]">Loan</th>
                  <th className="px-3 py-2 text-left font-[DM Sans] text-xs font-semibold uppercase tracking-[1.3px] text-[#6B6B6B]">Borrower</th>
                  <th className="px-3 py-2 text-left font-[DM Sans] text-xs font-semibold uppercase tracking-[1.3px] text-[#6B6B6B]">Amount</th>
                  <th className="px-3 py-2 text-left font-[DM Sans] text-xs font-semibold uppercase tracking-[1.3px] text-[#6B6B6B]">Created</th>
                  <th className="px-3 py-2 text-left font-[DM Sans] text-xs font-semibold uppercase tracking-[1.3px] text-[#6B6B6B]">Status</th>
                  <th className="px-3 py-2 text-left font-[DM Sans] text-xs font-semibold uppercase tracking-[1.3px] text-[#6B6B6B]">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentLoans.map((loan) => (
                  <tr key={loan.id} className="rounded-xl bg-[#F5F3EE]">
                    <td className="px-3 py-3 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">#{loan.id}</td>
                    <td className="px-3 py-3 font-mono text-[13px] text-[#4B4B4B]">{String(loan.borrower).slice(0, 6)}...{String(loan.borrower).slice(-4)}</td>
                    <td className="px-3 py-3 font-[DM Sans] text-sm font-semibold text-[#00897B]">{formatEth(loan.amount)}</td>
                    <td className="px-3 py-3 font-[DM Sans] text-sm text-[#4B4B4B]">{formatDate(loan.createdAt)}</td>
                    <td className="px-3 py-3"><StatusBadge state={loan.state} /></td>
                    <td className="px-3 py-3">
                      <Link
                        to={`/borrow/${loan.id}`}
                        className="rounded-lg bg-[#E0F2F1] px-3 py-2 font-[DM Sans] text-xs font-semibold text-[#00574F] transition hover:bg-[#CDE9E6]"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
