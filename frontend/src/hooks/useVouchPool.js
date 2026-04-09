import { useCallback, useMemo } from "react";
import { ethers } from "ethers";
import useWallet from "./useWallet";
import { CONTRACTS } from "../config/contracts";

export default function useVouchPool() {
  const { signer, provider } = useWallet();

  const readProvider = useMemo(() => {
    if (provider) return provider;
    if (import.meta.env.VITE_SEPOLIA_RPC) {
      return new ethers.JsonRpcProvider(import.meta.env.VITE_SEPOLIA_RPC);
    }
    return null;
  }, [provider]);

  const readContract = useMemo(() => {
    if (!readProvider || !CONTRACTS.vouchPool.address) return null;
    return new ethers.Contract(CONTRACTS.vouchPool.address, CONTRACTS.vouchPool.abi, readProvider);
  }, [readProvider]);

  const writeContract = useMemo(() => {
    if (!signer || !CONTRACTS.vouchPool.address) return null;
    return new ethers.Contract(CONTRACTS.vouchPool.address, CONTRACTS.vouchPool.abi, signer);
  }, [signer]);

  const loanWriteContract = useMemo(() => {
    if (!signer || !CONTRACTS.loanRequest.address) return null;
    return new ethers.Contract(CONTRACTS.loanRequest.address, CONTRACTS.loanRequest.abi, signer);
  }, [signer]);

  const stake = useCallback(async (loanId, amountEth) => {
    if (!writeContract || !loanWriteContract) throw new Error("Wallet not connected");
    const tx = await writeContract.stake(loanId, { value: ethers.parseEther(amountEth) });
    await tx.wait();
    const activateTx = await loanWriteContract.checkAndActivate(loanId);
    return activateTx.wait();
  }, [writeContract, loanWriteContract]);

  const getVouchers = useCallback(async (loanId) => {
    if (!readContract) throw new Error("Missing provider or contract config");
    return readContract.getVouchers(loanId);
  }, [readContract]);

  const getTotalStaked = useCallback(async (loanId) => {
    if (!readContract) throw new Error("Missing provider or contract config");
    const total = await readContract.getTotalStaked(loanId);
    return total.toString();
  }, [readContract]);

  const getStakesByVoucher = useCallback(async (address) => {
    if (!readContract) throw new Error("Missing provider or contract config");
    return readContract.getStakesByVoucher(address);
  }, [readContract]);

  const getVouchRequestsForVoucher = useCallback(async (voucherAddress, fromBlock = 0) => {
    if (!readContract) throw new Error("Missing provider or contract config");
    const checksummed = ethers.getAddress(voucherAddress);
    const filter = readContract.filters.VouchRequested(null, checksummed);
    const logs = await readContract.queryFilter(filter, fromBlock);

    return logs.map((log) => ({
      loanId: log.args?.loanId?.toString() || "0",
      voucher: log.args?.voucher || checksummed,
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
    }));
  }, [readContract]);

  const getStakedEventsForVoucher = useCallback(async (voucherAddress, fromBlock = 0) => {
    if (!readContract) throw new Error("Missing provider or contract config");
    const checksummed = ethers.getAddress(voucherAddress);
    const filter = readContract.filters.Staked(null, checksummed);
    const logs = await readContract.queryFilter(filter, fromBlock);

    return logs.map((log) => ({
      loanId: log.args?.loanId?.toString() || "0",
      voucher: log.args?.voucher || checksummed,
      amount: (log.args?.amount || 0n).toString(),
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
    }));
  }, [readContract]);

  const getStakeReleasedEventsForVoucher = useCallback(async (voucherAddress, fromBlock = 0) => {
    if (!readContract) throw new Error("Missing provider or contract config");
    const checksummed = ethers.getAddress(voucherAddress);
    const filter = readContract.filters.StakeReleased(null, checksummed);
    const logs = await readContract.queryFilter(filter, fromBlock);

    return logs.map((log) => ({
      loanId: log.args?.loanId?.toString() || "0",
      voucher: log.args?.voucher || checksummed,
      stake: (log.args?.stake || 0n).toString(),
      yield: (log.args?.yield || 0n).toString(),
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
    }));
  }, [readContract]);

  const getStakeSlashedEventsForVoucher = useCallback(async (voucherAddress, fromBlock = 0) => {
    if (!readContract) throw new Error("Missing provider or contract config");
    const checksummed = ethers.getAddress(voucherAddress);
    const filter = readContract.filters.StakeSlashed(null, checksummed);
    const logs = await readContract.queryFilter(filter, fromBlock);

    return logs.map((log) => ({
      loanId: log.args?.loanId?.toString() || "0",
      voucher: log.args?.voucher || checksummed,
      amount: (log.args?.amount || 0n).toString(),
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
    }));
  }, [readContract]);

  return {
    stake,
    getVouchers,
    getTotalStaked,
    getStakesByVoucher,
    getVouchRequestsForVoucher,
    getStakedEventsForVoucher,
    getStakeReleasedEventsForVoucher,
    getStakeSlashedEventsForVoucher,
  };
}
