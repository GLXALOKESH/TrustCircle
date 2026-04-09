import { ethers } from "ethers";

export function formatEth(wei) {
  if (!wei) return "0 ETH";
  return parseFloat(ethers.formatEther(wei)).toFixed(4) + " ETH";
}

export function truncateAddress(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function formatDate(timestamp) {
  if (!timestamp || timestamp == 0) return "-";
  return new Date(Number(timestamp) * 1000).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function daysRemaining(dueTimestamp) {
  const now = Date.now() / 1000;
  const diff = Number(dueTimestamp) - now;
  if (diff <= 0) return "Overdue";
  const days = Math.floor(diff / 86400);
  const hrs = Math.floor((diff % 86400) / 3600);
  return days > 0 ? `${days}d ${hrs}h` : `${hrs}h`;
}

export function calcRepaymentAmount(loanAmount, interestBps) {
  const interest = (BigInt(loanAmount) * BigInt(interestBps)) / 10000n;
  return (BigInt(loanAmount) + interest).toString();
}

export function getScoreColor(score) {
  if (score <= 33) return "#D32F2F";
  if (score <= 66) return "#D97706";
  return "#00897B";
}
