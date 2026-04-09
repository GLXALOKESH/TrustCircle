import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useWallet from "../../hooks/useWallet";
import useVouchPool from "../../hooks/useVouchPool";
import useLoanRequest from "../../hooks/useLoanRequest";
import useReputation from "../../hooks/useReputation";
import useUserDirectory from "../../hooks/useUserDirectory";
import { formatEth, truncateAddress } from "../../utils/formatters";

function RequestCard({ row, onDecline }) {
  return (
    <article className="rounded-[20px] border border-[#D6D3CE] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-[Fraunces] text-2xl font-semibold text-[#5C35A8]">{formatEth(row.amount)}</p>
          <p className="mt-1 font-[DM Sans] text-sm text-[#4B4B4B]">Borrower {truncateAddress(row.borrower)} · Trust score {row.borrowerScore}</p>
          {row.borrowerName ? (
            <p className="mt-1 font-[DM Sans] text-xs text-[#4B4B4B]">{row.borrowerName} · Age {row.borrowerAge} · PAN {row.borrowerPan} · CIBIL {row.borrowerCibil ?? "-"}</p>
          ) : null}
        </div>
        <span className="rounded-full bg-[#EDE7F6] px-3 py-1 font-[DM Sans] text-xs font-semibold uppercase tracking-[1px] text-[#3B1F7A]">
          Request #{row.loanId}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-[#F5F3EE] p-3">
          <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.4px] text-[#6B6B6B]">Term</p>
          <p className="mt-1 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{Number(row.termDays)} days</p>
        </div>
        <div className="rounded-xl bg-[#F5F3EE] p-3">
          <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.4px] text-[#6B6B6B]">Interest</p>
          <p className="mt-1 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{(Number(row.interestBps) / 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-xl bg-[#F5F3EE] p-3">
          <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.4px] text-[#6B6B6B]">Min suggested stake</p>
          <p className="mt-1 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{formatEth((BigInt(row.amount) * 20n) / 100n)}</p>
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-[#F5F3EE] p-3 font-[DM Sans] text-sm leading-6 text-[#4B4B4B]">
        {row.purpose || "No purpose provided"}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to={`/vouch/${row.loanId}/stake`}
          className="rounded-lg bg-[#5C35A8] px-5 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#4A2B89]"
        >
          Accept & Stake
        </Link>
        <button
          onClick={() => onDecline(row.loanId)}
          className="rounded-lg border border-[#D6D3CE] px-5 py-3 font-[DM Sans] text-sm font-semibold text-[#4B4B4B] transition hover:bg-[#F5F3EE]"
        >
          Decline
        </button>
      </div>
    </article>
  );
}

export default function Inbox() {
  const { address, isConnected, connect } = useWallet();
  const { getVouchRequestsForVoucher, getVouchers } = useVouchPool();
  const { getLoan } = useLoanRequest();
  const { getScore } = useReputation();
  const { getUserByWallet } = useUserDirectory();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [declinedIds, setDeclinedIds] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadInbox() {
      if (!isConnected || !address) {
        setRows([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const fromBlock = Number(import.meta.env.VITE_EVENT_FROM_BLOCK || 0);
        const requestEvents = await getVouchRequestsForVoucher(address, fromBlock);

        const seen = new Set();
        const uniqueEvents = [];
        for (let i = requestEvents.length - 1; i >= 0; i -= 1) {
          const evt = requestEvents[i];
          if (seen.has(evt.loanId)) continue;
          seen.add(evt.loanId);
          uniqueEvents.push(evt);
        }

        const loaded = await Promise.all(
          uniqueEvents.map(async (evt) => {
            const [loan, vouchers] = await Promise.all([
              getLoan(evt.loanId),
              getVouchers(evt.loanId).catch(() => []),
            ]);

            const currentVoucher = vouchers.find(
              (entry) => String(entry.wallet).toLowerCase() === address.toLowerCase(),
            );
            const alreadyStaked = Boolean(currentVoucher?.hasStaked);

            // Inbox should only contain pending requests that this wallet can still act on.
            const state = Number(loan.state);
            const actionableState = state === 0 || state === 1;
            const borrowerScore = await getScore(loan.borrower).catch(() => 0);
            const borrowerUser = await getUserByWallet(loan.borrower).catch(() => null);
            return {
              loanId: evt.loanId,
              borrowerScore,
              actionable: actionableState && !alreadyStaked,
              borrowerName: borrowerUser?.name || "",
              borrowerAge: borrowerUser?.age ?? "-",
              borrowerPan: borrowerUser?.panCardNumber || "",
              borrowerCibil: borrowerUser?.cibilScore ?? null,
              ...loan,
            };
          }),
        );

        if (!active) return;
        const pendingRows = loaded.filter((row) => row.actionable);
        setRows(pendingRows.sort((a, b) => Number(b.loanId) - Number(a.loanId)));
      } catch (err) {
        if (!active) return;
        setError(err.reason || err.message || "Failed to load vouch requests");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInbox();
    return () => {
      active = false;
    };
  }, [address, getLoan, getScore, getUserByWallet, getVouchRequestsForVoucher, getVouchers, isConnected]);

  const visibleRows = useMemo(() => rows.filter((row) => !declinedIds.includes(row.loanId)), [rows, declinedIds]);

  if (!isConnected) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-6xl items-center justify-center px-4 py-10">
        <section className="w-full max-w-2xl rounded-[24px] border border-[#D6D3CE] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          <h1 className="font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Vouch request inbox</h1>
          <p className="mt-3 font-[DM Sans] text-base leading-7 text-[#4B4B4B]">Connect your wallet to review borrowers asking for your support.</p>
          <button
            onClick={connect}
            className="mt-6 rounded-lg bg-[#5C35A8] px-6 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#4A2B89]"
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#5C35A8]">Voucher</p>
            <h1 className="mt-2 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Vouch Requests</h1>
            <p className="mt-2 font-[DM Sans] text-sm text-[#4B4B4B]">{visibleRows.length} pending requests for your wallet</p>
          </div>
          <Link
            to="/vouch/active"
            className="rounded-lg border border-[#5C35A8] px-4 py-2 font-[DM Sans] text-sm font-semibold text-[#5C35A8] transition hover:bg-[#EDE7F6]"
          >
            View active vouches
          </Link>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#D6D3CE] bg-[#F5F3EE] p-8 text-center font-[DM Sans] text-sm text-[#6B6B6B]">
            Loading vouch invitations from chain events...
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-5 font-[DM Sans] text-sm text-[#B91C1C]">{error}</div>
        ) : visibleRows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#D6D3CE] bg-[#F5F3EE] p-8 text-center font-[DM Sans] text-sm text-[#4B4B4B]">
            No pending vouch requests right now.
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {visibleRows.map((row) => (
              <RequestCard
                key={row.loanId}
                row={row}
                onDecline={(loanId) => setDeclinedIds((current) => [...current, loanId])}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
