import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { WalletProvider } from "./context/WalletContext";
import useWallet from "./hooks/useWallet";
import { AuthProvider } from "./context/AuthContext";
import useAuth from "./hooks/useAuth";
import Navbar from "./components/layout/Navbar";
import NetworkGuard from "./components/common/NetworkGuard";
import Landing from "./pages/Landing";
import BorrowHome from "./pages/borrow/BorrowHome";
import NewLoan from "./pages/borrow/NewLoan";
import LoanStatus from "./pages/borrow/LoanStatus";
import Repay from "./pages/borrow/Repay";
import Dispute from "./pages/borrow/Dispute";
import Profile from "./pages/Profile";
import Stats from "./pages/Stats";
import Inbox from "./pages/vouch/Inbox";
import StakeETH from "./pages/vouch/StakeETH";
import ActiveVouches from "./pages/vouch/ActiveVouches";
import LendHome from "./pages/lend/LendHome";
import LendBrowse from "./pages/lend/LendBrowse";
import LoanDetail from "./pages/lend/LoanDetail";
import Portfolio from "./pages/lend/Portfolio";
import ClaimDefault from "./pages/lend/ClaimDefault";
import Register from "./pages/auth/Register";
import Login from "./pages/auth/Login";
import UpdateCibil from "./pages/UpdateCibil";
import {
  VouchHistory,
  VouchHome,
} from "./pages/Placeholders";

function AuthRequired({ children }) {
  const location = useLocation();
  const { isConnected } = useWallet();
  const { isAuthenticated, authLoading } = useAuth();

  if (!isConnected) return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />;
  if (authLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />;

  return children;
}

export default function App() {
  return (
    <WalletProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-svh bg-[#F5F3EE] text-[#1A1A1A]">
            <Navbar />
            <NetworkGuard />
            <Toaster position="bottom-right" />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth/register" element={<Register />} />
              <Route path="/auth/login" element={<Login />} />
              <Route path="/update-cibil" element={<AuthRequired><UpdateCibil /></AuthRequired>} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/profile/:address" element={<Profile />} />
              <Route path="/profile" element={<AuthRequired><Profile /></AuthRequired>} />

              <Route path="/borrow" element={<AuthRequired><BorrowHome /></AuthRequired>} />
              <Route path="/borrow/new" element={<AuthRequired><NewLoan /></AuthRequired>} />
              <Route path="/borrow/:loanId" element={<AuthRequired><LoanStatus /></AuthRequired>} />
              <Route path="/borrow/:loanId/repay" element={<AuthRequired><Repay /></AuthRequired>} />
              <Route path="/borrow/:loanId/dispute" element={<AuthRequired><Dispute /></AuthRequired>} />

              <Route path="/vouch" element={<AuthRequired><VouchHome /></AuthRequired>} />
              <Route path="/vouch/inbox" element={<AuthRequired><Inbox /></AuthRequired>} />
              <Route path="/vouch/:loanId/stake" element={<AuthRequired><StakeETH /></AuthRequired>} />
              <Route path="/vouch/active" element={<AuthRequired><ActiveVouches /></AuthRequired>} />
              <Route path="/vouch/history" element={<AuthRequired><VouchHistory /></AuthRequired>} />

              <Route path="/lend" element={<AuthRequired><LendHome /></AuthRequired>} />
              <Route path="/lend/browse" element={<AuthRequired><LendBrowse /></AuthRequired>} />
              <Route path="/lend/:loanId" element={<AuthRequired><LoanDetail /></AuthRequired>} />
              <Route path="/lend/portfolio" element={<AuthRequired><Portfolio /></AuthRequired>} />
              <Route path="/lend/:loanId/default" element={<AuthRequired><ClaimDefault /></AuthRequired>} />
            </Routes>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </WalletProvider>
  );
}
