import { ethers } from "ethers";

export default function useLoanValidation({
  amount,
  maxLoan,
  termDays,
  maxTermDays = 365,
  interestBps,
  purpose,
  voucherInputs,
  borrowerAddress,
  vouchersRequired = true,
  minimumVouchers = 2,
  maximumVouchers = 3,
}) {
  const normalizedVoucherInputs = voucherInputs.map((value) => value.trim()).filter(Boolean);
  const amountNumber = Number(amount || 0);
  const maxLoanNumber = Number(maxLoan || 0);
  const purposeLength = purpose.trim().length;

  const voucherChecks = normalizedVoucherInputs.map((value, index) => {
    if (!ethers.isAddress(value)) {
      return { index, value, valid: false, message: "Invalid ETH address" };
    }

    const checksummed = ethers.getAddress(value);
    if (borrowerAddress && checksummed === borrowerAddress) {
      return { index, value: checksummed, valid: false, message: "Cannot use your own wallet" };
    }

    if (checksummed !== value) {
      return { index, value: checksummed, valid: false, message: "Use checksummed form" };
    }

    return { index, value: checksummed, valid: true, message: "Valid" };
  });

  const amountValid = amountNumber > 0 && amountNumber <= maxLoanNumber;
  const termValid = Number(termDays) >= 1 && Number(termDays) <= Number(maxTermDays);
  const interestValid = Number(interestBps) >= 100 && Number(interestBps) <= 5000;
  const purposeValid = purposeLength > 0 && purposeLength <= 140;
  const hasNoVouchers = normalizedVoucherInputs.length === 0;
  const hasValidVoucherCount =
    normalizedVoucherInputs.length >= minimumVouchers &&
    normalizedVoucherInputs.length <= maximumVouchers;
  const voucherCountValid = vouchersRequired
    ? hasValidVoucherCount
    : hasNoVouchers || hasValidVoucherCount;
  const voucherAddressValid = voucherChecks.every((entry) => entry.valid);

  const canContinueStep1 = amountValid && termValid && interestValid && purposeValid;
  const canContinueStep2 = voucherCountValid && voucherAddressValid;
  const estimatedInterest = amountNumber * (Number(interestBps) / 10000);
  const totalRepayment = amountNumber + estimatedInterest;
  const voucherYield = estimatedInterest * 0.3;

  return {
    normalizedVoucherInputs,
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
  };
}
