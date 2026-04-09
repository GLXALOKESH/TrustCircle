import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { TARGET_CHAIN_HEX, TARGET_CHAIN_ID, TARGET_NETWORK_NAME } from "../config/contracts";

export const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [balance, setBalance] = useState("0.0000 ETH");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);

  const isConnected = Boolean(address);
  const isCorrectNetwork = Number(chainId) === TARGET_CHAIN_ID;

  const resetState = useCallback(() => {
    setAddress(null);
    setBalance("0.0000 ETH");
    setProvider(null);
    setSigner(null);
    setChainId(null);
  }, []);

  const hydrateWallet = useCallback(async (accounts) => {
    if (!window.ethereum || !accounts || accounts.length === 0) {
      resetState();
      return;
    }

    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    const activeSigner = await browserProvider.getSigner();
    const network = await browserProvider.getNetwork();
    const activeAddress = ethers.getAddress(accounts[0]);
    const walletBalance = await browserProvider.getBalance(activeAddress);

    setProvider(browserProvider);
    setSigner(activeSigner);
    setAddress(activeAddress);
    setChainId(Number(network.chainId));
    setBalance(`${Number(ethers.formatEther(walletBalance)).toFixed(4)} ETH`);
  }, [resetState]);

  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error("MetaMask not found");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    await hydrateWallet(accounts);
  }, [hydrateWallet]);

  const disconnect = useCallback(() => {
    resetState();
  }, [resetState]);

  const switchToTargetNetwork = useCallback(async () => {
    if (!window.ethereum) throw new Error("MetaMask not found");
    const rpcUrl = import.meta.env.VITE_SEPOLIA_RPC || "http://127.0.0.1:8545";

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: TARGET_CHAIN_HEX }],
      });
    } catch (error) {
      if (error?.code !== 4902) throw error;

      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: TARGET_CHAIN_HEX,
            chainName: TARGET_NETWORK_NAME,
            rpcUrls: [rpcUrl],
            nativeCurrency: {
              name: "ETH",
              symbol: "ETH",
              decimals: 18,
            },
          },
        ],
      });
    }

    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    await hydrateWallet(accounts);
  }, [hydrateWallet]);

  useEffect(() => {
    if (!window.ethereum) return;

    let isMounted = true;

    const bootstrap = async () => {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (isMounted && accounts.length > 0) {
        await hydrateWallet(accounts);
      }
    };

    const handleAccountsChanged = async (accounts) => {
      if (!isMounted) return;
      await hydrateWallet(accounts);
    };

    const handleChainChanged = async () => {
      if (!isMounted) return;
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      await hydrateWallet(accounts);
    };

    bootstrap();
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      isMounted = false;
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [hydrateWallet]);

  const value = useMemo(() => ({
    address,
    balance,
    provider,
    signer,
    isConnected,
    isCorrectNetwork,
    connect,
    disconnect,
    switchToTargetNetwork,
  }), [
    address,
    balance,
    provider,
    signer,
    isConnected,
    isCorrectNetwork,
    connect,
    disconnect,
    switchToTargetNetwork,
  ]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
