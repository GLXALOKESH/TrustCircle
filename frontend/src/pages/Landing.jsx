import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <main className="relative overflow-hidden bg-[#F5F3EE] px-4 pb-16 pt-8 text-[#1A1A1A]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-6rem] top-[-5rem] h-72 w-72 rounded-full bg-[#E0F2F1] blur-3xl opacity-70" />
        <div className="absolute right-[-4rem] top-24 h-80 w-80 rounded-full bg-[#EDE7F6] blur-3xl opacity-70" />
        <div className="absolute bottom-[-7rem] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#FEF3C7] blur-3xl opacity-40" />
      </div>

      <section className="relative mx-auto grid w-full max-w-7xl gap-10 pt-10 md:grid-cols-[1.05fr_0.95fr] md:items-center md:pt-14">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D6D3CE] bg-white/80 px-4 py-2 shadow-[0_2px_12px_rgba(0,0,0,0.04)] backdrop-blur">
            <span className="h-2.5 w-2.5 rounded-full bg-[#00897B]" />
            <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[2px] text-[#00897B]">
              SOCIAL-VOUCHED MICRO-LENDING
            </p>
          </div>

          <div className="max-w-3xl">
            <h1 className="font-[Fraunces] text-5xl font-bold leading-[0.96] tracking-[-1.8px] text-[#1A1A1A] md:text-[72px]">
              Borrow with trust.
              <br />
              Not with collateral.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#4B4B4B] md:text-xl">
              TrustCircle turns social trust into lending access. Vouchers stake ETH on behalf of a
              borrower, lenders fund only fully vouched loans, and reputation grows with every
              repayment.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/borrow/new"
              className="rounded-lg bg-[#00897B] px-6 py-3.5 font-[DM Sans] text-sm font-semibold text-white shadow-[0_12px_24px_rgba(0,137,123,0.18)] transition hover:-translate-y-0.5 hover:bg-[#00574F]"
            >
              Start Borrowing
            </Link>
            <Link
              to="/lend/browse"
              className="rounded-lg border border-[#00897B] bg-white/80 px-6 py-3.5 font-[DM Sans] text-sm font-semibold text-[#00897B] backdrop-blur transition hover:-translate-y-0.5 hover:bg-[#E0F2F1]"
            >
              Fund a Loan
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { value: "3 roles", label: "Borrower, voucher, lender" },
              { value: "80%", label: "Minimum coverage required" },
              { value: "0 backend", label: "Everything on-chain" },
            ].map((item) => (
              <div key={item.label} className="rounded-[10px] border border-[#D6D3CE] bg-white/80 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] backdrop-blur">
                <div className="font-[Fraunces] text-2xl font-semibold text-[#1A1A1A]">{item.value}</div>
                <div className="mt-1 font-[DM Sans] text-sm text-[#6B6B6B]">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute left-6 top-6 h-full w-full rounded-[24px] border border-[#D6D3CE] bg-[#1A1A1A]/5 blur-2xl" />
          <div className="relative overflow-hidden rounded-[24px] border border-[#D6D3CE] bg-white p-5 shadow-[0_24px_60px_rgba(0,0,0,0.10)]">
            <div className="flex items-center justify-between border-b border-[#E9E7E3] pb-4">
              <div>
                <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[1.8px] text-[#6B6B6B]">
                  Live trust network
                </p>
                <h2 className="mt-1 font-[Fraunces] text-2xl font-semibold text-[#1A1A1A]">
                  Reputation flows through the circle
                </h2>
              </div>
              <div className="rounded-full bg-[#E0F2F1] px-3 py-1 font-[DM Sans] text-xs font-semibold text-[#00574F]">
                Sepolia-ready
              </div>
            </div>

            <div className="mt-5 rounded-[20px] bg-gradient-to-br from-[#FFFFFF] via-[#F5F3EE] to-[#E0F2F1] p-4">
              <svg viewBox="0 0 480 360" className="h-auto w-full">
                <defs>
                  <linearGradient id="trust-line" x1="0%" x2="100%" y1="0%" y2="0%">
                    <stop offset="0%" stopColor="#A8A49E" />
                    <stop offset="100%" stopColor="#00897B" />
                  </linearGradient>
                  <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000000" floodOpacity="0.12" />
                  </filter>
                </defs>

                <style>
                  {`\n+                    .pulse-line { stroke-dasharray: 10 10; animation: dash 3.5s linear infinite; }\n+                    .float { animation: float 4.8s ease-in-out infinite; }\n+                    .float-delayed { animation: float 5.6s ease-in-out infinite 0.8s; }\n+                    @keyframes dash { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } }\n+                    @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }\n+                  `}
                </style>

                <path className="pulse-line" d="M240 150 C180 110, 136 88, 95 95" fill="none" stroke="url(#trust-line)" strokeWidth="2.5" />
                <path className="pulse-line" d="M240 150 C178 170, 128 190, 90 215" fill="none" stroke="url(#trust-line)" strokeWidth="2.5" />
                <path className="pulse-line" d="M240 150 C300 110, 348 90, 390 86" fill="none" stroke="url(#trust-line)" strokeWidth="2.5" />
                <path className="pulse-line" d="M240 150 C302 182, 352 214, 392 242" fill="none" stroke="url(#trust-line)" strokeWidth="2.5" />

                <g filter="url(#soft-shadow)">
                  <circle cx="240" cy="150" r="44" fill="#00897B" className="float" />
                  <circle cx="95" cy="95" r="28" fill="#5C35A8" className="float-delayed" />
                  <circle cx="90" cy="215" r="28" fill="#5C35A8" className="float" />
                  <circle cx="390" cy="86" r="28" fill="#5C35A8" className="float-delayed" />
                  <circle cx="392" cy="242" r="34" fill="#D97706" className="float" />
                </g>

                <g className="fill-white font-[DM Sans] text-[12px] font-semibold">
                  <text x="240" y="154" textAnchor="middle">Borrower</text>
                  <text x="95" y="99" textAnchor="middle" className="text-[11px]">Voucher</text>
                  <text x="90" y="219" textAnchor="middle" className="text-[11px]">Voucher</text>
                  <text x="390" y="90" textAnchor="middle" className="text-[11px]">Voucher</text>
                  <text x="392" y="246" textAnchor="middle" className="text-[11px]">Lender</text>
                </g>
              </svg>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[14px] bg-[#F5F3EE] p-4">
                <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[1.5px] text-[#6B6B6B]">
                  Flow
                </p>
                <p className="mt-2 font-[Fraunces] text-xl font-semibold text-[#1A1A1A]">
                  Create, stake, fund, repay
                </p>
              </div>
              <div className="rounded-[14px] bg-[#E0F2F1] p-4">
                <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[1.5px] text-[#00574F]">
                  Trust score
                </p>
                <p className="mt-2 font-[Fraunces] text-xl font-semibold text-[#00574F]">
                  Earned through behavior, not paperwork
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto mt-16 grid w-full max-w-7xl gap-4 md:grid-cols-3">
        {[
          {
            step: "01",
            title: "Request a loan",
            copy: "Borrowers submit purpose, amount, and invite trusted vouchers.",
          },
          {
            step: "02",
            title: "Your network vouches",
            copy: "Friends stake ETH. Coverage grows toward the activation threshold.",
          },
          {
            step: "03",
            title: "Get funded",
            copy: "Lenders fund only fully vouched requests and reputation updates on repayment.",
          },
        ].map((item) => (
          <div key={item.step} className="rounded-[20px] border border-[#D6D3CE] bg-white/85 p-6 shadow-[0_2px_12px_rgba(0,0,0,0.05)] backdrop-blur">
            <div className="font-[Fraunces] text-5xl font-semibold text-[#E0F2F1]">{item.step}</div>
            <h3 className="mt-3 font-[Fraunces] text-2xl font-semibold text-[#1A1A1A]">{item.title}</h3>
            <p className="mt-3 font-[DM Sans] text-[15px] leading-7 text-[#4B4B4B]">{item.copy}</p>
          </div>
        ))}
      </section>

      <section className="relative mx-auto mt-16 max-w-7xl overflow-hidden rounded-[24px] bg-[#1A1A1A] px-6 py-8 text-white shadow-[0_24px_60px_rgba(0,0,0,0.12)] md:px-8">
        <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#A7F3D0]">
              Built for trust, not hype
            </p>
            <h2 className="mt-3 font-[Fraunces] text-3xl font-semibold leading-tight md:text-4xl">
              A lending primitive that rewards reputation over speculation.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { value: "0", label: "backend servers" },
              { value: "3", label: "wallet roles" },
              { value: "1", label: "on-chain truth" },
            ].map((item) => (
              <div key={item.label} className="rounded-[14px] border border-white/10 bg-white/5 p-4 text-center">
                <div className="font-[Fraunces] text-3xl font-semibold text-white">{item.value}</div>
                <div className="mt-1 font-[DM Sans] text-xs uppercase tracking-[1.5px] text-[#D1D5DB]">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
