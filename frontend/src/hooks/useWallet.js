import { useContext } from "react";
import { WalletContext } from "../context/WalletContext";

export default function useWallet() {
  return useContext(WalletContext);
}
