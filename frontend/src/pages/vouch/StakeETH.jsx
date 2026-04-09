import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import useWallet from "../../hooks/useWallet";
import useLoanRequest from "../../hooks/useLoanRequest";
import useVouchPool from "../../hooks/useVouchPool";
import { formatEth, truncateAddress } from "../../utils/formatters";

const MIN_STAKE_BPS = 2000n;

function InfoChip({ label, value }) {
  return (
    <div className="rounded-xl bg-[#F5F3EE] p-3">
      <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.4px] text-[#6B6B6B]">{label}</p>
      <p className="mt-1 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{value}</p>
    </div>
  );
}

export default function StakeETH() {
  const { loanId } = useParams();
  const navigate = useNavigate();
  const { address, isConnected, connect, provider, balance } = useWallet();
  const { getLoan } = useLoanRequest();
  const { stake, getTotalStaked } = useVouchPool();

  const [loan, setLoan] = useState(null);
  const [totalStaked, setTotalStaked] = useState("0");
  const [walletBalanceWei, setWalletBalanceWei] = useState(0n);
  const [stakeAmount, setStakeAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!loanId) return;
      try {
        setLoading(true);
        setError("");

        const [loanData, total] = await Promise.all([
          getLoan(loanId),
          getTotalStaked(loanId),
        ]);

        let balanceWei = 0n;
        if (provider && address) {
          balanceWei = await provider.getBalance(address);
        }

        if (!active) return;
        setLoan(loanData);
        setTotalStaked(total);
        setWalletBalanceWei(balanceWei);
      } catch (err) {
        if (!active) return;
        setError(err.reason || err.message || "Could not load stake page");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [address, getLoan, getTotalStaked, loanId, provider]);

  const minStakeWei = useMemo(() => {
    if (!loan?.amount) return 0n;
    return (BigInt(loan.amount) * MIN_STAKE_BPS) / 10000n;
  }, [loan]);

  const stakeWei = useMemo(() => {
    if (!stakeAmount) return 0n;
    try {
      return ethers.parseEther(stakeAmount);
    } catch {
      return 0n;
    }
  }, [stakeAmount]);

  const projectedYieldWei = useMemo(() => {
    if (!loan?.interestBps || !stakeWei) return 0n;
    const interestRateBps = BigInt(loan.interestBps);
    return (stakeWei * interestRateBps * 3000n) / 10000n / 10000n;
  }, [loan, stakeWei]);

  const coveragePct = useMemo(() => {
    if (!loan?.amount || BigInt(loan.amount) === 0n) return 0;
    return Number((BigInt(totalStaked) * 100n) / BigInt(loan.amount));
  }, [loan, totalStaked]);

  async function handleStake() {
    if (!loanId) return;
    if (!stakeAmount || stakeWei <= 0n) {
      setError("Enter a valid ETH amount to stake");
      return;
    }
    if (stakeWei < minStakeWei) {
      setError(`Stake must be at least ${ethers.formatEther(minStakeWei)} ETH`);
      return;
    }
    if (stakeWei > walletBalanceWei) {
      setError("Not enough ETH in your wallet");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await stake(loanId, stakeAmount);
      toast.success("Stake confirmed");
      navigate("/vouch/active");
    } catch (err) {
      setError(err.reason || err.message || "Stake failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isConnected) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-6xl items-center justify-center px-4 py-10">
        <section className="w-full max-w-2xl rounded-[24px] border border-[#D6D3CE] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          <h1 className="font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Stake ETH as a voucher</h1>
          <p className="mt-3 font-[DM Sans] text-base leading-7 text-[#4B4B4B]">Connect your wallet to support this loan request with escrowed ETH.</p>
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

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-[24px] border border-[#D6D3CE] bg-white p-8 font-[DM Sans] text-sm text-[#6B6B6B] shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          Loading stake details...
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
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#5C35A8]">Loan summary</p>
          <h1 className="mt-2 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Stake for Loan #{loanId}</h1>
          <p className="mt-2 font-[DM Sans] text-sm text-[#4B4B4B]">Borrower {truncateAddress(loan.borrower)}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoChip label="Loan amount" value={formatEth(loan.amount)} />
            <InfoChip label="Interest rate" value={`${(Number(loan.interestBps) / 100).toFixed(1)}%`} />
            <InfoChip label="Term" value={`${Number(loan.termDays)} days`} />
            <InfoChip label="Already staked" value={formatEth(totalStaked)} />
          </div>

          <div className="mt-5 rounded-xl bg-[#F5F3EE] p-4">
            <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[1.4px] text-[#6B6B6B]">Purpose</p>
            <p className="mt-2 font-[DM Sans] text-sm leading-7 text-[#4B4B4B]">{loan.purpose || "No purpose provided"}</p>
          </div>
        </article>

        <article className="rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#5C35A8]">Your stake</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoChip label="Your ETH balance" value={balance} />
            <InfoChip label="Minimum stake (20%)" value={formatEth(minStakeWei)} />
            <InfoChip label="Coverage progress" value={`${coveragePct}%`} />
            <InfoChip label="Projected yield" value={formatEth(projectedYieldWei)} />
          </div>

          <div className="mt-5">
            <label className="font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">Stake amount (ETH)</label>
            <input
              value={stakeAmount}
              onChange={(event) => setStakeAmount(event.target.value)}
              placeholder={ethers.formatEther(minStakeWei)}
              className="mt-2 w-full rounded-xl border border-[#D6D3CE] px-4 py-3 font-[DM Sans] text-sm outline-none transition focus:border-[#5C35A8]"
            />
          </div>

          <label className="mt-4 flex items-start gap-3 rounded-xl bg-[#F5F3EE] p-4">
            <input type="checkbox" className="mt-1 accent-[#5C35A8]" defaultChecked />
            <span className="font-[DM Sans] text-sm leading-6 text-[#4B4B4B]">I understand I will lose this stake if the borrower defaults and default is finalized.</span>
          </label>

          {error ? <p className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 font-[DM Sans] text-sm text-[#B91C1C]">{error}</p> : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handleStake}
              disabled={submitting}
              className="rounded-lg bg-[#5C35A8] px-6 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#4A2B89] disabled:cursor-not-allowed disabled:bg-[#D6D3CE]"
            >
              {submitting ? "Staking..." : "Stake ETH"}
            </button>
            <Link
              to="/vouch/inbox"
              className="rounded-lg border border-[#D6D3CE] px-6 py-3 font-[DM Sans] text-sm font-semibold text-[#4B4B4B] transition hover:bg-[#F5F3EE]"
            >
              Back to Inbox
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
