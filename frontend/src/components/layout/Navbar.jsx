import { NavLink } from "react-router-dom";
import useWallet from "../../hooks/useWallet";
import NotificationBell from "./NotificationBell";
import WalletBar from "./WalletBar";

const links = [
  { to: "/borrow/new", label: "Borrow" },
  { to: "/vouch/inbox", label: "Vouch" },
  { to: "/lend/browse", label: "Lend" },
  { to: "/update-cibil", label: "Update CIBIL" },
  { to: "/stats", label: "Stats" },
];

export default function Navbar() {
  const { isConnected } = useWallet();

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-[#D6D3CE] bg-white">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
        <NavLink to="/" className="flex items-center gap-2">
          <span className="relative h-5 w-7">
            <span className="absolute left-0 top-0 h-5 w-5 rounded-full border-2 border-[#00897B]" />
            <span className="absolute right-0 top-0 h-5 w-5 rounded-full border-2 border-[#00897B] bg-white" />
          </span>
          <span className="font-[Fraunces] text-xl font-semibold text-[#00897B]">TrustCircle</span>
        </NavLink>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `border-b-2 pb-1 font-[DM Sans] text-[15px] ${isActive ? "border-[#00897B] text-[#00897B]" : "border-transparent text-[#4B4B4B]"}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <NotificationBell />
          {isConnected ? (
            <WalletBar />
          ) : (
            <div className="flex items-center gap-2">
              <NavLink
                to="/auth/login"
                className="rounded-lg border border-[#D6D3CE] px-4 py-2 font-[DM Sans] text-sm font-semibold text-[#1A1A1A] transition hover:bg-[#F5F3EE]"
              >
                Login
              </NavLink>
              <NavLink
                to="/auth/register"
                className="rounded-lg bg-[#00897B] px-4 py-2 font-[DM Sans] text-sm font-semibold text-white transition hover:bg-[#00574F]"
              >
                Signup
              </NavLink>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
