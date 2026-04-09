import { useCallback, useMemo } from "react";
import { ethers } from "ethers";
import useWallet from "./useWallet";
import { CONTRACTS } from "../config/contracts";

export default function useReputation() {
  const { provider } = useWallet();

  const readProvider = useMemo(() => {
    if (provider) return provider;
    if (import.meta.env.VITE_SEPOLIA_RPC) {
      return new ethers.JsonRpcProvider(import.meta.env.VITE_SEPOLIA_RPC);
    }
    return null;
  }, [provider]);

  const contract = useMemo(() => {
    if (!readProvider || !CONTRACTS.reputation.address) return null;
    return new ethers.Contract(CONTRACTS.reputation.address, CONTRACTS.reputation.abi, readProvider);
  }, [readProvider]);

  const getScore = useCallback(async (address) => {
    if (!contract) throw new Error("Missing provider or contract config");
    const score = await contract.getScore(address);
    return Number(score);
  }, [contract]);

  const getMaxLoan = useCallback(async (address) => {
    if (!contract) throw new Error("Missing provider or contract config");
    const max = await contract.getMaxLoan(address);
    return ethers.formatEther(max);
  }, [contract]);

  const getProfile = useCallback(async (address) => {
    if (!contract) throw new Error("Missing provider or contract config");
    return contract.getProfile(address);
  }, [contract]);

  const hasToken = useCallback(async (address) => {
    if (!contract) throw new Error("Missing provider or contract config");
    const id = await contract.addressToTokenId(address);
    return id > 0n;
  }, [contract]);

  return {
    getScore,
    getMaxLoan,
    getProfile,
    hasToken,
  };
}
