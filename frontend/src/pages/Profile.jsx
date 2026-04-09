import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import useWallet from "../hooks/useWallet";
import useLoanRequest from "../hooks/useLoanRequest";
import useReputation from "../hooks/useReputation";
import useVouchPool from "../hooks/useVouchPool";
import useUserDirectory from "../hooks/useUserDirectory";
import StatusBadge from "../components/common/StatusBadge";
import { formatDate, formatEth, getScoreColor, truncateAddress } from "../utils/formatters";

function toNumber(value) {
  return Number(value || 0);
}

function toBigInt(value) {
  return BigInt(value || 0);
}

function HistoryCard({ loan }) {
  const due = Number(loan.dueTimestamp || 0) > 0 ? formatDate(loan.dueTimestamp) : "Pending funding";

  return (
    <div className="rounded-2xl border border-[#D6D3CE] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <p className="font-[Fraunces] text-xl font-semibold text-[#00897B]">{formatEth(loan.amount)}</p>
        <StatusBadge state={loan.state} />
      </div>
      <p className="mt-2 line-clamp-2 font-[DM Sans] text-sm text-[#4B4B4B]">{loan.purpose || "No purpose provided"}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetaChip label="Created" value={formatDate(loan.createdAt)} />
        <MetaChip label="Due" value={due} />
        <MetaChip label="Interest" value={`${(Number(loan.interestBps) / 100).toFixed(1)}%`} />
      </div>
      <div className="mt-4 flex justify-end">
        <Link
          to={`/borrow/${loan.id}`}
          className="rounded-lg bg-[#E0F2F1] px-4 py-2 font-[DM Sans] text-sm font-semibold text-[#00574F] transition hover:bg-[#CDE9E6]"
        >
          Track status
        </Link>
      </div>
    </div>
  );
}

function VouchCard({ row }) {
  return (
    <div className="rounded-2xl border border-[#D6D3CE] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <p className="font-[Fraunces] text-xl font-semibold text-[#5C35A8]">Loan #{row.loanId}</p>
        <StatusBadge state={row.state} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetaChip label="Stake" value={formatEth(row.stakeAmount)} />
        <MetaChip label="Outcome" value={row.outcomeText} />
        <MetaChip label="Net" value={row.netText} />
      </div>
      <div className="mt-4 flex justify-end">
        <Link
          to={`/borrow/${row.loanId}`}
          className="rounded-lg bg-[#EDE7F6] px-4 py-2 font-[DM Sans] text-sm font-semibold text-[#3B1F7A] transition hover:bg-[#DFD3F2]"
        >
          View loan
        </Link>
      </div>
    </div>
  );
}

function MetaChip({ label, value }) {
  return (
    <div className="rounded-xl bg-[#F5F3EE] p-3">
      <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.4px] text-[#6B6B6B]">{label}</p>
      <p className="mt-1 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{value}</p>
    </div>
  );
}

export default function Profile() {
  const params = useParams();
  const { address: connectedAddress, isConnected, connect } = useWallet();
  const { getBorrowerLoans, getLoan } = useLoanRequest();
  const { getScore, getMaxLoan, getProfile } = useReputation();
  const { getStakesByVoucher, getVouchers, getTotalStaked } = useVouchPool();
  const { getUserByWallet } = useUserDirectory();

  const targetAddress = useMemo(() => {
    if (params.address) return params.address;
    return connectedAddress || "";
  }, [connectedAddress, params.address]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("borrow");

  const [trustScore, setTrustScore] = useState(0);
  const [maxLoan, setMaxLoan] = useState("0.0000");
  const [profile, setProfile] = useState(null);
  const [offchainUser, setOffchainUser] = useState(null);
  const [borrowLoans, setBorrowLoans] = useState([]);
  const [vouchRows, setVouchRows] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!targetAddress) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [score, limit, profileStruct, borrowerLoanIds, voucherLoanIds, offchain] = await Promise.all([
          getScore(targetAddress).catch(() => 0),
          getMaxLoan(targetAddress).catch(() => "0.0000"),
          getProfile(targetAddress).catch(() => null),
          getBorrowerLoans(targetAddress).catch(() => []),
          getStakesByVoucher(targetAddress).catch(() => []),
          getUserByWallet(targetAddress).catch(() => null),
        ]);

        const loadedBorrowLoans = await Promise.all(
          borrowerLoanIds.map(async (loanId) => {
            const loan = await getLoan(loanId);
            return {
              ...loan,
              id: loanId.toString(),
            };
          }),
        );

        const loadedVouchRows = await Promise.all(
          voucherLoanIds.map(async (loanId) => {
            const [loan, vouchers, totalStaked] = await Promise.all([
              getLoan(loanId),
              getVouchers(loanId),
              getTotalStaked(loanId).catch(() => "0"),
            ]);

            const normalizedTarget = targetAddress.toLowerCase();
            const voucherEntry = vouchers.find((entry) => String(entry.wallet).toLowerCase() === normalizedTarget);
            const stakeAmount = toBigInt(voucherEntry?.stakeAmount || 0n);

            const interest = (toBigInt(loan.amount) * toBigInt(loan.interestBps)) / 10000n;
            const yieldPool = (interest * 3000n) / 10000n;
            const totalStakeBig = toBigInt(totalStaked);
            const estimatedYield = totalStakeBig > 0n ? (yieldPool * stakeAmount) / totalStakeBig : 0n;

            const state = Number(loan.state);
            let outcomeText = "Active";
            let netText = `+${formatEth(estimatedYield)}`;

            if (state === 3) {
              outcomeText = "Recovered + Yield";
              netText = `+${formatEth(estimatedYield)}`;
            } else if (state === 5) {
              outcomeText = "Slashed";
              netText = `-${formatEth(stakeAmount)}`;
            } else if (state === 4) {
              outcomeText = "Default Claimed";
              netText = "At risk";
            }

            return {
              loanId: loanId.toString(),
              state,
              stakeAmount,
              outcomeText,
              netText,
            };
          }),
        );

        if (!active) return;

        setTrustScore(Number(score));
        setMaxLoan(limit);
        setProfile(profileStruct);
        setOffchainUser(offchain);
        setBorrowLoans(loadedBorrowLoans.sort((a, b) => Number(b.id) - Number(a.id)));
        setVouchRows(loadedVouchRows.sort((a, b) => Number(b.loanId) - Number(a.loanId)));
      } catch (err) {
        if (!active) return;
        setError(err.reason || err.message || "Failed to load profile data");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [
    targetAddress,
    getScore,
    getMaxLoan,
    getProfile,
    getBorrowerLoans,
    getLoan,
    getUserByWallet,
    getStakesByVoucher,
    getVouchers,
    getTotalStaked,
  ]);

  const voucherAccuracy = useMemo(() => {
    const vouchCount = toNumber(profile?.vouchCount);
    if (vouchCount === 0) return 0;
    return Math.round((toNumber(profile?.successfulVouches) * 100) / vouchCount);
  }, [profile]);

  if (!targetAddress) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-6xl items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl rounded-[24px] border border-[#D6D3CE] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          <h1 className="font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Profile</h1>
          <p className="mt-3 font-[DM Sans] text-base text-[#4B4B4B]">Connect your wallet to view your profile and loan history.</p>
          {!isConnected ? (
            <button
              onClick={connect}
              className="mt-6 rounded-lg bg-[#00897B] px-6 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#00574F]"
            >
              Connect Wallet
            </button>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <section className="overflow-hidden rounded-[24px] border border-[#D6D3CE] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="h-2 bg-gradient-to-r from-[#00897B] via-[#2FA89B] to-[#5ABDB4]" />
        <div className="p-6 md:p-8">
          <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[2px] text-[#6B6B6B]">TrustCircle profile</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">{truncateAddress(targetAddress)}</h1>
              <p className="mt-2 font-mono text-[13px] text-[#4B4B4B]">{targetAddress}</p>
            </div>
            <div className="rounded-2xl bg-[#F5F3EE] px-4 py-3">
              <p className="font-[DM Sans] text-[11px] uppercase tracking-[1.4px] text-[#6B6B6B]">Member since</p>
              <p className="mt-1 font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{formatDate(profile?.mintedAt)}</p>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <section className="mt-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4 font-[DM Sans] text-sm text-[#B91C1C]">
          {error}
        </section>
      ) : null}

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[2px] text-[#00897B]">Trust score</p>
          <div className="mt-3 flex items-end gap-4">
            <span className="font-[Fraunces] text-6xl font-semibold" style={{ color: getScoreColor(trustScore) }}>{trustScore}</span>
            <span className="mb-2 rounded-full bg-[#F5F3EE] px-3 py-1 font-[DM Sans] text-xs font-semibold text-[#4B4B4B]">out of 100</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, trustScore))}%`, backgroundColor: getScoreColor(trustScore) }}
            />
          </div>
          <p className="mt-4 font-[DM Sans] text-sm text-[#4B4B4B]">Max current loan limit: <span className="font-semibold text-[#00897B]">{maxLoan} ETH</span></p>
        </div>

        <div className="rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[2px] text-[#1565C0]">Profile metrics</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MetaChip label="Loans repaid" value={String(toNumber(profile?.repaymentCount))} />
            <MetaChip label="Defaults" value={String(toNumber(profile?.defaultCount))} />
            <MetaChip label="Total borrowed" value={formatEth(profile?.totalBorrowed || 0n)} />
            <MetaChip label="Total repaid" value={formatEth(profile?.totalRepaid || 0n)} />
            <MetaChip label="Vouches made" value={String(toNumber(profile?.vouchCount))} />
            <MetaChip label="Voucher accuracy" value={`${voucherAccuracy}%`} />
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[2px] text-[#6B6B6B]">Saved Off-chain KYC</p>
        {offchainUser ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetaChip label="Name" value={offchainUser.name} />
            <MetaChip label="Age" value={String(offchainUser.age)} />
            <MetaChip label="PAN" value={offchainUser.panCardNumber} />
            <MetaChip label="CIBIL" value={String(offchainUser.cibilScore ?? "-")} />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-[#D6D3CE] bg-[#F5F3EE] p-5 font-[DM Sans] text-sm text-[#4B4B4B]">
            No off-chain profile record found for this wallet.
          </div>
        )}
      </section>

      <section className="mt-6 rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-[Fraunces] text-3xl font-semibold text-[#1A1A1A]">History</h2>
          <div className="flex rounded-xl border border-[#D6D3CE] bg-[#F5F3EE] p-1">
            <button
              onClick={() => setTab("borrow")}
              className={`rounded-lg px-4 py-2 font-[DM Sans] text-sm font-semibold transition ${tab === "borrow" ? "bg-white text-[#00897B]" : "text-[#4B4B4B]"}`}
            >
              Borrow history
            </button>
            <button
              onClick={() => setTab("vouch")}
              className={`rounded-lg px-4 py-2 font-[DM Sans] text-sm font-semibold transition ${tab === "vouch" ? "bg-white text-[#5C35A8]" : "text-[#4B4B4B]"}`}
            >
              Vouch history
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#D6D3CE] bg-[#F5F3EE] p-8 text-center font-[DM Sans] text-sm text-[#6B6B6B]">
            Loading on-chain profile data...
          </div>
        ) : tab === "borrow" ? (
          borrowLoans.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#D6D3CE] bg-[#F5F3EE] p-8 text-center font-[DM Sans] text-sm text-[#4B4B4B]">
              No borrower history yet.
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {borrowLoans.map((loan) => (
                <HistoryCard key={loan.id} loan={loan} />
              ))}
            </div>
          )
        ) : vouchRows.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#D6D3CE] bg-[#F5F3EE] p-8 text-center font-[DM Sans] text-sm text-[#4B4B4B]">
            No vouch history yet.
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {vouchRows.map((row) => (
              <VouchCard key={row.loanId} row={row} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
