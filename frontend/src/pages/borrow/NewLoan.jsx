import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import useWallet from "../../hooks/useWallet";
import useLoanRequest from "../../hooks/useLoanRequest";
import useReputation from "../../hooks/useReputation";
import useUserDirectory from "../../hooks/useUserDirectory";
import { formatEth } from "../../utils/formatters";
import { MAX_INTEREST_BPS, MAX_TERM_DAYS, MIN_INTEREST_BPS, MIN_VOUCHERS, MAX_VOUCHERS } from "../../utils/constants";
import useLoanValidation from "../../hooks/useLoanValidation";

function normalizeVoucherInputs(inputs) {
  return inputs.map((value) => value.trim()).filter(Boolean);
}

export default function NewLoan() {
  const navigate = useNavigate();
  const { address, isConnected, connect } = useWallet();
  const { createLoanRequest } = useLoanRequest();
  const { getMaxLoan } = useReputation();
  const { getUserByWallet } = useUserDirectory();

  const [step, setStep] = useState(1);
  const [maxLoan, setMaxLoan] = useState("0.00");
  const [loadingMax, setLoadingMax] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [cibilScore, setCibilScore] = useState(null);
  const [borrowerAge, setBorrowerAge] = useState(null);

  const [amount, setAmount] = useState("");
  const [termDays, setTermDays] = useState(30);
  const [interestBps, setInterestBps] = useState(1000);
  const [purpose, setPurpose] = useState("");
  const [voucherInputs, setVoucherInputs] = useState(["", ""]);

  useEffect(() => {
    setError("");
  }, [amount, termDays, interestBps, purpose, voucherInputs, cibilScore, maxLoan]);

  useEffect(() => {
    let active = true;

    async function loadLimit() {
      if (!isConnected || !address) {
        setMaxLoan("0.00");
        setCibilScore(null);
        setBorrowerAge(null);
        return;
      }
      try {
        setLoadingMax(true);
        const [limit, userRecord] = await Promise.all([
          getMaxLoan(address),
          getUserByWallet(address).catch(() => null),
        ]);
        if (active) {
          setMaxLoan(limit);
          setCibilScore(userRecord?.cibilScore ?? null);
          setBorrowerAge(userRecord?.age ?? null);
        }
      } catch {
        if (active) {
          setMaxLoan("0.00");
          setCibilScore(null);
          setBorrowerAge(null);
        }
      } finally {
        if (active) setLoadingMax(false);
      }
    }

    loadLimit();
    return () => {
      active = false;
    };
  }, [address, getMaxLoan, getUserByWallet, isConnected]);

  const amountNumber = Number(amount || 0);
  const maxLoanNumber = Number(maxLoan || 0);

  const ageRiskConfig = useMemo(() => {
    const age = Number(borrowerAge);
    if (!Number.isFinite(age)) {
      return {
        multiplier: 1,
        maxTermDays: MAX_TERM_DAYS,
        label: "Age policy unavailable: default limits applied",
      };
    }

    if (age < 21) {
      return {
        multiplier: 0.35,
        maxTermDays: MAX_TERM_DAYS,
        label: "Age < 21: 35% of normal max loan",
      };
    }

    if (age <= 60) {
      return {
        multiplier: 1,
        maxTermDays: MAX_TERM_DAYS,
        label: "Age 21-60: 100% of normal max loan",
      };
    }

    if (age <= 75) {
      return {
        multiplier: 0.6,
        maxTermDays: MAX_TERM_DAYS,
        label: "Age 61-75: 60% of normal max loan",
      };
    }

    return {
      multiplier: 0.3,
      maxTermDays: 180,
      label: "Age > 75: 30% of normal max loan and shorter tenure",
    };
  }, [borrowerAge]);

  const ageAdjustedMaxLoan = maxLoanNumber * ageRiskConfig.multiplier;
  const effectiveMaxLoan = Number.isFinite(ageAdjustedMaxLoan) ? ageAdjustedMaxLoan : maxLoanNumber;

  useEffect(() => {
    setTermDays((current) => (current > ageRiskConfig.maxTermDays ? ageRiskConfig.maxTermDays : current));
  }, [ageRiskConfig.maxTermDays]);

  const cibilConfig = useMemo(() => {
    const score = Number(cibilScore || 0);

    if (!Number.isFinite(score) || score < 600) {
      return {
        vouchersMandatory: true,
        noVoucherCapRatio: 0,
        label: "CIBIL below 600: vouchers mandatory",
      };
    }
    if (score < 700) {
      return {
        vouchersMandatory: false,
        noVoucherCapRatio: 0.5,
        label: "CIBIL 600-699: voucher-free up to 50% of max limit",
      };
    }
    if (score < 800) {
      return {
        vouchersMandatory: false,
        noVoucherCapRatio: 0.7,
        label: "CIBIL 700-799: voucher-free up to 70% of max limit",
      };
    }
    if (score <= 850) {
      return {
        vouchersMandatory: false,
        noVoucherCapRatio: 0.9,
        label: "CIBIL 800-850: voucher-free up to 90% of max limit",
      };
    }
    return {
      vouchersMandatory: false,
      noVoucherCapRatio: 1,
      label: "CIBIL > 850: voucher-free up to 100% of max limit",
    };
  }, [cibilScore]);

  const noVoucherCapAmount = maxLoanNumber * cibilConfig.noVoucherCapRatio;
  const requiresVouchersForAmount = cibilConfig.vouchersMandatory || amountNumber > noVoucherCapAmount;
  const minimumVouchersRequired = requiresVouchersForAmount ? MIN_VOUCHERS : 0;
  const totalSteps = requiresVouchersForAmount ? 3 : 2;
  const displayedStep = !requiresVouchersForAmount && step === 3 ? 2 : step;

  const {
    normalizedVoucherInputs: voucherAddresses,
    voucherChecks,
    amountValid,
    termValid,
    interestValid,
    purposeValid,
    voucherCountValid,
    voucherAddressValid,
    canContinueStep1,
    canContinueStep2,
    estimatedInterest,
    totalRepayment,
    voucherYield,
  } = useLoanValidation({
    amount,
    maxLoan: String(effectiveMaxLoan),
    termDays,
    maxTermDays: ageRiskConfig.maxTermDays,
    interestBps,
    purpose,
    voucherInputs,
    borrowerAddress: address,
    vouchersRequired: requiresVouchersForAmount,
    minimumVouchers: minimumVouchersRequired,
    maximumVouchers: MAX_VOUCHERS,
  });

  function updateVoucher(index, value) {
    setVoucherInputs((current) => current.map((entry, position) => (position === index ? value : entry)));
  }

  function addVoucher() {
    if (voucherInputs.length >= MAX_VOUCHERS) return;
    setVoucherInputs((current) => [...current, ""]);
  }

  function removeVoucher(index) {
    if (voucherInputs.length <= minimumVouchersRequired) return;
    setVoucherInputs((current) => current.filter((_, position) => position !== index));
  }

  async function handleSubmit() {
    if (amountNumber > effectiveMaxLoan) {
      setError(`Requested amount exceeds your age-adjusted cap (${effectiveMaxLoan.toFixed(4)} ETH).`);
      return;
    }

    if (Number(termDays) > ageRiskConfig.maxTermDays) {
      setError(`Loan tenure exceeds your age-based limit (${ageRiskConfig.maxTermDays} days).`);
      return;
    }

    const vouchersSatisfied = requiresVouchersForAmount ? canContinueStep2 : true;
    if (!canContinueStep1 || !vouchersSatisfied) {
      setError("Please fix the highlighted fields before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const result = await createLoanRequest(
        amount,
        Number(termDays),
        Number(interestBps),
        purpose.trim(),
        requiresVouchersForAmount ? voucherAddresses : [],
      );
      if (result.loanId) {
        navigate(`/borrow/${result.loanId}`);
      } else {
        navigate("/borrow");
      }
    } catch (err) {
      setError(err.reason || err.message || "Could not create loan request");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isConnected) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-5xl items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl rounded-[24px] border border-[#D6D3CE] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <p className="font-[Fraunces] text-3xl font-semibold text-[#1A1A1A]">Connect to create a loan</p>
          <p className="mt-3 font-[DM Sans] text-base leading-7 text-[#4B4B4B]">
            Borrower loan creation is fully on-chain. Connect your wallet to build and submit a request.
          </p>
          <button onClick={connect} className="mt-6 rounded-lg bg-[#00897B] px-6 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#00574F]">
            Connect Wallet
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <section className="rounded-[24px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#00897B]">Borrow</p>
            <h1 className="mt-2 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Create a new borrowing request</h1>
            <p className="mt-3 max-w-2xl font-[DM Sans] text-base leading-7 text-[#4B4B4B]">
              Structure your loan, invite your vouchers, and submit a fully vouched request to the chain.
            </p>
          </div>
          <div className="rounded-2xl bg-[#F5F3EE] px-4 py-3">
            <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[1.5px] text-[#6B6B6B]">Max loan</p>
            <p className="mt-1 font-[Fraunces] text-2xl font-semibold text-[#00897B]">
              {loadingMax ? "Loading..." : `${formatEth(ethers.parseEther(maxLoan || "0"))}`}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          {Array.from({ length: totalSteps }, (_, index) => index + 1).map((currentStep) => (
            <div
              key={currentStep}
              className={`h-2 flex-1 rounded-full ${currentStep <= displayedStep ? "bg-[#00897B]" : "bg-[#E5E7EB]"}`}
            />
          ))}
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4 font-[DM Sans] text-sm text-[#B91C1C]">
            {error}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <Field label="Loan amount (ETH)" helper={`Your age-adjusted max loan: ${effectiveMaxLoan.toFixed(4)} ETH`}>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.05"
                  className={`w-full rounded-xl border px-4 py-3 font-[DM Sans] text-sm outline-none transition ${
                    amount && !amountValid ? "border-[#D32F2F] focus:border-[#D32F2F]" : "border-[#D6D3CE] focus:border-[#00897B]"
                  }`}
                />
                {amount && !amountValid && (
                  <p className="mt-2 font-[DM Sans] text-xs text-[#D32F2F]">
                    Amount must be between 0 and {effectiveMaxLoan.toFixed(4)} ETH
                  </p>
                )}
              </Field>

              <div className="rounded-2xl border border-[#D6D3CE] bg-[#F5F3EE] p-4">
                <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[1.4px] text-[#6B6B6B]">
                  Age risk policy
                </p>
                <p className="mt-2 font-[DM Sans] text-sm text-[#1A1A1A]">
                  Your age: <span className="font-semibold">{borrowerAge ?? "Not available"}</span>
                </p>
                <p className="mt-1 font-[DM Sans] text-sm text-[#4B4B4B]">{ageRiskConfig.label}</p>
                <p className="mt-1 font-[DM Sans] text-sm text-[#4B4B4B]">
                  Allowed loan after age multiplier: {effectiveMaxLoan.toFixed(4)} ETH
                </p>
                <p className="mt-1 font-[DM Sans] text-sm text-[#4B4B4B]">
                  Max tenure for your age: {ageRiskConfig.maxTermDays} days
                </p>
              </div>

              <div className="rounded-2xl border border-[#D6D3CE] bg-[#F5F3EE] p-4">
                <p className="font-[DM Sans] text-[12px] font-semibold uppercase tracking-[1.4px] text-[#6B6B6B]">
                  CIBIL policy
                </p>
                <p className="mt-2 font-[DM Sans] text-sm text-[#1A1A1A]">
                  Your CIBIL: <span className="font-semibold">{cibilScore ?? "Not available"}</span>
                </p>
                <p className="mt-1 font-[DM Sans] text-sm text-[#4B4B4B]">{cibilConfig.label}</p>
                {!cibilConfig.vouchersMandatory ? (
                  <p className="mt-1 font-[DM Sans] text-sm text-[#4B4B4B]">
                    Voucher-free cap for your tier: {noVoucherCapAmount.toFixed(4)} ETH
                  </p>
                ) : null}
                <p className={`mt-2 font-[DM Sans] text-sm font-semibold ${requiresVouchersForAmount ? "text-[#B45309]" : "text-[#15803D]"}`}>
                  {requiresVouchersForAmount
                    ? "Vouchers are required for this amount."
                    : "No vouchers required for this amount tier."}
                </p>
              </div>

              <Field label={`Loan term: ${termDays} days`} helper={`1 to ${ageRiskConfig.maxTermDays} days`}>
                <input
                  type="range"
                  min={1}
                  max={ageRiskConfig.maxTermDays}
                  value={termDays}
                  onChange={(event) => setTermDays(Number(event.target.value))}
                  className="w-full accent-[#00897B]"
                />
              </Field>

              <Field label={`Interest rate: ${(interestBps / 100).toFixed(1)}%`} helper="1% to 50%">
                <input
                  type="range"
                  min={MIN_INTEREST_BPS}
                  max={MAX_INTEREST_BPS}
                  step={50}
                  value={interestBps}
                  onChange={(event) => setInterestBps(Number(event.target.value))}
                  className="w-full accent-[#00897B]"
                />
              </Field>

              <Field label="Purpose" helper={`${purpose.trim().length}/140 characters`}>
                <textarea
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value.slice(0, 140))}
                  rows={5}
                  placeholder="Medical emergency, education, business inventory..."
                  className={`w-full rounded-xl border px-4 py-3 font-[DM Sans] text-sm outline-none transition ${
                    purpose.trim().length === 0 ? "border-[#D32F2F] focus:border-[#D32F2F]" : "border-[#D6D3CE] focus:border-[#00897B]"
                  }`}
                />
                {purpose.trim().length === 0 && (
                  <p className="mt-2 font-[DM Sans] text-xs text-[#D32F2F]">Purpose is required</p>
                )}
              </Field>
            </div>

            <div className="rounded-[20px] bg-[#F5F3EE] p-5">
              <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#00897B]">Preview</p>
              <div className="mt-4 space-y-3">
                <PreviewRow label="Principal" value={`${amount || "0"} ETH`} />
                <PreviewRow label="Expected interest" value={`${estimatedInterest.toFixed(4)} ETH`} />
                <PreviewRow label="Total repayment" value={`${totalRepayment.toFixed(4)} ETH`} strong />
                <PreviewRow label="Voucher yield pool" value={`${(requiresVouchersForAmount ? voucherYield : 0).toFixed(4)} ETH`} />
              </div>
              <p className="mt-5 rounded-2xl bg-white p-4 font-[DM Sans] text-sm leading-7 text-[#4B4B4B]">
                Vouchers receive 30% of the interest if you repay on time. If you default, their stakes are slashed and your reputation is damaged on-chain.
              </p>
            </div>
          </div>
        ) : null}

        {step === 2 && requiresVouchersForAmount ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-[Fraunces] text-2xl font-semibold text-[#1A1A1A]">Invite vouchers</h2>
                  <p className="mt-1 font-[DM Sans] text-sm text-[#4B4B4B]">Add {minimumVouchersRequired} to {MAX_VOUCHERS} wallets that will stake ETH on your behalf.</p>
                </div>
                <button
                  onClick={addVoucher}
                  disabled={voucherInputs.length >= MAX_VOUCHERS}
                  className="rounded-lg border border-[#00897B] px-4 py-2 font-[DM Sans] text-sm font-semibold text-[#00897B] transition hover:bg-[#E0F2F1] disabled:cursor-not-allowed disabled:border-[#D6D3CE] disabled:text-[#9CA3AF]"
                >
                  Add another voucher
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {voucherInputs.map((value, index) => (
                  <div key={`voucher-${index}`} className="rounded-2xl border border-[#D6D3CE] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <label className="font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">Voucher {index + 1}</label>
                      <button
                        onClick={() => removeVoucher(index)}
                        disabled={voucherInputs.length <= minimumVouchersRequired}
                        className="font-[DM Sans] text-xs font-semibold text-[#D32F2F] disabled:cursor-not-allowed disabled:text-[#9CA3AF]"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      value={value}
                      onChange={(event) => updateVoucher(index, event.target.value)}
                      placeholder="0x..."
                      className="mt-3 w-full rounded-xl border border-[#D6D3CE] px-4 py-3 font-mono text-sm outline-none transition focus:border-[#00897B]"
                    />
                    {voucherChecks[index]?.message && voucherChecks[index].valid === false ? (
                      <p className="mt-2 font-[DM Sans] text-xs text-[#D32F2F]">{voucherChecks[index].message}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[20px] bg-[#E0F2F1] p-5">
              <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#00574F]">Coverage rules</p>
              <div className="mt-4 space-y-3">
                <PreviewRow label="Minimum vouchers" value={`${minimumVouchersRequired}`} />
                <PreviewRow label="Maximum vouchers" value={`${MAX_VOUCHERS}`} />
                <PreviewRow label="Your wallet" value={address} />
              </div>
              <p className="mt-5 rounded-2xl bg-white p-4 font-[DM Sans] text-sm leading-7 text-[#4B4B4B]">
                Every voucher address must be unique and cannot be your own wallet. Their combined stakes must reach 80% coverage before lenders can fund the loan.
              </p>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[20px] border border-[#D6D3CE] p-5">
              <h2 className="font-[Fraunces] text-2xl font-semibold text-[#1A1A1A]">Review and sign</h2>
              <div className="mt-4 space-y-3">
                <PreviewRow label="Principal" value={`${amount || "0"} ETH`} />
                <PreviewRow label="Interest rate" value={`${(interestBps / 100).toFixed(1)}%`} />
                <PreviewRow label="Term" value={`${termDays} days`} />
                <PreviewRow label="Total repayment" value={`${totalRepayment.toFixed(4)} ETH`} strong />
              </div>
              <div className="mt-5 rounded-2xl bg-[#F5F3EE] p-4">
                <p className="font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">Invited vouchers</p>
                {requiresVouchersForAmount ? (
                  <ul className="mt-3 space-y-2 font-mono text-sm text-[#4B4B4B]">
                    {voucherAddresses.map((voucher) => (
                      <li key={voucher}>{voucher}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 font-[DM Sans] text-sm text-[#4B4B4B]">No vouchers required for this CIBIL tier and amount.</p>
                )}
              </div>
            </div>

            <div className="rounded-[20px] bg-[#1A1A1A] p-5 text-white">
              <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#A7F3D0]">What happens next</p>
              <div className="mt-4 space-y-3 text-sm leading-7 text-white/80">
                <p>1. Your request is written to the chain.</p>
                {requiresVouchersForAmount ? <p>2. Vouchers can stake against the invitation list.</p> : <p>2. This request is instantly fundable (no voucher stage).</p>}
                {requiresVouchersForAmount ? <p>3. Once coverage reaches 80%, the loan becomes fundable.</p> : null}
                <p>{requiresVouchersForAmount ? "4" : "3"}. The lender funds the loan and your wallet receives ETH directly.</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] pt-6">
          <div className="font-[DM Sans] text-sm text-[#6B6B6B]">
            Step {displayedStep} of {totalSteps}
            {step === 1 && !canContinueStep1 && (
              <span className="ml-2 text-[#D32F2F]">— Please fix the highlighted fields above</span>
            )}
            {step === 2 && requiresVouchersForAmount && !canContinueStep2 && (
              <span className="ml-2 text-[#D32F2F]">— Please fix the voucher addresses</span>
            )}
          </div>
          <div className="flex gap-3">
            {step > 1 ? (
              <button
                onClick={() => {
                  if (step === 3 && !requiresVouchersForAmount) {
                    setStep(1);
                    return;
                  }
                  setStep((current) => current - 1);
                }}
                className="rounded-lg border border-[#D6D3CE] px-5 py-3 font-[DM Sans] text-sm font-semibold text-[#1A1A1A] transition hover:bg-[#F5F3EE]"
              >
                Back
              </button>
            ) : null}

            {step < 3 ? (
              <button
                onClick={() => {
                  if (step === 1 && !requiresVouchersForAmount) {
                    setStep(3);
                    return;
                  }
                  setStep((current) => current + 1);
                }}
                disabled={(step === 1 && !canContinueStep1) || (step === 2 && requiresVouchersForAmount && !canContinueStep2)}
                className="rounded-lg bg-[#00897B] px-5 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#00574F] disabled:cursor-not-allowed disabled:bg-[#D6D3CE] disabled:text-[#9CA3AF]"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg bg-[#00897B] px-5 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#00574F] disabled:cursor-not-allowed disabled:bg-[#D6D3CE]"
              >
                {submitting ? "Submitting..." : "Create Loan Request"}
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({ label, helper, children }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{label}</label>
        {helper ? <span className="font-[DM Sans] text-xs text-[#6B6B6B]">{helper}</span> : null}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function PreviewRow({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-2 last:border-none">
      <span className="font-[DM Sans] text-sm text-[#6B6B6B]">{label}</span>
      <span className={`font-[DM Sans] text-sm ${strong ? "font-semibold text-[#1A1A1A]" : "text-[#1A1A1A]"}`}>
        {value || "-"}
      </span>
    </div>
  );
}
