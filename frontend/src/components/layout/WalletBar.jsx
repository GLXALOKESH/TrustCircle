import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useWallet from "../../hooks/useWallet";
import useAuth from "../../hooks/useAuth";
import { truncateAddress } from "../../utils/formatters";

export default function WalletBar() {
  const navigate = useNavigate();
  const { address, balance, isConnected, isCorrectNetwork, connect, disconnect } = useWallet();
  const { isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const indicatorColor = useMemo(() => (isCorrectNetwork ? "#2E7D32" : "#D32F2F"), [isCorrectNetwork]);

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        className="rounded-lg bg-[#00897B] px-6 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-[#00574F]"
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 rounded-full border border-[#D6D3CE] bg-[#F5F3EE] px-3 py-2"
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: indicatorColor }} />
        <span className="font-mono text-[13px] text-[#1A1A1A]">{truncateAddress(address)}</span>
        <span className="font-[DM Sans] text-xs font-semibold text-[#00574F]">{balance}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-lg border border-[#D6D3CE] bg-white p-1 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          {!isAuthenticated ? (
            <>
              <button
                onClick={() => {
                  navigate("/auth/register");
                  setOpen(false);
                }}
                className="w-full rounded-md px-3 py-2 text-left font-[DM Sans] text-sm text-[#1A1A1A] hover:bg-[#F5F3EE]"
              >
                Register
              </button>
              <button
                onClick={() => {
                  navigate("/auth/login");
                  setOpen(false);
                }}
                className="w-full rounded-md px-3 py-2 text-left font-[DM Sans] text-sm text-[#1A1A1A] hover:bg-[#F5F3EE]"
              >
                Login
              </button>
            </>
          ) : null}

          <button
            onClick={() => {
              navigate("/profile");
              setOpen(false);
            }}
            className="w-full rounded-md px-3 py-2 text-left font-[DM Sans] text-sm text-[#1A1A1A] hover:bg-[#F5F3EE]"
          >
            View Profile
          </button>
          <button
            onClick={() => {
              logout();
              disconnect();
              setOpen(false);
            }}
            className="w-full rounded-md px-3 py-2 text-left font-[DM Sans] text-sm text-[#D32F2F] hover:bg-[#FFEBEE]"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
