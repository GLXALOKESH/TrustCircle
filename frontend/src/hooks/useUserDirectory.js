import { useCallback } from "react";
import { ethers } from "ethers";
import useAuth from "./useAuth";

const API_BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";

export default function useUserDirectory() {
  const { token, user } = useAuth();

  const getUserByWallet = useCallback(async (walletAddress) => {
    if (!walletAddress) return null;
    if (!token) throw new Error("You are not logged in");

    const normalized = ethers.getAddress(walletAddress).toLowerCase();
    if (user?.walletAddress?.toLowerCase() === normalized) {
      return user;
    }

    const response = await fetch(`${API_BASE}/api/auth/user/${normalized}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(data.message || "Failed to fetch user details");
    }

    return data.user || null;
  }, [token, user]);

  return { getUserByWallet };
}
