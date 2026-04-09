import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useLoanRequest from "../../hooks/useLoanRequest";
import useReputation from "../../hooks/useReputation";
import useVouchPool from "../../hooks/useVouchPool";
import useUserDirectory from "../../hooks/useUserDirectory";
import StatusBadge from "../../components/common/StatusBadge";
import { formatEth, truncateAddress } from "../../utils/formatters";

function LoanCard({ row }) {
  return (
    <article className="group rounded-[20px] border border-[#D6D3CE] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.1)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-[Fraunces] text-2xl font-semibold text-[#D97706]">{formatEth(row.loan.amount)}</p>
          <p className="mt-1 font-[DM Sans] text-sm text-[#4B4B4B]">Borrower {truncateAddress(row.loan.borrower)} · Trust {row.borrowerScore}</p>
          {row.borrowerName ? (
            <p className="mt-1 font-[DM Sans] text-xs text-[#4B4B4B]">{row.borrowerName} · Age {row.borrowerAge} · PAN {row.borrowerPan} · CIBIL {row.borrowerCibil ?? "-"}</p>
          ) : null}
        </div>
        <StatusBadge state={row.loan.state} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Chip label="Interest" value={`${(Number(row.loan.interestBps) / 100).toFixed(1)}%`} />
        <Chip label="Term" value={`${Number(row.loan.termDays)} days`} />
        <Chip label="Voucher stake" value={formatEth(row.totalStakedWei)} />
        <Chip label="Coverage" value={`${row.coveragePct}%`} />
      </div>

      <p className="mt-4 line-clamp-2 rounded-xl bg-[#F5F3EE] p-3 font-[DM Sans] text-sm leading-6 text-[#4B4B4B]">
        {row.loan.purpose || "No purpose provided"}
      </p>

      <div className="mt-4 flex justify-end">
        <Link
          to={`/lend/${row.loanId}`}
          className="rounded-lg bg-[#FEF3C7] px-4 py-2 font-[DM Sans] text-sm font-semibold text-[#92400E] transition group-hover:bg-[#FDE68A]"
        >
          Review & Fund
        </Link>
      </div>
    </article>
  );
}

function Chip({ label, value }) {
  return (
    <div className="rounded-xl bg-[#F5F3EE] p-3">
      <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.4px] text-[#6B6B6B]">{label}</p>
      <p className="mt-1 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{value}</p>
    </div>
  );
}

