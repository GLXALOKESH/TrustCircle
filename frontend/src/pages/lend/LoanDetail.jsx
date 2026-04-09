import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import useWallet from "../../hooks/useWallet";
import useLoanRequest from "../../hooks/useLoanRequest";
import useReputation from "../../hooks/useReputation";
import useVouchPool from "../../hooks/useVouchPool";
import useUserDirectory from "../../hooks/useUserDirectory";
import StatusBadge from "../../components/common/StatusBadge";
import { formatEth, truncateAddress } from "../../utils/formatters";

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-[#F5F3EE] p-3">
      <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.3px] text-[#6B6B6B]">{label}</p>
      <p className="mt-1 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{value}</p>
    </div>
  );
}

export default function LoanDetail() {
  const { loanId } = useParams();
  const navigate = useNavigate();
  const { isConnected, connect } = useWallet();
  const { getLoan, fundLoan } = useLoanRequest();
  const { getScore, getProfile } = useReputation();
  const { getVouchers, getTotalStaked } = useVouchPool();
  const { getUserByWallet } = useUserDirectory();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loan, setLoan] = useState(null);
  const [borrowerScore, setBorrowerScore] = useState(0);
  const [borrowerProfile, setBorrowerProfile] = useState(null);
  const [borrowerUser, setBorrowerUser] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [totalStakedWei, setTotalStakedWei] = useState(0n);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!loanId) return;
      try {
        setLoading(true);
        setError("");

        const [loanData, voucherData, totalStaked] = await Promise.all([
          getLoan(loanId),
          getVouchers(loanId),
          getTotalStaked(loanId).catch(() => "0"),
        ]);

        const [score, profile, voucherRows, offchainBorrower] = await Promise.all([
          getScore(loanData.borrower).catch(() => 0),
          getProfile(loanData.borrower).catch(() => null),
          Promise.all(
            voucherData.map(async (voucher) => {
              const vScore = await getScore(voucher.wallet).catch(() => 0);
              const vProfile = await getProfile(voucher.wallet).catch(() => null);
              const vouchCount = Number(vProfile?.vouchCount || 0);
              const vAccuracy = vouchCount > 0
                ? Math.round((Number(vProfile?.successfulVouches || 0) * 100) / vouchCount)
                : 0;

              return {
                wallet: voucher.wallet,
                stakeAmount: voucher.stakeAmount,
                hasStaked: voucher.hasStaked,
                score: vScore,
                accuracy: vAccuracy,
              };
            }),
          ),
          getUserByWallet(loanData.borrower).catch(() => null),
        ]);

        if (!active) return;
        setLoan(loanData);
        setBorrowerScore(Number(score));
        setBorrowerProfile(profile);
        setBorrowerUser(offchainBorrower);
        setVouchers(voucherRows);
        setTotalStakedWei(BigInt(totalStaked || 0));
      } catch (err) {
        if (!active) return;
        setError(err.reason || err.message || "Failed to load loan detail");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [loanId, getLoan, getVouchers, getTotalStaked, getScore, getProfile, getUserByWallet]);

  const risk = useMemo(() => {
    if (!loan) {
      return {
        coveragePct: 0,
        netExposureWei: 0n,
        lenderReturnWei: 0n,
        interestWei: 0n,
      };
    }

    const amount = BigInt(loan.amount || 0n);
    const interestWei = (amount * BigInt(loan.interestBps || 0)) / 10000n;
    const lenderReturnWei = amount + ((interestWei * 7000n) / 10000n);
    const coveragePct = amount > 0n ? Number((totalStakedWei * 100n) / amount) : 0;
    const netExposureWei = amount > totalStakedWei ? amount - totalStakedWei : 0n;

    return {
      coveragePct,
      netExposureWei,
      lenderReturnWei,
      interestWei,
    };
  }, [loan, totalStakedWei]);

  async function handleFund() {
    if (!loanId || !loan) return;

    try {
      setSubmitting(true);
      setError("");
      await fundLoan(loanId, loan.amount);
      toast.success("Loan funded successfully");
      navigate("/lend/portfolio");
    } catch (err) {
      setError(err.reason || err.message || "Funding failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isConnected) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-6xl items-center justify-center px-4 py-10">
        <section className="w-full max-w-2xl rounded-[24px] border border-[#D6D3CE] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          <h1 className="font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Loan Detail</h1>
          <p className="mt-3 font-[DM Sans] text-base leading-7 text-[#4B4B4B]">Connect your wallet to review and fund this loan.</p>
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

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="rounded-[24px] border border-[#D6D3CE] bg-white p-8 font-[DM Sans] text-sm text-[#6B6B6B] shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          Loading loan details...
        </div>
      </main>
    );
  }

  if (!loan) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] p-6 font-[DM Sans] text-sm text-[#B91C1C]">Loan not found.</div>
      </main>
    );
  }

  const canFund = Number(loan.state) === 1;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.07)] md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#D97706]">Loan detail</p>
              <h1 className="mt-2 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Fund Loan #{loanId}</h1>
              <p className="mt-2 font-[DM Sans] text-sm text-[#4B4B4B]">Borrower {truncateAddress(loan.borrower)} · Trust score {borrowerScore}</p>
              {borrowerUser ? (
                <p className="mt-1 font-[DM Sans] text-xs text-[#4B4B4B]">{borrowerUser.name} · Age {borrowerUser.age} · PAN {borrowerUser.panCardNumber} · CIBIL {borrowerUser.cibilScore ?? "-"}</p>
              ) : null}
            </div>
            <StatusBadge state={loan.state} />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Loan amount" value={formatEth(loan.amount)} />
            <Metric label="Interest rate" value={`${(Number(loan.interestBps) / 100).toFixed(1)}%`} />
            <Metric label="Term" value={`${Number(loan.termDays)} days`} />
            <Metric label="Repayments" value={String(Number(borrowerProfile?.repaymentCount || 0))} />
            <Metric label="Defaults" value={String(Number(borrowerProfile?.defaultCount || 0))} />
            <Metric label="Total repaid" value={formatEth(borrowerProfile?.totalRepaid || 0n)} />
          </div>

          <div className="mt-6 rounded-xl bg-[#F5F3EE] p-4">
            <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[1.4px] text-[#6B6B6B]">Purpose</p>
            <p className="mt-2 font-[DM Sans] text-sm leading-7 text-[#4B4B4B]">{loan.purpose || "No purpose provided"}</p>
          </div>

          <div className="mt-6">
            <h2 className="font-[Fraunces] text-2xl font-semibold text-[#1A1A1A]">Vouchers</h2>
            <div className="mt-3 space-y-3">
              {vouchers.length === 0 ? (
                <div className="rounded-xl bg-[#F5F3EE] p-4 font-[DM Sans] text-sm text-[#4B4B4B]">No vouchers found.</div>
              ) : (
                vouchers.map((voucher) => (
                  <div key={voucher.wallet} className="rounded-xl border border-[#D6D3CE] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-mono text-[13px] text-[#1A1A1A]">{voucher.wallet}</p>
                      <span className={`rounded-full px-3 py-1 font-[DM Sans] text-xs font-semibold ${voucher.hasStaked ? "bg-[#EDE7F6] text-[#3B1F7A]" : "bg-[#F5F3EE] text-[#6B6B6B]"}`}>
                        {voucher.hasStaked ? "Staked" : "Invited"}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <Metric label="Rep score" value={String(voucher.score)} />
                      <Metric label="Stake" value={formatEth(voucher.stakeAmount)} />
                      <Metric label="Accuracy" value={`${voucher.accuracy}%`} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </article>

        <aside className="space-y-6">
          <article className="sticky top-24 rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
            <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#D97706]">Funding summary</p>
            <div className="mt-4 space-y-3">
              <Metric label="Principal" value={formatEth(loan.amount)} />
              <Metric label="Lender return" value={formatEth(risk.lenderReturnWei)} />
              <Metric label="Voucher cover" value={`${risk.coveragePct}%`} />
              <Metric label="Net exposure" value={formatEth(risk.netExposureWei)} />
            </div>

            <button
              onClick={handleFund}
              disabled={!canFund || submitting}
              className="mt-6 w-full rounded-lg bg-[#D97706] px-5 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#B45309] disabled:cursor-not-allowed disabled:bg-[#D6D3CE] disabled:text-[#9CA3AF]"
            >
              {submitting ? "Funding..." : `Fund This Loan (${formatEth(loan.amount)})`}
            </button>

            {!canFund ? (
              <p className="mt-3 rounded-xl bg-[#F5F3EE] p-3 font-[DM Sans] text-xs text-[#6B6B6B]">This loan is no longer in fully-vouched state.</p>
            ) : null}

            {error ? (
              <p className="mt-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 font-[DM Sans] text-sm text-[#B91C1C]">{error}</p>
            ) : null}

            <Link
              to="/lend/browse"
              className="mt-3 block w-full rounded-lg border border-[#D6D3CE] px-5 py-3 text-center font-[DM Sans] text-sm font-semibold text-[#4B4B4B] transition hover:bg-[#F5F3EE]"
            >
              Back to Browse
            </Link>
          </article>
        </aside>
      </section>
    </main>
  );
}
