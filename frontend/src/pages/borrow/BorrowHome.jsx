import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import useWallet from "../../hooks/useWallet";
import useLoanRequest from "../../hooks/useLoanRequest";
import useReputation from "../../hooks/useReputation";
import useUserDirectory from "../../hooks/useUserDirectory";
import { formatDate, formatEth } from "../../utils/formatters";
import StatusBadge from "../../components/common/StatusBadge";

function LoanCard({ loan, onOpen }) {
  const dueDate = loan.dueTimestamp && Number(loan.dueTimestamp) > 0 ? formatDate(loan.dueTimestamp) : "Pending funding";

  return (
    <button
      onClick={onOpen}
      className="group w-full rounded-[18px] border border-[#D6D3CE] bg-white p-5 text-left shadow-[0_2px_12px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-[Fraunces] text-2xl font-semibold text-[#00897B]">
            {formatEth(loan.amount)}
          </div>
          <p className="mt-1 font-[DM Sans] text-sm text-[#6B6B6B]">{loan.purpose}</p>
        </div>
        <StatusBadge state={loan.state} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-[#F5F3EE] p-3">
          <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.4px] text-[#6B6B6B]">Term</p>
          <p className="mt-1 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{Number(loan.termDays)} days</p>
        </div>
        <div className="rounded-xl bg-[#F5F3EE] p-3">
          <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.4px] text-[#6B6B6B]">Interest</p>
          <p className="mt-1 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{Number(loan.interestBps) / 100}%</p>
        </div>
        <div className="rounded-xl bg-[#F5F3EE] p-3">
          <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.4px] text-[#6B6B6B]">Due</p>
          <p className="mt-1 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{dueDate}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="font-mono text-[13px] text-[#6B6B6B]">
          {loan.borrower?.slice ? `${loan.borrower.slice(0, 6)}...${loan.borrower.slice(-4)}` : loan.borrower}
        </span>
        <span className="font-[DM Sans] text-sm font-semibold text-[#00897B] transition group-hover:translate-x-1">Open</span>
      </div>
    </button>
  );
}

export default function BorrowHome() {
  const navigate = useNavigate();
  const { address, isConnected, connect } = useWallet();
  const { getBorrowerLoans, getLoan } = useLoanRequest();
  const { getScore, getMaxLoan } = useReputation();
  const { getUserByWallet } = useUserDirectory();

  const [loading, setLoading] = useState(true);
  const [walletLoans, setWalletLoans] = useState([]);
  const [score, setScore] = useState(0);
  const [maxLoan, setMaxLoan] = useState("0.00");
  const [cibilScore, setCibilScore] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!isConnected || !address) {
        setWalletLoans([]);
        setScore(0);
        setMaxLoan("0.00");
        setCibilScore(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const [loanIds, trustScore, limit] = await Promise.all([
          getBorrowerLoans(address),
          getScore(address).catch(() => 0),
          getMaxLoan(address).catch(() => "0.00"),
        ]);
        const offchainUser = await getUserByWallet(address).catch(() => null);

        const resolvedLoans = await Promise.all(
          loanIds.map(async (id) => {
            const loan = await getLoan(id);
            return {
              ...loan,
              id: id.toString(),
            };
          }),
        );

        if (!active) return;
        setWalletLoans(resolvedLoans);
        setScore(trustScore);
        setMaxLoan(limit);
        setCibilScore(offchainUser?.cibilScore ?? null);
      } catch (err) {
        if (!active) return;
        setError(err.reason || err.message || "Could not load borrower dashboard");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [address, getBorrowerLoans, getLoan, getMaxLoan, getScore, getUserByWallet, isConnected]);

  const openLoan = (loanId) => navigate(`/borrow/${loanId}`);

  const summary = useMemo(() => {
    const totalLoans = walletLoans.length;
    const activeLoans = walletLoans.filter((loan) => Number(loan.state) === 0 || Number(loan.state) === 1 || Number(loan.state) === 2).length;
    return { totalLoans, activeLoans };
  }, [walletLoans]);

  if (!isConnected) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-7xl items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl rounded-[24px] border border-[#D6D3CE] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#00897B]">Borrower dashboard</p>
          <h1 className="mt-3 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Connect your wallet to manage loans</h1>
          <p className="mt-4 max-w-xl font-[DM Sans] text-base leading-7 text-[#4B4B4B]">
            Create a new borrowing request, track your active loans, and move through the repayment flow entirely on-chain.
          </p>
          <button
            onClick={connect}
            className="mt-7 rounded-lg bg-[#00897B] px-6 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#00574F]"
          >
            Connect Wallet
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[24px] border border-[#D6D3CE] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#00897B]">Borrower dashboard</p>
          <h1 className="mt-3 font-[Fraunces] text-4xl font-semibold leading-tight text-[#1A1A1A] md:text-5xl">
            Your borrowing space, powered by trust.
          </h1>
          <p className="mt-4 max-w-2xl font-[DM Sans] text-base leading-7 text-[#4B4B4B]">
            Review your current trust score, see the maximum loan available to you, and jump into a new request when you’re ready.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/borrow/new" className="rounded-lg bg-[#00897B] px-6 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#00574F]">
              New Loan Request
            </Link>
            <button
              onClick={() => navigate("/borrow/new")}
              className="rounded-lg border border-[#00897B] px-6 py-3 font-[DM Sans] text-sm font-semibold text-[#00897B] transition hover:bg-[#E0F2F1]"
            >
              Start Application
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-[24px] border border-[#D6D3CE] bg-[#1A1A1A] p-6 text-white shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
            <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[2px] text-[#A7F3D0]">Trust score</p>
            <div className="mt-3 font-[Fraunces] text-5xl font-semibold">{score}</div>
            <p className="mt-2 rounded-full bg-white/10 px-3 py-1 font-[DM Sans] text-xs font-semibold text-[#A7F3D0] inline-block">
              CIBIL: {cibilScore ?? "-"}
            </p>
            <p className="mt-2 font-[DM Sans] text-sm text-white/70">Higher trust opens larger loan ceilings and smoother approvals.</p>
          </div>
          <div className="rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[2px] text-[#6B6B6B]">Max loan</p>
            <div className="mt-3 font-[Fraunces] text-4xl font-semibold text-[#00897B]">{maxLoan} ETH</div>
            <p className="mt-2 font-[DM Sans] text-sm text-[#4B4B4B]">Current network limit based on your reputation profile.</p>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-[Fraunces] text-2xl font-semibold text-[#1A1A1A]">Your loans</h2>
            <p className="mt-1 font-[DM Sans] text-sm text-[#6B6B6B]">{summary.totalLoans} total · {summary.activeLoans} active</p>
          </div>
          <button onClick={() => navigate("/borrow/new")} className="rounded-lg bg-[#E0F2F1] px-4 py-2 font-[DM Sans] text-sm font-semibold text-[#00574F] transition hover:bg-[#D3EAE8]">
            Create another
          </button>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#D6D3CE] bg-[#F5F3EE] p-8 text-center font-[DM Sans] text-sm text-[#6B6B6B]">
            Loading your loan history from the chain...
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-5 font-[DM Sans] text-sm text-[#B91C1C]">
            {error}
          </div>
        ) : walletLoans.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#D6D3CE] bg-[#F5F3EE] p-8 text-center">
            <p className="font-[Fraunces] text-2xl font-semibold text-[#1A1A1A]">No loan requests yet</p>
            <p className="mt-2 font-[DM Sans] text-sm text-[#4B4B4B]">Start a new request and your first loan will appear here once it is created.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {walletLoans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} onOpen={() => openLoan(loan.id)} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
