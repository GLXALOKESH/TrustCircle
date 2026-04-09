import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useWallet from "../../hooks/useWallet";
import useVouchPool from "../../hooks/useVouchPool";
import useLoanRequest from "../../hooks/useLoanRequest";
import useReputation from "../../hooks/useReputation";
import StatusBadge from "../../components/common/StatusBadge";
import CountdownTimer from "../../components/common/CountdownTimer";
import { daysRemaining, formatEth, getScoreColor } from "../../utils/formatters";

function HealthPill({ color, label }) {
  const styles = {
    green: "bg-[#DCFCE7] text-[#14532D]",
    yellow: "bg-[#FEF3C7] text-[#92400E]",
    red: "bg-[#FFEBEE] text-[#B71C1C]",
  };

  return (
    <span className={`rounded-full px-3 py-1 font-[DM Sans] text-xs font-semibold uppercase tracking-[1px] ${styles[color]}`}>
      {label}
    </span>
  );
}

function SummaryCard({ label, value, tone = "teal" }) {
  const tones = {
    teal: "bg-[#E0F2F1] text-[#00574F]",
    purple: "bg-[#EDE7F6] text-[#3B1F7A]",
    amber: "bg-[#FEF3C7] text-[#92400E]",
    blue: "bg-[#E3F2FD] text-[#0D3A7A]",
  };

  return (
    <div className={`rounded-[18px] border border-[#D6D3CE] p-4 ${tones[tone]}`}>
      <p className="font-[DM Sans] text-[11px] font-semibold uppercase tracking-[1.4px]">{label}</p>
      <p className="mt-2 font-[Fraunces] text-2xl font-semibold">{value}</p>
    </div>
  );
}

function buildHealth(loan) {
  const state = Number(loan.state);
  const now = Math.floor(Date.now() / 1000);
  const due = Number(loan.dueTimestamp || 0);

  if (state === 4 || state === 5) return { color: "red", label: "Risk / Default" };
  if (state === 3) return { color: "green", label: "Completed" };
  if (state === 2) {
    const delta = due - now;
    if (delta <= 0) return { color: "red", label: "Overdue" };
    if (delta <= 7 * 24 * 60 * 60) return { color: "yellow", label: "Due Soon" };
    return { color: "green", label: "On Track" };
  }
  return { color: "yellow", label: "Awaiting Funding" };
}

