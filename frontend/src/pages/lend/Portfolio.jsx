import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useWallet from "../../hooks/useWallet";
import useLoanRequest from "../../hooks/useLoanRequest";
import useVouchPool from "../../hooks/useVouchPool";
import StatusBadge from "../../components/common/StatusBadge";
import { formatDate, formatEth } from "../../utils/formatters";

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 font-[DM Sans] text-sm font-semibold transition ${active ? "bg-white text-[#D97706]" : "text-[#4B4B4B]"}`}
    >
      {children}
    </button>
  );
}

export default function Portfolio() {
  const { address, isConnected, connect } = useWallet();
  const { getLoanFundedEventsForLender, getLoan } = useLoanRequest();
  const { getTotalStaked } = useVouchPool();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [tab, setTab] = useState("active");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!isConnected || !address) {
        setRows([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const fromBlock = Number(import.meta.env.VITE_EVENT_FROM_BLOCK || 0);
        const fundedEvents = await getLoanFundedEventsForLender(address, fromBlock);

        const dedup = new Map();
        for (const evt of fundedEvents) {
          dedup.set(evt.loanId, evt);
        }

        const loanIds = Array.from(dedup.keys());
        const loaded = await Promise.all(
          loanIds.map(async (loanId) => {
            const [loan, totalStaked] = await Promise.all([
              getLoan(loanId),
              getTotalStaked(loanId).catch(() => "0"),
            ]);

            const amount = BigInt(loan.amount || 0n);
            const interest = (amount * BigInt(loan.interestBps || 0)) / 10000n;
            const lenderExpected = amount + ((interest * 7000n) / 10000n);
            const slashedRecovered = BigInt(totalStaked || 0);

            let receivedSoFar = 0n;
            if (Number(loan.state) === 3) receivedSoFar = lenderExpected;
            if (Number(loan.state) === 5) receivedSoFar = slashedRecovered;

            return {
              loanId,
              loan,
              lenderExpected,
              receivedSoFar,
            };
          }),
        );

        if (!active) return;
        setRows(loaded.sort((a, b) => Number(b.loanId) - Number(a.loanId)));
      } catch (err) {
        if (!active) return;
        setError(err.reason || err.message || "Failed to load lender portfolio");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [address, getLoan, getLoanFundedEventsForLender, getTotalStaked, isConnected]);

  const stats = useMemo(() => {
    let deployed = 0n;
    let expected = 0n;
    let received = 0n;

    for (const row of rows) {
      deployed += BigInt(row.loan.amount || 0n);
      expected += row.lenderExpected;
      received += row.receivedSoFar;
    }

    return { deployed, expected, received };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (tab === "active") return rows.filter((r) => [2, 4].includes(Number(r.loan.state)));
    if (tab === "repaid") return rows.filter((r) => Number(r.loan.state) === 3);
    return rows.filter((r) => Number(r.loan.state) === 5);
  }, [rows, tab]);

  if (!isConnected) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-6xl items-center justify-center px-4 py-10">
        <section className="w-full max-w-2xl rounded-[24px] border border-[#D6D3CE] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          <h1 className="font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Lender Portfolio</h1>
          <p className="mt-3 font-[DM Sans] text-base leading-7 text-[#4B4B4B]">Connect your wallet to view funded loans and returns.</p>
          <button
            onClick={connect}
            className="mt-6 rounded-lg bg-[#D97706] px-6 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#B45309]"
          >
            Connect Wallet
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <section className="rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.07)] md:p-8">
        <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#D97706]">Lender</p>
        <h1 className="mt-2 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Portfolio Dashboard</h1>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Summary label="Total deployed" value={formatEth(stats.deployed)} />
          <Summary label="Expected returns" value={formatEth(stats.expected)} />
          <Summary label="Received so far" value={formatEth(stats.received)} />
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-[#D6D3CE] bg-[#F5F3EE] p-2">
          <div className="flex gap-1">
            <TabButton active={tab === "active"} onClick={() => setTab("active")}>Active</TabButton>
            <TabButton active={tab === "repaid"} onClick={() => setTab("repaid")}>Repaid</TabButton>
            <TabButton active={tab === "defaulted"} onClick={() => setTab("defaulted")}>Defaulted</TabButton>
          </div>
          <Link
            to="/lend/browse"
            className="rounded-lg border border-[#D97706] px-4 py-2 font-[DM Sans] text-sm font-semibold text-[#D97706] transition hover:bg-[#FEF3C7]"
          >
            Fund More Loans
          </Link>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#D6D3CE] bg-[#F5F3EE] p-8 text-center font-[DM Sans] text-sm text-[#6B6B6B]">Loading funded loans...</div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-5 font-[DM Sans] text-sm text-[#B91C1C]">{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#D6D3CE] bg-[#F5F3EE] p-8 text-center font-[DM Sans] text-sm text-[#4B4B4B]">No loans in this tab.</div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left font-[DM Sans] text-xs font-semibold uppercase tracking-[1.3px] text-[#6B6B6B]">Loan</th>
                  <th className="px-3 py-2 text-left font-[DM Sans] text-xs font-semibold uppercase tracking-[1.3px] text-[#6B6B6B]">Amount</th>
                  <th className="px-3 py-2 text-left font-[DM Sans] text-xs font-semibold uppercase tracking-[1.3px] text-[#6B6B6B]">Due</th>
                  <th className="px-3 py-2 text-left font-[DM Sans] text-xs font-semibold uppercase tracking-[1.3px] text-[#6B6B6B]">Expected</th>
                  <th className="px-3 py-2 text-left font-[DM Sans] text-xs font-semibold uppercase tracking-[1.3px] text-[#6B6B6B]">Status</th>
                  <th className="px-3 py-2 text-left font-[DM Sans] text-xs font-semibold uppercase tracking-[1.3px] text-[#6B6B6B]">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.loanId} className="rounded-xl bg-[#F5F3EE]">
                    <td className="px-3 py-3 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">#{row.loanId}</td>
                    <td className="px-3 py-3 font-[DM Sans] text-sm text-[#4B4B4B]">{formatEth(row.loan.amount)}</td>
                    <td className="px-3 py-3 font-[DM Sans] text-sm text-[#4B4B4B]">{formatDate(row.loan.dueTimestamp)}</td>
                    <td className="px-3 py-3 font-[DM Sans] text-sm font-semibold text-[#D97706]">{formatEth(row.lenderExpected)}</td>
                    <td className="px-3 py-3"><StatusBadge state={row.loan.state} /></td>
                    <td className="px-3 py-3">
                      {Number(row.loan.state) === 2 && Number(row.loan.dueTimestamp || 0) < Math.floor(Date.now() / 1000) ? (
                        <Link to={`/lend/${row.loanId}/default`} className="rounded-lg bg-[#FFEBEE] px-3 py-2 font-[DM Sans] text-xs font-semibold text-[#B71C1C] transition hover:bg-[#FADADD]">Claim Default</Link>
                      ) : (
                        <Link to={`/lend/${row.loanId}`} className="rounded-lg bg-[#FEF3C7] px-3 py-2 font-[DM Sans] text-xs font-semibold text-[#92400E] transition hover:bg-[#FDE68A]">View</Link>
                      )}
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

function Summary({ label, value }) {
  return (
    <div className="rounded-xl border border-[#D6D3CE] bg-[#F5F3EE] p-4">
      <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.3px] text-[#6B6B6B]">{label}</p>
      <p className="mt-2 font-[Fraunces] text-2xl font-semibold text-[#1A1A1A]">{value}</p>
    </div>
  );
}
