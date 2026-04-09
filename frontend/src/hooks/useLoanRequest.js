import { useCallback, useMemo } from "react";
import { ethers } from "ethers";
import useWallet from "./useWallet";
import { CONTRACTS } from "../config/contracts";

function parseLoanIdFromReceipt(contract, receipt) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === "LoanCreated") {
        return parsed.args.loanId.toString();
      }
    } catch {
      // Ignore non-matching logs.
    }
  }
  return null;
}

function normalizeLoanResult(loan) {
  if (!loan) return null;

  return {
    id: loan.id ?? loan[0] ?? 0n,
    borrower: loan.borrower ?? loan[1] ?? "",
    lender: loan.lender ?? loan[2] ?? "",
    amount: loan.amount ?? loan[3] ?? 0n,
    termDays: loan.termDays ?? loan[4] ?? 0n,
    interestBps: loan.interestBps ?? loan[5] ?? 0n,
    createdAt: loan.createdAt ?? loan[6] ?? 0n,
    fundedAt: loan.fundedAt ?? loan[7] ?? 0n,
    dueTimestamp: loan.dueTimestamp ?? loan[8] ?? 0n,
    disputeDeadline: loan.disputeDeadline ?? loan[9] ?? 0n,
    state: loan.state ?? loan[10] ?? 0,
    purpose: loan.purpose ?? loan[11] ?? "",
    vouchers: loan.vouchers ?? loan[12] ?? [],
  };
}

export default function useLoanRequest() {
  const { signer, provider } = useWallet();

  const readProvider = useMemo(() => {
    if (provider) return provider;
    if (import.meta.env.VITE_SEPOLIA_RPC) {
      return new ethers.JsonRpcProvider(import.meta.env.VITE_SEPOLIA_RPC);
    }
    return null;
  }, [provider]);

  const readContract = useMemo(() => {
    if (!readProvider || !CONTRACTS.loanRequest.address) return null;
    return new ethers.Contract(
      CONTRACTS.loanRequest.address,
      CONTRACTS.loanRequest.abi,
      readProvider,
    );
  }, [readProvider]);

  const writeContract = useMemo(() => {
    if (!signer || !CONTRACTS.loanRequest.address) return null;
    return new ethers.Contract(
      CONTRACTS.loanRequest.address,
      CONTRACTS.loanRequest.abi,
      signer,
    );
  }, [signer]);

  const createLoanRequest = useCallback(async (amount, termDays, interestBps, purpose, voucherAddresses) => {
    if (!writeContract) throw new Error("Wallet not connected");
    const checksummedVouchers = voucherAddresses.map((addr) => ethers.getAddress(addr));
    const tx = await writeContract.createLoanRequest(
      ethers.parseEther(amount),
      termDays,
      interestBps,
      purpose,
      checksummedVouchers,
    );
    const receipt = await tx.wait();
    return {
      receipt,
      loanId: parseLoanIdFromReceipt(writeContract, receipt),
    };
  }, [writeContract]);

  const getLoan = useCallback(async (loanId) => {
    if (!readContract) throw new Error("Missing provider or contract config");
    const loan = await readContract.getLoan(loanId);
    return normalizeLoanResult(loan);
  }, [readContract]);

  const repayLoan = useCallback(async (loanId) => {
    if (!writeContract) throw new Error("Wallet not connected");
    const repayment = await writeContract.getRepaymentAmount(loanId);
    const tx = await writeContract.repayLoan(loanId, { value: repayment });
    return tx.wait();
  }, [writeContract]);

  const fundLoan = useCallback(async (loanId, loanAmountWei) => {
    if (!writeContract) throw new Error("Wallet not connected");
    const tx = await writeContract.fundLoan(loanId, { value: loanAmountWei });
    return tx.wait();
  }, [writeContract]);

  const claimDefault = useCallback(async (loanId) => {
    if (!writeContract) throw new Error("Wallet not connected");
    const tx = await writeContract.claimDefault(loanId);
    return tx.wait();
  }, [writeContract]);

  const finalizeDefault = useCallback(async (loanId) => {
    if (!writeContract) throw new Error("Wallet not connected");
    const tx = await writeContract.finalizeDefault(loanId);
    return tx.wait();
  }, [writeContract]);

  const disputeDefault = useCallback(async (loanId, reasonHash) => {
    if (!writeContract) throw new Error("Wallet not connected");
    const hashValue = reasonHash || ethers.ZeroHash;
    const tx = await writeContract.disputeDefault(loanId, hashValue);
    return tx.wait();
  }, [writeContract]);

  const checkAndActivate = useCallback(async (loanId) => {
    if (!writeContract) throw new Error("Wallet not connected");
    const tx = await writeContract.checkAndActivate(loanId);
    return tx.wait();
  }, [writeContract]);

  const getBorrowerLoans = useCallback(async (address) => {
    if (!readContract) throw new Error("Missing provider or contract config");
    return readContract.getBorrowerLoans(address);
  }, [readContract]);

  const getLenderLoans = useCallback(async (address) => {
    if (!readContract) throw new Error("Missing provider or contract config");
    return readContract.getLenderLoans(address);
  }, [readContract]);

  const getRepaymentAmount = useCallback(async (loanId) => {
    if (!readContract) throw new Error("Missing provider or contract config");
    const amount = await readContract.getRepaymentAmount(loanId);
    return amount.toString();
  }, [readContract]);

  const getTotalLoanCount = useCallback(async () => {
    if (!readContract) throw new Error("Missing provider or contract config");
    const count = await readContract.getTotalLoanCount();
    return Number(count);
  }, [readContract]);

  const getLoanCreatedEvents = useCallback(async (fromBlock = 0) => {
    if (!readContract) throw new Error("Missing provider or contract config");
    const filter = readContract.filters.LoanCreated();
    const logs = await readContract.queryFilter(filter, fromBlock);

    return logs.map((log) => ({
      loanId: (log.args?.loanId || 0n).toString(),
      borrower: log.args?.borrower || "",
      amount: (log.args?.amount || 0n).toString(),
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
    }));
  }, [readContract]);

  const getLoanFundedEventsForLender = useCallback(async (lenderAddress, fromBlock = 0) => {
    if (!readContract) throw new Error("Missing provider or contract config");
    const checksummed = ethers.getAddress(lenderAddress);
    const filter = readContract.filters.LoanFunded(null, checksummed);
    const logs = await readContract.queryFilter(filter, fromBlock);

    return logs.map((log) => ({
      loanId: (log.args?.loanId || 0n).toString(),
      lender: log.args?.lender || checksummed,
      amount: (log.args?.amount || 0n).toString(),
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
    }));
  }, [readContract]);

  return {
    createLoanRequest,
    getLoan,
    repayLoan,
    fundLoan,
    claimDefault,
    finalizeDefault,
    disputeDefault,
    checkAndActivate,
    getBorrowerLoans,
    getLenderLoans,
    getRepaymentAmount,
    getTotalLoanCount,
    getLoanCreatedEvents,
    getLoanFundedEventsForLender,
  };
}
