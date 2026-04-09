import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import useWallet from "../hooks/useWallet";

const API_BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";
const STORAGE_KEY = "trustcircle_auth_token";

export const AuthContext = createContext(null);

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export function AuthProvider({ children }) {
  const { address, signer, isConnected } = useWallet();
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  const logout = useCallback(() => {
    setToken("");
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const fetchMe = useCallback(async (activeToken) => {
    if (!activeToken) return null;

    const data = await apiRequest("/api/auth/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${activeToken}`,
      },
    });

    return data.user;
  }, []);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      if (!token) {
        setUser(null);
        return;
      }

      try {
        setAuthLoading(true);
        const me = await fetchMe(token);
        if (!active) return;

        if (address && me?.walletAddress && me.walletAddress.toLowerCase() !== address.toLowerCase()) {
          logout();
          return;
        }

        setUser(me || null);
      } catch {
        if (active) logout();
      } finally {
        if (active) setAuthLoading(false);
      }
    }

    hydrate();
    return () => {
      active = false;
    };
  }, [token, fetchMe, logout, address]);

  const signWithWallet = useCallback(async ({ action }) => {
    if (!isConnected || !address || !signer) {
      throw new Error("Connect wallet first");
    }

    const nonceData = await apiRequest("/api/auth/nonce", {
      method: "POST",
      body: JSON.stringify({ walletAddress: address, action }),
    });

    const signature = await signer.signMessage(nonceData.messageToSign);
    return { nonce: nonceData.nonce, signature };
  }, [isConnected, address, signer]);

  const registerWithWallet = useCallback(async ({ name, panCardNumber, age }) => {
    const { nonce, signature } = await signWithWallet({ action: "register" });

    const data = await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        walletAddress: ethers.getAddress(address),
        nonce,
        signature,
        name,
        panCardNumber,
        age,
      }),
    });

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem(STORAGE_KEY, data.token);
    return data.user;
  }, [address, signWithWallet]);

  const loginWithWallet = useCallback(async () => {
    const { nonce, signature } = await signWithWallet({ action: "login" });

    const data = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        walletAddress: ethers.getAddress(address),
        nonce,
        signature,
      }),
    });

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem(STORAGE_KEY, data.token);
    return data.user;
  }, [address, signWithWallet]);

  const value = useMemo(() => ({
    token,
    user,
    authLoading,
    isAuthenticated: Boolean(token && user),
    registerWithWallet,
    loginWithWallet,
    logout,
  }), [token, user, authLoading, registerWithWallet, loginWithWallet, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
