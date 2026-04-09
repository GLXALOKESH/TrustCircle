import useWallet from "../../hooks/useWallet";
import { TARGET_NETWORK_NAME } from "../../config/contracts";

export default function NetworkGuard() {
  const { isConnected, isCorrectNetwork, switchToTargetNetwork } = useWallet();

  if (!isConnected || isCorrectNetwork) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-[10px] border border-[#D6D3CE] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <h2 className="font-[Fraunces] text-2xl text-[#1A1A1A]">Wrong Network</h2>
        <p className="mt-2 font-[DM Sans] text-sm text-[#4B4B4B]">
          TrustCircle works on {TARGET_NETWORK_NAME}. Switch network to continue.
        </p>
        <button
          onClick={switchToTargetNetwork}
          className="mt-5 rounded-lg bg-[#00897B] px-6 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-[#00574F]"
        >
          Switch to {TARGET_NETWORK_NAME}
        </button>
      </div>
    </div>
  );
}
