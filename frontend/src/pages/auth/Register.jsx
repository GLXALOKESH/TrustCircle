import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import useWallet from "../../hooks/useWallet";
import useAuth from "../../hooks/useAuth";

export default function Register() {
  const navigate = useNavigate();
  const { isConnected, address, connect } = useWallet();
  const { registerWithWallet } = useAuth();

  const [name, setName] = useState("");
  const [panCardNumber, setPanCardNumber] = useState("");
  const [age, setAge] = useState(18);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 18) {
      setError("Users under 18 are not allowed to register");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await registerWithWallet({
        name: name.trim(),
        panCardNumber: panCardNumber.trim().toUpperCase(),
        age: parsedAge,
      });
      toast.success("Registration complete");
      navigate("/borrow");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <section className="rounded-[24px] border border-[#D6D3CE] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
        <p className="font-[DM Sans] text-[13px] font-semibold uppercase tracking-[2px] text-[#00897B]">Off-chain authentication</p>
        <h1 className="mt-2 font-[Fraunces] text-4xl font-semibold text-[#1A1A1A]">Register with MetaMask</h1>
        <p className="mt-3 font-[DM Sans] text-sm text-[#4B4B4B]">One user can bind only one wallet account. PAN and age are required for registration.</p>

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

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Full Name">
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className="w-full rounded-xl border border-[#D6D3CE] px-4 py-3 font-[DM Sans] text-sm outline-none focus:border-[#00897B]" />
          </Field>

          <Field label="PAN Card Number">
            <input value={panCardNumber} onChange={(e) => setPanCardNumber(e.target.value)} required placeholder="ABCDE1234F" className="w-full rounded-xl border border-[#D6D3CE] px-4 py-3 font-mono text-sm uppercase outline-none focus:border-[#00897B]" />
          </Field>

          <Field label="Age">
            <input type="number" value={age} onChange={(e) => setAge(e.target.value)} required min={18} max={120} className="w-full rounded-xl border border-[#D6D3CE] px-4 py-3 font-[DM Sans] text-sm outline-none focus:border-[#00897B]" />
          </Field>

          {error ? <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 font-[DM Sans] text-sm text-[#B91C1C]">{error}</p> : null}

          <button disabled={!isConnected || submitting} className="rounded-lg bg-[#00897B] px-6 py-3 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#00574F] disabled:cursor-not-allowed disabled:bg-[#D6D3CE] disabled:text-[#9CA3AF]">
            {submitting ? "Registering..." : "Register & Sign"}
          </button>
        </form>

        <p className="mt-5 font-[DM Sans] text-sm text-[#4B4B4B]">
          Already registered? <Link to="/auth/login" className="font-semibold text-[#00897B]">Login with wallet</Link>
        </p>
      </section>
    </main>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block font-[DM Sans] text-sm font-semibold text-[#1A1A1A]">{label}</span>
      {children}
    </label>
  );
}
