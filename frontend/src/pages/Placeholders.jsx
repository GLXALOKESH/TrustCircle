function Shell({ title }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="rounded-[10px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <h1 className="font-[Fraunces] text-[32px] font-semibold text-[#1A1A1A]">{title}</h1>
        <p className="mt-2 font-[DM Sans] text-base text-[#4B4B4B]">
          This page scaffold is ready for implementation.
        </p>
      </div>
    </main>
  );
}

export const Stats = () => <Shell title="Platform Stats" />;
export const Profile = () => <Shell title="Profile" />;

export const BorrowHome = () => <Shell title="Borrow Home" />;
export const NewLoan = () => <Shell title="Create New Loan" />;
export const LoanStatus = () => <Shell title="Loan Status" />;
export const Repay = () => <Shell title="Repay Loan" />;
export const Dispute = () => <Shell title="Dispute Default" />;

export const VouchHome = () => <Shell title="Vouch Home" />;
export const Inbox = () => <Shell title="Vouch Inbox" />;
export const StakeETH = () => <Shell title="Stake ETH" />;
export const ActiveVouches = () => <Shell title="Active Vouches" />;
export const VouchHistory = () => <Shell title="Vouch History" />;

export const LendHome = () => <Shell title="Lend Home" />;
export const LendBrowse = () => <Shell title="Browse Loans" />;
export const LoanDetail = () => <Shell title="Loan Detail" />;
export const Portfolio = () => <Shell title="Lender Portfolio" />;
export const ClaimDefault = () => <Shell title="Claim Default" />;