export default function ActiveVouches() {
  const { address, isConnected, connect } = useWallet();
  const { getLoan } = useLoanRequest();
  const {
    getStakedEventsForVoucher,
    getStakeReleasedEventsForVoucher,
    getStakeSlashedEventsForVoucher,
  } = useVouchPool();
  const { getScore, getProfile } = useReputation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [trustScore, setTrustScore] = useState(0);
  const [profile, setProfile] = useState(null);

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
        const [stakedEvents, releasedEvents, slashedEvents, score, profileStruct] = await Promise.all([
          getStakedEventsForVoucher(address, fromBlock),
          getStakeReleasedEventsForVoucher(address, fromBlock),
          getStakeSlashedEventsForVoucher(address, fromBlock),
          getScore(address).catch(() => 0),
          getProfile(address).catch(() => null),
        ]);

        const releaseMap = new Map();
        for (const evt of releasedEvents) {
          releaseMap.set(evt.loanId, evt);
        }

        const slashMap = new Map();
        for (const evt of slashedEvents) {
          slashMap.set(evt.loanId, evt);
        }

        const dedupedStakeMap = new Map();
        for (const evt of stakedEvents) {
          dedupedStakeMap.set(evt.loanId, evt);
        }

        const loanIds = Array.from(dedupedStakeMap.keys());
        const loadedRows = await Promise.all(
          loanIds.map(async (loanId) => {
            const loan = await getLoan(loanId);
            const stakeEvent = dedupedStakeMap.get(loanId);
            const released = releaseMap.get(loanId);
            const slashed = slashMap.get(loanId);
            const stakeWei = BigInt(stakeEvent?.amount || 0);

            const projectedYieldWei = (stakeWei * BigInt(loan.interestBps) * 3000n) / 10000n / 10000n;
            const earnedYieldWei = BigInt(released?.yield || 0);
            const health = buildHealth(loan);

            return {
              loanId,
              loan,
              health,
              stakeWei,
              projectedYieldWei,
              earnedYieldWei,
              isSlashed: Boolean(slashed),
            };
          }),
        );

        if (!active) return;
        setRows(loadedRows.sort((a, b) => Number(b.loanId) - Number(a.loanId)));
        setTrustScore(Number(score));
        setProfile(profileStruct);
      } catch (err) {
        if (!active) return;
        setError(err.reason || err.message || "Failed to load active vouches");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [
    address,
    getLoan,
    getProfile,
    getScore,
    getStakeReleasedEventsForVoucher,
    getStakeSlashedEventsForVoucher,
    getStakedEventsForVoucher,
    isConnected,
  ]);

  const totals = useMemo(() => {
    let totalStaked = 0n;
    let projected = 0n;
    let earned = 0n;
    let activeCount = 0;
    let hasSlashRisk = false;

    for (const row of rows) {
      totalStaked += row.stakeWei;
      projected += row.projectedYieldWei;
      earned += row.earnedYieldWei;
      if ([0, 1, 2, 4].includes(Number(row.loan.state))) activeCount += 1;
      if (row.isSlashed || Number(row.loan.state) === 5) hasSlashRisk = true;
    }

    return { totalStaked, projected, earned, activeCount, hasSlashRisk };
  }, [rows]);

  const voucherAccuracy = useMemo(() => {
    const total = Number(profile?.vouchCount || 0);
    if (!total) return 0;
    return Math.round((Number(profile?.successfulVouches || 0) * 100) / total);
  }, [profile]);

  if (!isConnected) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-6xl items-center justify-center px-4 py-10">
        <section className="w-full max-w-2xl rounded-[24px] border border-[#D6D3CE] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          <h1 className="font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Active vouches</h1>
          <p className="mt-3 font-[DM Sans] text-base leading-7 text-[#4B4B4B]">Connect your wallet to track active stake positions and yield outcomes.</p>
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
            <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#5C35A8]">Voucher dashboard</p>
            <h1 className="mt-2 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Active Vouches</h1>
          </div>
          <Link
            to="/vouch/inbox"
            className="rounded-lg border border-[#5C35A8] px-4 py-2 font-[DM Sans] text-sm font-semibold text-[#5C35A8] transition hover:bg-[#EDE7F6]"
          >
            Open inbox
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total staked" value={formatEth(totals.totalStaked)} tone="purple" />
          <SummaryCard label="Projected yield" value={formatEth(totals.projected)} tone="amber" />
          <SummaryCard label="Yield earned" value={formatEth(totals.earned)} tone="teal" />
          <SummaryCard label="Active loans" value={String(totals.activeCount)} tone="blue" />
        </div>

        <div className="mt-4 rounded-2xl border border-[#D6D3CE] bg-[#F5F3EE] p-4">
          <p className="font-[DM Sans] text-xs font-semibold uppercase tracking-[1.4px] text-[#6B6B6B]">Voucher rep trend</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="font-[Fraunces] text-3xl font-semibold" style={{ color: getScoreColor(trustScore) }}>{trustScore}</span>
            <span className="rounded-full bg-white px-3 py-1 font-[DM Sans] text-xs font-semibold text-[#4B4B4B]">Accuracy {voucherAccuracy}%</span>
            <span className="rounded-full bg-white px-3 py-1 font-[DM Sans] text-xs font-semibold text-[#4B4B4B]">
              {Number(profile?.successfulVouches || 0)} successful / {Number(profile?.vouchCount || 0)} total
            </span>
          </div>
        </div>

        {totals.hasSlashRisk ? (
          <div className="mt-5 rounded-2xl border border-[#FECACA] bg-[#FFEBEE] p-4 font-[DM Sans] text-sm text-[#B71C1C]">
            Slash alert: One or more vouched loans have entered default flow. Review risk positions below.
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#D6D3CE] bg-[#F5F3EE] p-8 text-center font-[DM Sans] text-sm text-[#6B6B6B]">
            Loading active vouch positions...
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-5 font-[DM Sans] text-sm text-[#B91C1C]">{error}</div>
        ) : rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#D6D3CE] bg-[#F5F3EE] p-8 text-center font-[DM Sans] text-sm text-[#4B4B4B]">
            No stake positions found yet.
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {rows.map((row) => (
              <article key={row.loanId} className="rounded-[20px] border border-[#D6D3CE] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-[Fraunces] text-2xl font-semibold text-[#5C35A8]">Loan #{row.loanId}</p>
                    <p className="mt-1 font-[DM Sans] text-sm text-[#4B4B4B]">Stake {formatEth(row.stakeWei)} · Maturity {daysRemaining(row.loan.dueTimestamp)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <HealthPill color={row.health.color} label={row.health.label} />
                    <StatusBadge state={row.loan.state} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-[#F5F3EE] p-3">
                    <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.4px] text-[#6B6B6B]">Projected yield</p>
                    <p className="mt-1 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{formatEth(row.projectedYieldWei)}</p>
                  </div>
                  <div className="rounded-xl bg-[#F5F3EE] p-3">
                    <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.4px] text-[#6B6B6B]">Earned yield</p>
                    <p className="mt-1 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{formatEth(row.earnedYieldWei)}</p>
                  </div>
                  <div className="rounded-xl bg-[#F5F3EE] p-3">
                    <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.4px] text-[#6B6B6B]">Due countdown</p>
                    <p className="mt-1 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">
                      {Number(row.loan.state) === 2 ? <CountdownTimer dueTimestamp={row.loan.dueTimestamp} /> : daysRemaining(row.loan.dueTimestamp)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Link
                    to={`/borrow/${row.loanId}`}
                    className="rounded-lg bg-[#EDE7F6] px-4 py-2 font-[DM Sans] text-sm font-semibold text-[#3B1F7A] transition hover:bg-[#DFD3F2]"
                  >
                    View loan status
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
