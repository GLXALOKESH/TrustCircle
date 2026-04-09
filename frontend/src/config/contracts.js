import LoanRequestABI from "../abis/LoanRequest.json";
import VouchPoolABI from "../abis/VouchPool.json";
import ReputationABI from "../abis/ReputationToken.json";

export const CONTRACTS = {
  loanRequest: {
    address: import.meta.env.VITE_LOAN_REQUEST_ADDRESS,
    abi: LoanRequestABI.abi,
  },
  vouchPool: {
    address: import.meta.env.VITE_VOUCH_POOL_ADDRESS,
    abi: VouchPoolABI.abi,
  },
  reputation: {
    address: import.meta.env.VITE_REPUTATION_ADDRESS,
    abi: ReputationABI.abi,
  },
};

export const TARGET_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 11155111);
export const TARGET_CHAIN_HEX = `0x${TARGET_CHAIN_ID.toString(16)}`;
export const TARGET_NETWORK_NAME =
  TARGET_CHAIN_ID === 31337
    ? "Hardhat Localhost"
    : TARGET_CHAIN_ID === 11155111
      ? "Ethereum Sepolia"
      : `Chain ${TARGET_CHAIN_ID}`;
export const BLOCK_EXPLORER =
  import.meta.env.VITE_BLOCK_EXPLORER ||
  (TARGET_CHAIN_ID === 31337 ? "http://127.0.0.1:8545" : "https://sepolia.etherscan.io");

export const LOAN_STATES = {
  0: "Pending",
  1: "FullyVouched",
  2: "Funded",
  3: "Repaid",
  4: "DefaultClaimed",
  5: "Defaulted",
};
