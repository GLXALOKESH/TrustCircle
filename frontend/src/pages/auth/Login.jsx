import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import useWallet from "../../hooks/useWallet";
import useAuth from "../../hooks/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isConnected, address, connect } = useWallet();
  const { loginWithWallet } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    try {
      setSubmitting(true);
      setError("");
      await loginWithWallet();
      toast.success("Login successful");
      const redirectTo = location.state?.from || "/borrow";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <section className="rounded-[24px] border border-[#D6D3CE] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#00897B]">Off-chain authentication</p>
        <h1 className="mt-2 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Login with MetaMask</h1>
        <p className="mt-3 font-[DM Sans] text-sm text-[#4B4B4B]">Only wallet signature is required for login.</p>

        {!isConnected ? (
          <button
            onClick={connect}
            className="mt-6 rounded-lg bg-[#00897B] px-6 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#00574F]"
          >
            Connect MetaMask
          </button>
        ) : (
          <p className="mt-6 rounded-xl bg-[#F5F3EE] px-4 py-3 font-mono text-sm text-[#4B4B4B]">Connected wallet: {address}</p>
        )}

        {error ? <p className="mt-5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 font-[DM Sans] text-sm text-[#B91C1C]">{error}</p> : null}

        <button
          onClick={handleLogin}
          disabled={!isConnected || submitting}
          className="mt-6 rounded-lg bg-[#00897B] px-6 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#00574F] disabled:cursor-not-allowed disabled:bg-[#D6D3CE] disabled:text-[#9CA3AF]"
        >
          {submitting ? "Signing..." : "Login & Sign"}
        </button>

        <p className="mt-5 font-[DM Sans] text-sm text-[#4B4B4B]">
          New user? <Link to="/auth/register" className="font-semibold text-[#00897B]">Register first</Link>
        </p>
      </section>
    </main>
  );
}