export default function LendBrowse() {
  const { getLoanCreatedEvents, getLoan } = useLoanRequest();
  const { getScore } = useReputation();
  const { getTotalStaked } = useVouchPool();
  const { getUserByWallet } = useUserDirectory();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  const [minTrust, setMinTrust] = useState(0);
  const [maxLoanEth, setMaxLoanEth] = useState(1.0);
  const [interestRange, setInterestRange] = useState([1, 50]);
  const [maxTerm, setMaxTerm] = useState(365);
  const [sortBy, setSortBy] = useState("interest");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const fromBlock = Number(import.meta.env.VITE_EVENT_FROM_BLOCK || 0);
        const createdEvents = await getLoanCreatedEvents(fromBlock);

        const dedupMap = new Map();
        for (const evt of createdEvents) {
          dedupMap.set(evt.loanId, evt);
        }

        const loanIds = Array.from(dedupMap.keys());
        const loaded = await Promise.all(
          loanIds.map(async (loanId) => {
            const [loan, borrowerScore, totalStaked] = await Promise.all([
              getLoan(loanId),
              getScore((dedupMap.get(loanId) || {}).borrower || "0x0000000000000000000000000000000000000000").catch(() => 0),
              getTotalStaked(loanId).catch(() => "0"),
            ]);
            const borrowerUser = await getUserByWallet(loan.borrower).catch(() => null);

            return {
              loanId,
              loan,
              borrowerScore,
              borrowerName: borrowerUser?.name || "",
              borrowerAge: borrowerUser?.age ?? "-",
              borrowerPan: borrowerUser?.panCardNumber || "",
              borrowerCibil: borrowerUser?.cibilScore ?? null,
              totalStakedWei: BigInt(totalStaked || 0),
              coveragePct: BigInt(loan.amount || 0) > 0n
                ? Number((BigInt(totalStaked || 0) * 100n) / BigInt(loan.amount || 1))
                : 0,
            };
          }),
        );

        const fullyVouched = loaded.filter((row) => Number(row.loan.state) === 1);

        if (!active) return;
        setRows(fullyVouched);
      } catch (err) {
        if (!active) return;
        setError(err.reason || err.message || "Failed to load fully-vouched loans");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [getLoanCreatedEvents, getLoan, getScore, getTotalStaked, getUserByWallet]);

  const filteredRows = useMemo(() => {
    const [minInterest, maxInterest] = interestRange;

    const filtered = rows.filter((row) => {
      const loanAmountEth = Number(formatEth(row.loan.amount).replace(" ETH", ""));
      const interestPct = Number(row.loan.interestBps) / 100;
      const termDays = Number(row.loan.termDays);

      if (row.borrowerScore < minTrust) return false;
      if (loanAmountEth > maxLoanEth) return false;
      if (interestPct < minInterest || interestPct > maxInterest) return false;
      if (termDays > maxTerm) return false;
      return true;
    });

    if (sortBy === "trust") {
      return filtered.sort((a, b) => b.borrowerScore - a.borrowerScore);
    }
    return filtered.sort((a, b) => Number(b.loan.interestBps) - Number(a.loan.interestBps));
  }, [rows, minTrust, maxLoanEth, interestRange, maxTerm, sortBy]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <section className="rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.07)] md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#D97706]">Lender</p>
            <h1 className="mt-2 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Browse Fully-Vouched Loans</h1>
            <p className="mt-2 font-[DM Sans] text-sm text-[#4B4B4B]">{filteredRows.length} loans currently ready for funding</p>
          </div>
          <Link
            to="/lend/portfolio"
            className="rounded-lg border border-[#D97706] px-4 py-2 font-[DM Sans] text-sm font-semibold text-[#D97706] transition hover:bg-[#FEF3C7]"
          >
            View Portfolio
          </Link>
        </div>

        <div className="mt-6 grid gap-4 rounded-2xl bg-[#F5F3EE] p-4 md:grid-cols-2 xl:grid-cols-5">
          <Filter label="Min trust score" value={minTrust} setValue={(v) => setMinTrust(Number(v))} min={0} max={100} step={1} />
          <Filter label="Max loan (ETH)" value={maxLoanEth} setValue={(v) => setMaxLoanEth(Number(v))} min={0.05} max={1} step={0.05} />
          <Filter label="Min interest %" value={interestRange[0]} setValue={(v) => setInterestRange([Number(v), interestRange[1]])} min={1} max={50} step={0.5} />
          <Filter label="Max interest %" value={interestRange[1]} setValue={(v) => setInterestRange([interestRange[0], Number(v)])} min={1} max={50} step={0.5} />
          <div>
            <label className="font-[DM Sans] text-xs font-semibold uppercase tracking-[1.3px] text-[#6B6B6B]">Sort by</label>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="mt-2 w-full rounded-lg border border-[#D6D3CE] bg-white px-3 py-2 font-[DM Sans] text-sm"
            >
              <option value="interest">Highest Interest</option>
              <option value="trust">Highest Trust Score</option>
            </select>
            <label className="mt-3 block font-[DM Sans] text-xs font-semibold uppercase tracking-[1.3px] text-[#6B6B6B]">Max term</label>
            <input
              type="range"
              min={1}
              max={365}
              value={maxTerm}
              onChange={(event) => setMaxTerm(Number(event.target.value))}
              className="mt-2 w-full accent-[#D97706]"
            />
            <p className="mt-1 font-[DM Sans] text-xs text-[#4B4B4B]">Up to {maxTerm} days</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#D6D3CE] bg-[#F5F3EE] p-8 text-center font-[DM Sans] text-sm text-[#6B6B6B]">
            Loading fundable loans...
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-5 font-[DM Sans] text-sm text-[#B91C1C]">{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#D6D3CE] bg-[#F5F3EE] p-8 text-center font-[DM Sans] text-sm text-[#4B4B4B]">
            No loans match current filters.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {filteredRows.map((row) => (
              <LoanCard key={row.loanId} row={row} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Filter({ label, value, setValue, min, max, step }) {
  return (
    <div>
      <label className="font-[DM Sans] text-xs font-semibold uppercase tracking-[1.3px] text-[#6B6B6B]">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        min={min}
        max={max}
        step={step}
        className="mt-2 w-full rounded-lg border border-[#D6D3CE] bg-white px-3 py-2 font-[DM Sans] text-sm"
      />
    </div>
  );
}
