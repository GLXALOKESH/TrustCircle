import { Link } from "react-router-dom";

export default function LendHome() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <section className="rounded-[24px] border border-[#D6D3CE] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#D97706]">Lender</p>
        <h1 className="mt-2 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Fund trusted loans</h1>
        <p className="mt-3 max-w-2xl font-[DM Sans] text-base leading-7 text-[#4B4B4B]">
          Browse fully-vouched requests, evaluate borrower and voucher signals, and deploy capital with transparent on-chain risk.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/lend/browse"
            className="rounded-lg bg-[#D97706] px-6 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#B45309]"
          >
            Browse Loans
          </Link>
          <Link
            to="/lend/portfolio"
            className="rounded-lg border border-[#D97706] px-6 py-3 font-[DM Sans] text-sm font-semibold text-[#D97706] transition hover:bg-[#FEF3C7]"
          >
            View Portfolio
          </Link>
        </div>
      </section>
    </main>
  );
}
