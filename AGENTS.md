# AGENTS.md — TrustCircle
### Social-Vouched Decentralised Micro-Lending Platform
### Complete build instructions for AI coding agents

---

> **READ THIS ENTIRE FILE BEFORE WRITING A SINGLE LINE OF CODE.**
> This file is the single source of truth. Every decision — architecture, naming, design, blockchain logic — is defined here. Do not deviate. Do not improvise. Follow exactly.

---

## Table of Contents

- [Section 0 — What is TrustCircle](#section-0--what-is-trustcircle)
- [Section 1 — Monorepo Structure](#section-1--monorepo-structure)
- [Section 2 — Contracts Project Setup](#section-2--contracts-project-setup)
- [Section 3 — Smart Contract 1: ReputationToken.sol](#section-3--smart-contract-1-reputationtokensol)
- [Section 4 — Smart Contract 2: VouchPool.sol](#section-4--smart-contract-2-vouchpoolsol)
- [Section 5 — Smart Contract 3: LoanRequest.sol](#section-5--smart-contract-3-loanrequestsol)
- [Section 6 — Deploy Script](#section-6--deploy-script)
- [Section 7 — Hardhat Tests](#section-7--hardhat-tests)
- [Section 8 — Frontend Project Setup](#section-8--frontend-project-setup)
- [Section 9 — Frontend .env File](#section-9--frontend-env-file)
- [Section 10 — Design System](#section-10--design-system)
- [Section 11 — Shared Utilities](#section-11--shared-utilities)
- [Section 12 — Wallet Context + Hooks](#section-12--wallet-context--hooks)
- [Section 13 — Shared Components](#section-13--shared-components)
- [Section 14 — Pages: Borrower](#section-14--pages-borrower)
- [Section 15 — Pages: Voucher](#section-15--pages-voucher)
- [Section 16 — Pages: Lender](#section-16--pages-lender)
- [Section 17 — Pages: Profile & Stats](#section-17--pages-profile--stats)
- [Section 18 — Pages: Landing](#section-18--pages-landing)
- [Section 19 — App Router Setup](#section-19--app-router-setup)
- [Section 20 — ABI Copy Step](#section-20--abi-copy-step)
- [Section 21 — Get Test ETH for Sepolia](#section-21--get-test-eth-for-sepolia)
- [Section 22 — Build Order for Agent](#section-22--build-order-for-agent)
- [Section 23 — Critical Rules for Agent](#section-23--critical-rules-for-agent)

---

## Section 0 — What is TrustCircle

TrustCircle is a decentralised lending platform where borrowers do not need crypto assets as collateral. Instead, people from their social network ("vouchers") stake ETH on their behalf. If the borrower repays, vouchers get their stake back plus a yield. If the borrower defaults, vouchers lose their stake and both borrower and voucher reputations are permanently damaged on-chain.

The platform has three user roles:

| Role | Responsibility |
|---|---|
| **Borrower** | Requests loans, repays them |
| **Voucher** | Stakes ETH on behalf of a borrower |
| **Lender** | Funds fully-vouched loans, earns interest |

Everything runs on the **Ethereum Sepolia testnet**. There is no traditional backend. No Express server. No database. All state lives in smart contracts on the blockchain.

---

## Section 1 — Monorepo Structure

Create the following folder structure exactly:

```
trustcircle/
├── contracts/          (Hardhat project)
└── frontend/           (React + Vite project)
```

Do not merge them. Do not add a backend folder.

---

## Section 2 — Contracts Project Setup

**Step 1 — Initialise the contracts project**

```bash
cd trustcircle/contracts
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts
npx hardhat init   # select: Create a JavaScript project
```

**Step 2 — `hardhat.config.js`**

Replace the generated file with exactly this:

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY]
    }
  }
};
```

**Step 3 — `.env` file in `contracts/`**

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
DEPLOYER_PRIVATE_KEY=your_wallet_private_key_here
```

> **NOTE FOR AGENT:** Never commit this file. Add `.env` to `.gitignore` immediately.

---

## Section 3 — Smart Contract 1: ReputationToken.sol

**File:** `contracts/contracts/ReputationToken.sol`

**Purpose:** A soulbound (non-transferable) ERC-721 NFT that tracks every wallet's borrowing and vouching history. One token per wallet. Cannot be transferred. Cannot be burned. Cannot be reset. This is the identity layer.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ReputationToken is ERC721, Ownable {

    uint256 private _tokenIdCounter;

    struct Profile {
        uint256 repaymentCount;
        uint256 defaultCount;
        uint256 totalBorrowed;      // in wei
        uint256 totalRepaid;        // in wei
        uint256 vouchCount;
        uint256 successfulVouches;
        uint256 mintedAt;
    }

    mapping(address => uint256) public addressToTokenId;
    mapping(uint256 => Profile) public profiles;

    // Only these addresses can call update functions
    address public loanRequestContract;
    address public vouchPoolContract;

    event ScoreUpdated(address indexed wallet, uint8 eventType);
    // eventType: 1=repayment, 2=default, 3=vouch_success, 4=vouch_slash

    constructor() ERC721("TrustCircle Reputation", "TCREP") Ownable(msg.sender) {}

    function setAuthorisedContracts(
        address _loanRequest,
        address _vouchPool
    ) external onlyOwner {
        loanRequestContract = _loanRequest;
        vouchPoolContract   = _vouchPool;
    }

    modifier onlyAuthorised() {
        require(
            msg.sender == loanRequestContract ||
            msg.sender == vouchPoolContract   ||
            msg.sender == owner(),
            "Not authorised"
        );
        _;
    }

    // Mint a token for a wallet if they don't have one yet.
    // Called automatically when a borrower creates their first loan.
    function mintIfNew(address wallet) external onlyAuthorised {
        if (balanceOf(wallet) == 0) {
            _tokenIdCounter++;
            uint256 newId = _tokenIdCounter;
            _safeMint(wallet, newId);
            addressToTokenId[wallet] = newId;
            profiles[newId].mintedAt = block.timestamp;
        }
    }

    function recordRepayment(address wallet, uint256 amount) external onlyAuthorised {
        uint256 id = addressToTokenId[wallet];
        require(id != 0, "No token");
        profiles[id].repaymentCount++;
        profiles[id].totalRepaid += amount;
        emit ScoreUpdated(wallet, 1);
    }

    function recordDefault(address wallet, uint256 amount) external onlyAuthorised {
        uint256 id = addressToTokenId[wallet];
        require(id != 0, "No token");
        profiles[id].defaultCount++;
        profiles[id].totalBorrowed += amount;
        emit ScoreUpdated(wallet, 2);
    }

    function recordBorrow(address wallet, uint256 amount) external onlyAuthorised {
        uint256 id = addressToTokenId[wallet];
        require(id != 0, "No token");
        profiles[id].totalBorrowed += amount;
    }

    function recordVouchSuccess(address voucher) external onlyAuthorised {
        uint256 id = addressToTokenId[voucher];
        if (id == 0) return;
        profiles[id].vouchCount++;
        profiles[id].successfulVouches++;
        emit ScoreUpdated(voucher, 3);
    }

    function recordVouchSlash(address voucher) external onlyAuthorised {
        uint256 id = addressToTokenId[voucher];
        if (id == 0) return;
        profiles[id].vouchCount++;
        emit ScoreUpdated(voucher, 4);
    }

    // Returns a score from 0 to 100.
    // Formula: (repayments * 8) + (repayRatio * 30) - (defaults * 25) + (voucherAccuracy * 10)
    // Clamped between 0 and 100.
    function getScore(address wallet) external view returns (uint256) {
        uint256 id = addressToTokenId[wallet];
        if (id == 0) return 0;
        Profile memory p = profiles[id];

        uint256 score = 0;

        // Repayment count component (max ~40 at 5 repayments)
        uint256 repayComp = p.repaymentCount * 8;
        if (repayComp > 40) repayComp = 40;
        score += repayComp;

        // Repay ratio component (max 30)
        if (p.totalBorrowed > 0) {
            uint256 ratio = (p.totalRepaid * 100) / p.totalBorrowed;
            score += (ratio * 30) / 100;
        }

        // Default penalty
        uint256 penalty = p.defaultCount * 25;
        if (penalty >= score) return 0;
        score -= penalty;

        // Voucher accuracy component (max 10)
        if (p.vouchCount > 0) {
            uint256 accuracy = (p.successfulVouches * 100) / p.vouchCount;
            score += (accuracy * 10) / 100;
        }

        if (score > 100) score = 100;
        return score;
    }

    // Returns max loan allowed in wei based on score
    function getMaxLoan(address wallet) external view returns (uint256) {
        uint256 id = addressToTokenId[wallet];
        uint256 score = 0;
        if (id != 0) {
            Profile memory p = profiles[id];
            uint256 s = p.repaymentCount * 8;
            if (s > 40) s = 40;
            if (p.totalBorrowed > 0) s += ((p.totalRepaid * 100) / p.totalBorrowed * 30) / 100;
            uint256 pen = p.defaultCount * 25;
            s = pen >= s ? 0 : s - pen;
            if (p.vouchCount > 0) s += ((p.successfulVouches * 100) / p.vouchCount * 10) / 100;
            if (s > 100) s = 100;
            score = s;
        }

        if (score == 0)  return 0.05 ether;
        if (score <= 20) return 0.2 ether;
        if (score <= 50) return 0.5 ether;
        return 1 ether;
    }

    function getProfile(address wallet) external view returns (Profile memory) {
        uint256 id = addressToTokenId[wallet];
        return profiles[id];
    }

    // SOULBOUND: Override all transfer functions to revert
    function transferFrom(address, address, uint256) public pure override {
        revert("Soulbound: non-transferable");
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert("Soulbound: non-transferable");
    }
}
```

---

## Section 4 — Smart Contract 2: VouchPool.sol

**File:** `contracts/contracts/VouchPool.sol`

**Purpose:** Holds voucher stakes in escrow. Releases stakes on repayment (with yield). Slashes stakes on default. Enforces minimum stake coverage of 80% of the loan amount total across all vouchers.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IReputationToken {
    function recordVouchSuccess(address voucher) external;
    function recordVouchSlash(address voucher) external;
    function mintIfNew(address wallet) external;
}

contract VouchPool is Ownable {

    address public loanRequestContract;
    IReputationToken public reputationToken;

    struct VoucherInfo {
        address wallet;
        uint256 stakeAmount;
        bool    hasStaked;
    }

    mapping(uint256 => VoucherInfo[]) public vouchersByLoan;
    mapping(uint256 => uint256) public totalStaked;
    mapping(uint256 => address[]) public invitedVouchers;
    mapping(uint256 => mapping(address => uint256)) private voucherIndex;
    mapping(uint256 => uint256) public loanAmounts;
    mapping(address => uint256[]) public stakesByVoucher;

    // Minimum total stake as a percentage of loan amount (80%)
    uint256 public constant MIN_COVERAGE_BPS = 8000;

    // 30% of the interest goes to vouchers, split proportionally
    uint256 public constant VOUCHER_YIELD_SHARE_BPS = 3000;

    event VouchRequested(uint256 indexed loanId, address indexed voucher);
    event Staked(uint256 indexed loanId, address indexed voucher, uint256 amount);
    event StakeReleased(uint256 indexed loanId, address indexed voucher, uint256 stake, uint256 yield);
    event StakeSlashed(uint256 indexed loanId, address indexed voucher, uint256 amount);

    constructor(address _reputationToken) Ownable(msg.sender) {
        reputationToken = IReputationToken(_reputationToken);
    }

    modifier onlyLoanContract() {
        require(msg.sender == loanRequestContract, "Only LoanRequest");
        _;
    }

    function setLoanRequestContract(address _addr) external onlyOwner {
        loanRequestContract = _addr;
    }

    function registerLoan(
        uint256 loanId,
        uint256 loanAmount,
        address[] calldata vouchers
    ) external onlyLoanContract {
        loanAmounts[loanId]     = loanAmount;
        invitedVouchers[loanId] = vouchers;
        for (uint i = 0; i < vouchers.length; i++) {
            emit VouchRequested(loanId, vouchers[i]);
        }
    }

    function stake(uint256 loanId) external payable {
        require(msg.value > 0, "Must send ETH");
        bool isInvited = false;
        address[] memory invited = invitedVouchers[loanId];
        for (uint i = 0; i < invited.length; i++) {
            if (invited[i] == msg.sender) { isInvited = true; break; }
        }
        require(isInvited, "Not invited as voucher");
        require(voucherIndex[loanId][msg.sender] == 0, "Already staked");

        vouchersByLoan[loanId].push(VoucherInfo({
            wallet: msg.sender,
            stakeAmount: msg.value,
            hasStaked: true
        }));
        voucherIndex[loanId][msg.sender] = vouchersByLoan[loanId].length;
        totalStaked[loanId] += msg.value;
        stakesByVoucher[msg.sender].push(loanId);

        reputationToken.mintIfNew(msg.sender);

        emit Staked(loanId, msg.sender, msg.value);
    }

    function isSufficientlyCovered(uint256 loanId) external view returns (bool) {
        uint256 required = (loanAmounts[loanId] * MIN_COVERAGE_BPS) / 10000;
        return totalStaked[loanId] >= required;
    }

    function getVouchers(uint256 loanId) external view returns (VoucherInfo[] memory) {
        return vouchersByLoan[loanId];
    }

    function getTotalStaked(uint256 loanId) external view returns (uint256) {
        return totalStaked[loanId];
    }

    function releaseStakes(uint256 loanId, uint256 interestAmount) external onlyLoanContract {
        VoucherInfo[] storage vouchers = vouchersByLoan[loanId];
        uint256 totalStake = totalStaked[loanId];
        uint256 yieldPool  = (interestAmount * VOUCHER_YIELD_SHARE_BPS) / 10000;

        for (uint i = 0; i < vouchers.length; i++) {
            VoucherInfo storage v = vouchers[i];
            if (!v.hasStaked) continue;

            uint256 voucherYield = totalStake > 0
                ? (yieldPool * v.stakeAmount) / totalStake
                : 0;

            uint256 payout = v.stakeAmount + voucherYield;
            v.hasStaked = false;
            reputationToken.recordVouchSuccess(v.wallet);

            (bool ok, ) = payable(v.wallet).call{value: payout}("");
            require(ok, "Transfer failed");
            emit StakeReleased(loanId, v.wallet, v.stakeAmount, voucherYield);
        }
    }

    function slashStakes(uint256 loanId, address payable lender) external onlyLoanContract returns (uint256) {
        VoucherInfo[] storage vouchers = vouchersByLoan[loanId];
        uint256 slashed = 0;

        for (uint i = 0; i < vouchers.length; i++) {
            VoucherInfo storage v = vouchers[i];
            if (!v.hasStaked) continue;
            uint256 amount = v.stakeAmount;
            v.hasStaked = false;
            slashed += amount;
            reputationToken.recordVouchSlash(v.wallet);
            emit StakeSlashed(loanId, v.wallet, amount);
        }

        if (slashed > 0) {
            (bool ok, ) = lender.call{value: slashed}("");
            require(ok, "Slash transfer failed");
        }
        return slashed;
    }

    function getStakesByVoucher(address voucher) external view returns (uint256[] memory) {
        return stakesByVoucher[voucher];
    }
}
```

---

## Section 5 — Smart Contract 3: LoanRequest.sol

**File:** `contracts/contracts/LoanRequest.sol`

**Purpose:** The main contract. Manages the full lifecycle of every loan. Orchestrates VouchPool and ReputationToken. This is the contract the frontend interacts with most.

**State Machine:**

| Value | State | Description |
|---|---|---|
| 0 | Pending | Created, waiting for vouchers to stake |
| 1 | FullyVouched | Total stake ≥ 80% of loan, ready for lender |
| 2 | Funded | Lender funded it, ETH sent to borrower |
| 3 | Repaid | Borrower repaid, done |
| 4 | DefaultClaimed | Lender called claimDefault, 48hr window open |
| 5 | Defaulted | Finalized, stakes slashed |

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IVouchPool {
    function registerLoan(uint256, uint256, address[] calldata) external;
    function isSufficientlyCovered(uint256) external view returns (bool);
    function releaseStakes(uint256, uint256) external;
    function slashStakes(uint256, address payable) external returns (uint256);
    function getTotalStaked(uint256) external view returns (uint256);
}

interface IReputationToken {
    function mintIfNew(address) external;
    function recordRepayment(address, uint256) external;
    function recordDefault(address, uint256) external;
    function recordBorrow(address, uint256) external;
    function getMaxLoan(address) external view returns (uint256);
}

contract LoanRequest is Ownable {

    IVouchPool       public vouchPool;
    IReputationToken public reputationToken;

    uint256 private _loanCounter;

    struct Loan {
        uint256   id;
        address   borrower;
        address   lender;
        uint256   amount;
        uint256   termDays;
        uint256   interestBps;
        uint256   createdAt;
        uint256   fundedAt;
        uint256   dueTimestamp;
        uint256   disputeDeadline;
        uint8     state;
        string    purpose;
        address[] vouchers;
    }

    mapping(uint256 => Loan)       public loans;
    mapping(address => uint256[])  public borrowerLoans;
    mapping(address => uint256[])  public lenderLoans;

    event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 amount);
    event LoanFullyVouched(uint256 indexed loanId);
    event LoanFunded(uint256 indexed loanId, address indexed lender, uint256 amount);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amount);
    event DefaultClaimed(uint256 indexed loanId, address indexed lender, uint256 disputeDeadline);
    event DefaultDisputed(uint256 indexed loanId, address indexed borrower);
    event DefaultFinalized(uint256 indexed loanId, uint256 slashedAmount);

    constructor(address _vouchPool, address _reputationToken) Ownable(msg.sender) {
        vouchPool       = IVouchPool(_vouchPool);
        reputationToken = IReputationToken(_reputationToken);
    }

    function createLoanRequest(
        uint256   amount,
        uint256   termDays,
        uint256   interestBps,
        string calldata purpose,
        address[] calldata voucherAddresses
    ) external returns (uint256) {
        require(amount > 0, "Amount must be > 0");
        require(termDays >= 1 && termDays <= 365, "Term: 1-365 days");
        require(interestBps >= 100 && interestBps <= 5000, "Interest: 1%-50%");
        require(voucherAddresses.length >= 2 && voucherAddresses.length <= 3, "2-3 vouchers required");

        uint256 maxLoan = reputationToken.getMaxLoan(msg.sender);
        require(amount <= maxLoan, "Amount exceeds trust limit");

        for (uint i = 0; i < voucherAddresses.length; i++) {
            require(voucherAddresses[i] != msg.sender, "Cannot vouch for yourself");
            require(voucherAddresses[i] != address(0), "Invalid voucher address");
        }

        _loanCounter++;
        uint256 loanId = _loanCounter;

        loans[loanId] = Loan({
            id:              loanId,
            borrower:        msg.sender,
            lender:          address(0),
            amount:          amount,
            termDays:        termDays,
            interestBps:     interestBps,
            createdAt:       block.timestamp,
            fundedAt:        0,
            dueTimestamp:    0,
            disputeDeadline: 0,
            state:           0,
            purpose:         purpose,
            vouchers:        voucherAddresses
        });

        borrowerLoans[msg.sender].push(loanId);
        reputationToken.mintIfNew(msg.sender);
        vouchPool.registerLoan(loanId, amount, voucherAddresses);

        emit LoanCreated(loanId, msg.sender, amount);
        return loanId;
    }

    function repayLoan(uint256 loanId) external payable {
        Loan storage loan = loans[loanId];
        require(loan.borrower == msg.sender, "Not the borrower");
        require(loan.state == 2, "Loan not in Funded state");

        uint256 interest = (loan.amount * loan.interestBps) / 10000;
        uint256 totalDue = loan.amount + interest;
        require(msg.value >= totalDue, "Insufficient repayment");

        loan.state = 3;

        vouchPool.releaseStakes(loanId, interest);

        uint256 lenderPayout = loan.amount + ((interest * 7000) / 10000);
        (bool ok, ) = payable(loan.lender).call{value: lenderPayout}("");
        require(ok, "Lender payment failed");

        reputationToken.recordRepayment(loan.borrower, loan.amount);

        uint256 excess = msg.value - totalDue;
        if (excess > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: excess}("");
            require(refunded, "Refund failed");
        }

        emit LoanRepaid(loanId, msg.sender, msg.value);
    }

    function disputeDefault(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.borrower == msg.sender, "Not the borrower");
        require(loan.state == 4, "No active default claim");
        require(block.timestamp < loan.disputeDeadline, "Dispute window closed");
        loan.state = 2;
        emit DefaultDisputed(loanId, msg.sender);
    }

    function fundLoan(uint256 loanId) external payable {
        Loan storage loan = loans[loanId];
        require(loan.state == 1, "Loan not fully vouched");
        require(msg.value == loan.amount, "Must send exact loan amount");
        require(loan.lender == address(0), "Already funded");

        loan.lender       = msg.sender;
        loan.fundedAt     = block.timestamp;
        loan.dueTimestamp = block.timestamp + (loan.termDays * 1 days);
        loan.state        = 2;

        lenderLoans[msg.sender].push(loanId);

        (bool ok, ) = payable(loan.borrower).call{value: msg.value}("");
        require(ok, "Borrower payment failed");

        reputationToken.recordBorrow(loan.borrower, loan.amount);

        emit LoanFunded(loanId, msg.sender, msg.value);
    }

    function claimDefault(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.lender == msg.sender, "Not the lender");
        require(loan.state == 2, "Loan not active");
        require(block.timestamp > loan.dueTimestamp, "Loan not yet due");

        loan.state           = 4;
        loan.disputeDeadline = block.timestamp + 48 hours;

        emit DefaultClaimed(loanId, msg.sender, loan.disputeDeadline);
    }

    function finalizeDefault(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.state == 4, "Not in default claimed state");
        require(block.timestamp >= loan.disputeDeadline, "Dispute window still open");

        loan.state = 5;
        uint256 slashed = vouchPool.slashStakes(loanId, payable(loan.lender));
        reputationToken.recordDefault(loan.borrower, loan.amount);

        emit DefaultFinalized(loanId, slashed);
    }

    function checkAndActivate(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.state == 0, "Not in pending state");
        if (vouchPool.isSufficientlyCovered(loanId)) {
            loan.state = 1;
            emit LoanFullyVouched(loanId);
        }
    }

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }

    function getBorrowerLoans(address borrower) external view returns (uint256[] memory) {
        return borrowerLoans[borrower];
    }

    function getLenderLoans(address lender) external view returns (uint256[] memory) {
        return lenderLoans[lender];
    }

    function getRepaymentAmount(uint256 loanId) external view returns (uint256) {
        Loan memory loan = loans[loanId];
        uint256 interest = (loan.amount * loan.interestBps) / 10000;
        return loan.amount + interest;
    }

    function getTotalLoanCount() external view returns (uint256) {
        return _loanCounter;
    }
}
```

---

## Section 6 — Deploy Script

**File:** `contracts/scripts/deploy.js`

```javascript
const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying TrustCircle contracts to Sepolia...");

  // 1. Deploy ReputationToken first (no dependencies)
  const ReputationToken = await ethers.getContractFactory("ReputationToken");
  const reputation = await ReputationToken.deploy();
  await reputation.waitForDeployment();
  console.log("ReputationToken deployed:", await reputation.getAddress());

  // 2. Deploy VouchPool (needs reputation address)
  const VouchPool = await ethers.getContractFactory("VouchPool");
  const vouchPool = await VouchPool.deploy(await reputation.getAddress());
  await vouchPool.waitForDeployment();
  console.log("VouchPool deployed:", await vouchPool.getAddress());

  // 3. Deploy LoanRequest (needs vouchPool + reputation)
  const LoanRequest = await ethers.getContractFactory("LoanRequest");
  const loanRequest = await LoanRequest.deploy(
    await vouchPool.getAddress(),
    await reputation.getAddress()
  );
  await loanRequest.waitForDeployment();
  console.log("LoanRequest deployed:", await loanRequest.getAddress());

  // 4. Wire contracts together
  await reputation.setAuthorisedContracts(
    await loanRequest.getAddress(),
    await vouchPool.getAddress()
  );
  await vouchPool.setLoanRequestContract(await loanRequest.getAddress());

  console.log("\n--- COPY THESE INTO frontend/.env ---");
  console.log("VITE_LOAN_REQUEST_ADDRESS=" + await loanRequest.getAddress());
  console.log("VITE_VOUCH_POOL_ADDRESS="   + await vouchPool.getAddress());
  console.log("VITE_REPUTATION_ADDRESS="   + await reputation.getAddress());
  console.log("VITE_CHAIN_ID=11155111");
}

main().catch(console.error);
```

**Deploy command** (run from `contracts/` folder):

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

---

## Section 7 — Hardhat Tests

**File:** `contracts/test/TrustCircle.test.js`

Write tests covering exactly these three scenarios:

**Test 1 — Happy path (full repayment)**
- Create loan for 0.05 ETH, 30 days, 10% interest
- Two vouchers each stake 0.025 ETH (total 0.05 ETH = 100% coverage, > 80% required)
- Call `checkAndActivate` → state should become FullyVouched (1)
- Lender funds loan → state becomes Funded (2), borrower receives 0.05 ETH
- Borrower repays 0.055 ETH (principal + interest) → state becomes Repaid (3)
- Verify vouchers received their stakes back plus yield
- Verify lender received principal plus 70% of interest
- Verify borrower `repaymentCount` increased by 1

**Test 2 — Default + slash**
- Create loan, vouch, fund as above
- Advance time past due date using `hardhat_increaseTime`
- Lender calls `claimDefault` → state becomes DefaultClaimed (4)
- Advance time 48 hours
- Anyone calls `finalizeDefault` → state becomes Defaulted (5)
- Verify lender received the slashed voucher stakes
- Verify borrower `defaultCount` increased by 1

**Test 3 — Max loan cap enforcement**
- New wallet with score 0 tries to request 1 ETH loan
- Expect revert with `"Amount exceeds trust limit"`
- Confirm max loan for score 0 is 0.05 ETH

**Run tests:**

```bash
npx hardhat test
```

---

## Section 8 — Frontend Project Setup

```bash
cd trustcircle/frontend
npm create vite@latest . -- --template react
npm install
npm install ethers tailwindcss @tailwindcss/vite react-router-dom react-hot-toast
```

**Tailwind — add to `vite.config.js`:**

```javascript
import tailwindcss from '@tailwindcss/vite'
export default { plugins: [react(), tailwindcss()] }
```

**Replace `src/index.css` entirely with:**

```css
@import "tailwindcss";
```

---

## Section 9 — Frontend .env File

**File:** `frontend/.env`

```env
VITE_LOAN_REQUEST_ADDRESS=0x_PASTE_FROM_DEPLOY_OUTPUT
VITE_VOUCH_POOL_ADDRESS=0x_PASTE_FROM_DEPLOY_OUTPUT
VITE_REPUTATION_ADDRESS=0x_PASTE_FROM_DEPLOY_OUTPUT
VITE_CHAIN_ID=11155111
VITE_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
VITE_BLOCK_EXPLORER=https://sepolia.etherscan.io
```

---

## Section 10 — Design System

> **ALL DESIGN DECISIONS ARE FINAL. DO NOT CHANGE THEM.**

### Fonts

Add to `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```

| Use | Font |
|---|---|
| Headings, logo, hero text | `"Fraunces", serif` |
| Body, labels, buttons, nav | `"DM Sans", sans-serif` |
| Code, contract addresses | system monospace |

### Colour Palette

| Token | Hex | Usage |
|---|---|---|
| Background page | `#F5F3EE` | Warm cream, page bg |
| Card / surface | `#FFFFFF` | Cards |
| Border default | `#D6D3CE` | |
| Border hover | `#A8A49E` | |
| Primary brand | `#00897B` | Teal — main CTA |
| Primary dark | `#00574F` | Hover state |
| Primary light fill | `#E0F2F1` | Teal tint backgrounds |
| Primary text on fill | `#00574F` | |
| Voucher accent | `#5C35A8` | Purple |
| Voucher light fill | `#EDE7F6` | |
| Voucher text on fill | `#3B1F7A` | |
| Lender accent | `#D97706` | Amber |
| Lender light fill | `#FEF3C7` | |
| Lender text on fill | `#92400E` | |
| Profile accent | `#1565C0` | Blue |
| Profile light fill | `#E3F2FD` | |
| Profile text on fill | `#0D3A7A` | |
| Danger / default | `#D32F2F` | Red |
| Danger light fill | `#FFEBEE` | |
| Success | `#2E7D32` | |
| Warning | `#E65100` | |
| Text primary | `#1A1A1A` | |
| Text secondary | `#4B4B4B` | |
| Text muted | `#6B6B6B` | |
| Text disabled | `#9CA3AF` | |

### Typography Scale

| Element | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Hero heading | Fraunces | 48px | 700 | letter-spacing -1px |
| Page heading h1 | Fraunces | 32px | 600 | |
| Section heading h2 | Fraunces | 24px | 600 | |
| Card heading h3 | DM Sans | 18px | 600 | |
| Body | DM Sans | 16px | 400 | line-height 1.65 |
| Label / caption | DM Sans | 13px | 500 | |
| Badge / chip | DM Sans | 12px | 600 | uppercase, letter-spacing 0.5px |
| Monospace (addresses) | system mono | 13px | 400 | |

### Spacing & Shape

- Spacing: multiples of 4px. Standard card padding is 24px.
- Border radius: 10px for cards, 8px for buttons, 6px for badges.
- Shadows: `0 2px 12px rgba(0,0,0,0.07)` for cards.

### Buttons

| Type | Style |
|---|---|
| Primary | bg `#00897B`, text white, hover `#00574F`, rounded-lg, px-6 py-3 |
| Secondary | transparent bg, border 1.5px `#00897B`, text `#00897B`, hover bg `#E0F2F1` |
| Danger | bg `#D32F2F`, text white, hover `#B71C1C` |
| Disabled | bg `#D6D3CE`, text `#9CA3AF`, cursor-not-allowed |

### State Badges

| State | Background | Text |
|---|---|---|
| Pending | `#FEF3C7` | `#92400E` |
| FullyVouched | `#E0F2F1` | `#00574F` |
| Funded | `#E3F2FD` | `#0D3A7A` |
| Repaid | `#DCFCE7` | `#14532D` |
| DefaultClaimed | `#FFEBEE` | `#B71C1C` |
| Defaulted | `#D32F2F` | white |

### Animations

- Page transitions: opacity 0→1 over 200ms
- Button hover: scale 1→1.02 over 150ms
- Card hover: translateY 0→-2px, shadow intensify, 150ms
- Loading spinner: spinning ring using border-t-transparent
- Toast notifications: slide in from bottom-right, auto-dismiss 4s

---

## Section 11 — Shared Utilities

### `frontend/src/config/contracts.js`

```javascript
import LoanRequestABI from '../abis/LoanRequest.json';
import VouchPoolABI   from '../abis/VouchPool.json';
import ReputationABI  from '../abis/ReputationToken.json';

export const CONTRACTS = {
  loanRequest: {
    address: import.meta.env.VITE_LOAN_REQUEST_ADDRESS,
    abi: LoanRequestABI.abi
  },
  vouchPool: {
    address: import.meta.env.VITE_VOUCH_POOL_ADDRESS,
    abi: VouchPoolABI.abi
  },
  reputation: {
    address: import.meta.env.VITE_REPUTATION_ADDRESS,
    abi: ReputationABI.abi
  }
};

export const SEPOLIA_CHAIN_ID = 11155111;
export const BLOCK_EXPLORER   = "https://sepolia.etherscan.io";

export const LOAN_STATES = {
  0: "Pending",
  1: "FullyVouched",
  2: "Funded",
  3: "Repaid",
  4: "DefaultClaimed",
  5: "Defaulted"
};
```

### `frontend/src/utils/formatters.js`

```javascript
import { ethers } from "ethers";

export function formatEth(wei) {
  if (!wei) return "0 ETH";
  return parseFloat(ethers.formatEther(wei)).toFixed(4) + " ETH";
}

export function truncateAddress(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function formatDate(timestamp) {
  if (!timestamp || timestamp == 0) return "—";
  return new Date(Number(timestamp) * 1000).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
}

export function daysRemaining(dueTimestamp) {
  const now  = Date.now() / 1000;
  const diff = Number(dueTimestamp) - now;
  if (diff <= 0) return "Overdue";
  const days = Math.floor(diff / 86400);
  const hrs  = Math.floor((diff % 86400) / 3600);
  return days > 0 ? `${days}d ${hrs}h` : `${hrs}h`;
}

export function calcRepaymentAmount(loanAmount, interestBps) {
  const interest = (BigInt(loanAmount) * BigInt(interestBps)) / 10000n;
  return (BigInt(loanAmount) + interest).toString();
}

export function getScoreColor(score) {
  if (score <= 33) return "#D32F2F";
  if (score <= 66) return "#D97706";
  return "#00897B";
}
```

### `frontend/src/utils/constants.js`

```javascript
export const MIN_VOUCHERS     = 2;
export const MAX_VOUCHERS     = 3;
export const MIN_STAKE_PCT    = 80;
export const MAX_TERM_DAYS    = 365;
export const MIN_INTEREST_BPS = 100;   // 1%
export const MAX_INTEREST_BPS = 5000;  // 50%
export const DISPUTE_WINDOW_S = 48 * 60 * 60;

export const MAX_LOAN_BY_SCORE = {
  0:   "0.05",
  20:  "0.2",
  50:  "0.5",
  100: "1.0"
};
```

---

## Section 12 — Wallet Context + Hooks

### `frontend/src/context/WalletContext.jsx`

Create a React context that provides:

| Value | Type | Description |
|---|---|---|
| `address` | `string \| null` | Connected wallet address |
| `balance` | `string` | ETH balance formatted |
| `provider` | `BrowserProvider \| null` | ethers.js provider |
| `signer` | `Signer \| null` | ethers.js signer |
| `isConnected` | `boolean` | |
| `isCorrectNetwork` | `boolean` | true only if chainId == 11155111 |
| `connect()` | function | Calls `eth_requestAccounts` |
| `disconnect()` | function | Clears state |
| `switchToSepolia()` | function | Calls `wallet_switchEthereumChain` |

Listen to `accountsChanged` and `chainChanged` events on `window.ethereum`. On mount, check if already connected via `eth_accounts`. Wrap the entire app in `<WalletProvider>` in `main.jsx`.

### `frontend/src/hooks/useWallet.js`

```javascript
export default function useWallet() { return useContext(WalletContext); }
```

### `frontend/src/hooks/useLoanRequest.js`

Implement these functions. Each write function calls the contract, awaits `tx.wait()`, and returns the receipt.

| Function | Description |
|---|---|
| `createLoanRequest(amount, termDays, interestBps, purpose, voucherAddresses)` | `amount` is a string like `"0.05"`, convert with `ethers.parseEther`. Returns `loanId` from `LoanCreated` event. |
| `getLoan(loanId)` | Read-only. Returns the Loan struct. |
| `repayLoan(loanId)` | First reads `getRepaymentAmount(loanId)`, sends that exact value as `msg.value`. |
| `fundLoan(loanId, loanAmountWei)` | Sends `loanAmountWei` as `msg.value`. |
| `claimDefault(loanId)` | Write. |
| `finalizeDefault(loanId)` | Write. |
| `disputeDefault(loanId)` | Write. |
| `checkAndActivate(loanId)` | Write. Call after every stake. |
| `getBorrowerLoans(address)` | Read-only. |
| `getLenderLoans(address)` | Read-only. |
| `getRepaymentAmount(loanId)` | Read-only. Returns wei string. |

### `frontend/src/hooks/useVouchPool.js`

| Function | Description |
|---|---|
| `stake(loanId, amountEth)` | Converts string to wei, sends as `msg.value`. After tx confirmed, calls `checkAndActivate(loanId)`. |
| `getVouchers(loanId)` | Returns array of `VoucherInfo` structs. |
| `getTotalStaked(loanId)` | Returns wei string. |
| `getStakesByVoucher(address)` | Returns array of loanIds. |

### `frontend/src/hooks/useReputation.js`

| Function | Description |
|---|---|
| `getScore(address)` | Returns number 0–100. |
| `getMaxLoan(address)` | Returns ETH string. |
| `getProfile(address)` | Returns Profile struct. |
| `hasToken(address)` | Returns boolean. |

---

## Section 13 — Shared Components

### `Navbar.jsx`

- Background `#FFFFFF`, border-bottom 1px `#D6D3CE`, height 64px
- **Left:** TrustCircle logo — Fraunces font, teal colour, small circular icon (two overlapping circles)
- **Centre:** nav links — Borrow, Vouch, Lend, Stats. DM Sans 15px, `#4B4B4B`. Active = `#00897B` with 2px underline.
- **Right:** `NotificationBell` + `WalletBar`
- Mobile: hamburger collapses nav links

### `WalletBar.jsx`

- **Not connected:** primary button "Connect Wallet"
- **Connected:** pill shape, bg `#F5F3EE`, border `#D6D3CE`
  - Left: green dot (8px, `#2E7D32`) if correct network, red if wrong
  - Middle: truncated address (mono 13px)
  - Right: ETH balance (`#00574F`)
  - Click: dropdown with "View Profile" and "Disconnect"

### `NotificationBell.jsx`

- Bell icon 24px, red badge with unread count
- Dropdown: list of notifications fetched from contract events for connected wallet
- Notification types: `vouch_request`, `repayment_due` (within 3 days), `stake_released`, `slashed`
- Each: icon + one-line description + time ago + link

### `NetworkGuard.jsx`

- Full-screen overlay (not a modal) when wrong network — blocks all content
- Semi-transparent dark backdrop
- Centre card: Fraunces heading "Wrong Network", body explaining Sepolia, primary button "Switch to Sepolia"

### `TxToast.jsx`

Use `react-hot-toast`. Export a `useTxToast()` hook:

```javascript
async function withToast(txPromise) {
  const toastId = toast.loading("Submitting...");
  try {
    const tx  = await txPromise;
    toast.loading("Confirming...", { id: toastId });
    const rec = await tx.wait();
    toast.success("Confirmed!", { id: toastId });
    return rec;
  } catch (err) {
    toast.error(err.reason || "Transaction failed", { id: toastId });
    throw err;
  }
}
```

### `TrustMeter.jsx`

Props: `score` (0–100), `size` ("sm" | "md" | "lg")

- SVG semicircular gauge (180° arc)
- Background arc: `#D6D3CE`, strokeWidth 10
- Filled arc: colour from `getScoreColor(score)`, animated on mount over 800ms
- Centre number in Fraunces, label "Trust Score" below
- Sizes: sm = 80px, md = 120px, lg = 160px

SVG arc math:
```javascript
const radius        = 40;
const circumference = Math.PI * radius;  // half circle
const dashOffset    = circumference * (1 - score / 100);
// Use stroke-dasharray={circumference} stroke-dashoffset={dashOffset}
// Rotate arc -180deg so it fills left to right
```

### `LoanCard.jsx`

Props: `loan` (Loan object), `role` ("borrower" | "lender" | "browse")

- White card, 10px radius, shadow, hover lifts 2px
- Top-left: loan amount (Fraunces 20px, teal)
- Top-right: `StatusBadge`
- Middle: three info chips — Term, Interest Rate, Vouchers staked
- Bottom: borrower address (truncated mono) + due date
- `role="browse"`: show "Fund Loan" button on hover
- `role="borrower"`: show "Repay" if state=Funded
- `role="lender"`: show "Claim Default" if overdue

### `StatusBadge.jsx`

Props: `state` (number 0–5). Renders a pill using `LOAN_STATES` and the colour system from Section 10.

### `CountdownTimer.jsx`

Props: `dueTimestamp` (unix seconds). Real-time countdown updating every second. Shows `"Xd Yh Zm"` or `"OVERDUE"` in red with pulsing animation.

### `ReputationCard.jsx`

- Full-width card with teal gradient strip at top (8px)
- Left: `TrustMeter` (lg), score, "Trust Score" label
- Right: four stat rows — Loans repaid, Total repaid, Vouches made, Voucher accuracy
- Bottom: wallet address (mono, copyable), member since date

---

## Section 14 — Pages: Borrower

### `NewLoan.jsx` — `/borrow/new`

Multi-step form with 3 steps and a progress indicator.

**Step 1 — Loan Details**
- Loan Amount (ETH) input with `"Your max loan: X ETH"` fetched from `getMaxLoan()`
- Loan Term slider/input, 1–365 days
- Interest Rate slider, 1%–50%, shows estimated cost
- Purpose textarea, max 140 chars with character counter
- "Next" disabled if validation fails

**Step 2 — Invite Vouchers**
- "Who do you trust to vouch for you?"
- 2–3 dynamic wallet address inputs
- Validate each is a valid ETH address; none can be the borrower's own address
- "Add another voucher" button (max 3)

**Step 3 — Review & Sign**
- Full summary of loan terms
- Note: voucher yield percentage, default consequences
- "Create Loan Request" button → calls `createLoanRequest()` → redirect to `/borrow/:loanId`

### `LoanStatus.jsx` — `/borrow/:loanId`

Polls loan data every 12 seconds.

- Top: loan amount (Fraunces, large), `StatusBadge`
- 5-step progress bar: Pending → Vouched → Funded → Repaid. Current step in teal with checkmarks for completed steps.
- Voucher list: invited addresses with stake amounts (green check if staked, grey clock if pending)
- If Funded: `CountdownTimer` + "Repay Now" CTA
- If DefaultClaimed: red alert banner + dispute button
- If Repaid: green success state with confetti animation

### `Repay.jsx` — `/borrow/:loanId/repay`

- Breakdown card: Principal, Interest, Total Due (bold teal), Due Date, `CountdownTimer`
- Large primary button "Repay X ETH"
- Red warning banner if overdue
- Calls `repayLoan()` with exact ETH as `msg.value`

### `Dispute.jsx` — `/borrow/:loanId/dispute`

- Red alert card explaining default was claimed
- `CountdownTimer` for 48hr window remaining
- Textarea for dispute reason
- "Submit Dispute" → calls `disputeDefault(loanId)` → redirect to `/borrow/:loanId`

---

## Section 15 — Pages: Voucher

### `Inbox.jsx` — `/vouch/inbox`

On mount: query `VouchPool` for `VouchRequested` events where `voucher == connectedAddress`.

- Heading "Vouch Requests" with count badge
- Empty state message
- Each request card: borrower address + `TrustMeter` (sm), loan details, purpose note
- Two buttons: "Stake & Support" (links to `/vouch/:loanId/stake`) | "Decline"

### `StakeETH.jsx` — `/vouch/:loanId/stake`

- **Left panel:** loan summary (borrower, amount, term, interest)
- **Right panel:**
  - Your ETH balance
  - Minimum stake required
  - Progress bar toward 80% coverage
  - Stake amount input
  - Live projected yield: `(stakeAmount / totalLoanAmount) * (interest * 30%)`
  - Checkbox: "I understand I will lose this stake if the borrower defaults"
  - "Stake ETH" button → calls `stake(loanId)` then `checkAndActivate(loanId)`

### `ActiveVouches.jsx` — `/vouch/active`

- Summary row: total staked, projected total yield, active loan count
- Loan cards with health dot: green (on track), yellow (due within 7 days), red (overdue)
- `CountdownTimer` per card
- Red warning banner on any `DefaultClaimed` loan

---

## Section 16 — Pages: Lender

### `BrowseLoans.jsx` — `/lend/browse`

Fetch all `LoanCreated` events, filter to state == 1 (FullyVouched).

- Filter bar: min trust score, max loan size, interest rate range
- Sort: Highest Interest | Highest Trust Score | Newest
- Grid of `LoanCard` components (role="browse")
- Empty state message

### `LoanDetail.jsx` — `/lend/:loanId`

**Left column (60%):**
- Borrower address, `TrustMeter` (md), repayment/default counts
- Loan terms: amount, term, interest, purpose, total repayment
- Voucher list: each with address, `TrustMeter` (sm), stake amount
- Progress bar: total staked vs 80% minimum marker

**Right column (40%) — sticky funding card:**
- Loan amount, interest earned, total returned, lender's net exposure
- "Fund This Loan" button → calls `fundLoan(loanId)` with exact `loan.amount`

### `Portfolio.jsx` — `/lend/portfolio`

- Summary stats: total deployed, total earned, active, completed
- Tabs: Active | Repaid | Defaulted
- `LoanCard` (role="lender") for each

---

## Section 17 — Pages: Profile & Stats

### `Profile.jsx` — `/profile/:address`

If no `:address` param, show the connected wallet's profile.

- Top banner: teal gradient strip, wallet address (mono), "Member since" date
- `ReputationCard` component
- Two tabs: Borrow History | Vouch History
- Borrow History: list of loans with state, amount, date
- Vouch History: list of vouched loans with outcome, stake, yield/loss
- "Copy profile link" button

### `Stats.jsx` — `/stats`

- Four large stat cards: total loans created, total ETH lent, platform repayment rate %, total active vouchers
- Table: last 10 contract events

---

## Section 18 — Pages: Landing

**File:** `frontend/src/pages/Landing.jsx` — route `/`

### Hero Section (full viewport height)

- Background `#F5F3EE`
- **Left half:**
  - Eyebrow: DM Sans 13px, teal, uppercase, letter-spacing 2px — `"SOCIAL-VOUCHED MICRO-LENDING"`
  - Headline: Fraunces 52px 700 — `"Borrow with trust. Not with crypto."`
  - Subheading: DM Sans 18px `#4B4B4B` — the 1.4 billion unbanked pitch
  - Two buttons: "Start Borrowing" → `/borrow/new` | "Fund a Loan" → `/lend/browse`
- **Right half:** animated SVG network diagram — borrower node (teal centre), 2–3 voucher nodes (purple), 1 lender node (amber). Pulsing stroke-dashoffset animation on connection lines.

### How It Works Section

- Light teal background strip
- Fraunces heading "How TrustCircle works"
- Three columns with large step numbers (Fraunces 80px, very light teal):
  1. Request a loan
  2. Your network vouches
  3. Get funded

### Stats Section

- Dark background `#1A1A1A`
- Three Fraunces numbers: loans funded, ETH deployed, repayment rate
- Animated count-up on scroll into view

### Footer

- Logo, three nav links, "Built on Ethereum Sepolia"
- DM Sans 14px, text `#6B6B6B`

---

## Section 19 — App Router Setup

**File:** `frontend/src/App.jsx`

```jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { WalletProvider } from "./context/WalletContext";
import Navbar from "./components/layout/Navbar";
import NetworkGuard from "./components/common/NetworkGuard";
// Import all page components

function AuthRequired({ children }) {
  const { isConnected } = useWallet();
  if (!isConnected) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <Navbar />
        <NetworkGuard />
        <Toaster position="bottom-right" />
        <Routes>
          <Route path="/"                        element={<Landing />} />
          <Route path="/stats"                   element={<Stats />} />
          <Route path="/profile/:address"        element={<Profile />} />
          <Route path="/profile"                 element={<AuthRequired><Profile /></AuthRequired>} />

          <Route path="/borrow"                  element={<AuthRequired><BorrowHome /></AuthRequired>} />
          <Route path="/borrow/new"              element={<AuthRequired><NewLoan /></AuthRequired>} />
          <Route path="/borrow/:loanId"          element={<AuthRequired><LoanStatus /></AuthRequired>} />
          <Route path="/borrow/:loanId/repay"    element={<AuthRequired><Repay /></AuthRequired>} />
          <Route path="/borrow/:loanId/dispute"  element={<AuthRequired><Dispute /></AuthRequired>} />

          <Route path="/vouch"                   element={<AuthRequired><VouchHome /></AuthRequired>} />
          <Route path="/vouch/inbox"             element={<AuthRequired><Inbox /></AuthRequired>} />
          <Route path="/vouch/:loanId/stake"     element={<AuthRequired><StakeETH /></AuthRequired>} />
          <Route path="/vouch/active"            element={<AuthRequired><ActiveVouches /></AuthRequired>} />
          <Route path="/vouch/history"           element={<AuthRequired><VouchHistory /></AuthRequired>} />

          <Route path="/lend"                    element={<AuthRequired><LendHome /></AuthRequired>} />
          <Route path="/lend/browse"             element={<LendBrowse />} />
          <Route path="/lend/:loanId"            element={<LoanDetail />} />
          <Route path="/lend/portfolio"          element={<AuthRequired><Portfolio /></AuthRequired>} />
          <Route path="/lend/:loanId/default"    element={<AuthRequired><ClaimDefault /></AuthRequired>} />
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  );
}
```

---

## Section 20 — ABI Copy Step

After running `npx hardhat compile` in `contracts/`, copy the ABI files:

| From | To |
|---|---|
| `contracts/artifacts/contracts/LoanRequest.sol/LoanRequest.json` | `frontend/src/abis/LoanRequest.json` |
| `contracts/artifacts/contracts/VouchPool.sol/VouchPool.json` | `frontend/src/abis/VouchPool.json` |
| `contracts/artifacts/contracts/ReputationToken.sol/ReputationToken.json` | `frontend/src/abis/ReputationToken.json` |

The full artifact file works — reference `.abi` when creating a contract instance:

```javascript
const contract = new ethers.Contract(address, abi.abi, signer);
```

---

## Section 21 — Get Test ETH for Sepolia

Sepolia ETH is free. Get it from:

- [sepoliafaucet.com](https://sepoliafaucet.com) — requires Alchemy account
- [infura.io/faucet](https://www.infura.io/faucet) — requires Infura account
- [faucet.quicknode.com](https://faucet.quicknode.com) — no account needed, 0.1 ETH

Get test ETH for at least 3 wallets:

| Wallet | Role |
|---|---|
| Wallet 1 | Deployer + Borrower |
| Wallet 2 | Voucher |
| Wallet 3 | Lender |

---

## Section 22 — Build Order for Agent

> Follow this order strictly. Do not move to a later step until the current step is working and verified.

### Phase 1 — Contracts (complete before any frontend)

- [ ] 1.1 Write `ReputationToken.sol` exactly as in Section 3
- [ ] 1.2 Write `VouchPool.sol` exactly as in Section 4
- [ ] 1.3 Write `LoanRequest.sol` exactly as in Section 5
- [ ] 1.4 Run `npx hardhat compile` — fix all compiler errors
- [ ] 1.5 Write test file as described in Section 7
- [ ] 1.6 Run `npx hardhat test` — all 3 tests must pass
- [ ] 1.7 Set up `contracts/.env` with real Sepolia RPC URL
- [ ] 1.8 Run deploy script — save all 3 contract addresses

### Phase 2 — Frontend Foundation

- [ ] 2.1 Scaffold Vite React project as in Section 8
- [ ] 2.2 Copy ABIs as described in Section 20
- [ ] 2.3 Create `config/contracts.js` and both utils files
- [ ] 2.4 Build `WalletContext` — test MetaMask connect works
- [ ] 2.5 Build `NetworkGuard` — test it appears on wrong network
- [ ] 2.6 Build `TxToast` — verify toast appears on tx

### Phase 3 — Core Loop (P0 — must demo)

- [ ] 3.1 Build `NewLoan.jsx` — test creating a loan on Sepolia
- [ ] 3.2 Build `StakeETH.jsx` — test staking from a second wallet
- [ ] 3.3 Build `LoanDetail.jsx` + `BrowseLoans.jsx` — test funding
- [ ] 3.4 Build `Repay.jsx` — test full repayment
- [ ] 3.5 Verify full happy path end-to-end on Sepolia

### Phase 4 — Supporting Features (P1)

- [ ] 4.1 Build `TrustMeter.jsx` + `Profile.jsx`
- [ ] 4.2 Build `LoanStatus.jsx` with state machine progress bar
- [ ] 4.3 Build `ActiveVouches.jsx` + `Portfolio.jsx`
- [ ] 4.4 Build `Navbar` + `NotificationBell`
- [ ] 4.5 Build `Landing.jsx`

### Phase 5 — Polish (P2 — only if time allows)

- [ ] 5.1 `Dispute.jsx` + `ClaimDefault.jsx`
- [ ] 5.2 `VouchHistory.jsx` + `LoanHistory.jsx`
- [ ] 5.3 `Stats.jsx`
- [ ] 5.4 Mobile responsive fixes
- [ ] 5.5 Animations and hover states

---

## Section 23 — Critical Rules for Agent

1. **NEVER write a backend server.** No Express. No Node API. No database. All state is on-chain.

2. **NEVER store private keys in the frontend.** The user's MetaMask wallet handles all signing. Never ask for a private key in the UI.

3. **ALL write contract calls** must go through ethers.js with the user's MetaMask signer. Read-only calls use the provider.

4. **ALWAYS show a loading state** while a transaction is pending. Transactions on Sepolia take 12–30 seconds. Never leave the user staring at a blank screen.

5. **ALWAYS handle MetaMask errors.** Common cases:
   - User rejected → show friendly message
   - Insufficient funds → `"Not enough ETH in your wallet"`
   - Contract revert → parse `err.reason` and display it

6. **ALWAYS validate loan amount** against `getMaxLoan()` before calling `createLoanRequest`. Pre-validate in the UI — a revert error is confusing to end users.

7. **After `checkAndActivate()`**, the loan may or may not become FullyVouched immediately. Poll `getLoan()` for 1–2 seconds after the tx to update the UI state.

8. **Checksummed addresses:** Always pass addresses through `ethers.getAddress(addr)` before sending to a contract to avoid checksum errors.

9. **BigInt vs number:** ethers.js v6 returns `BigInt` for `uint256`. Use `Number()` or `.toString()` before rendering. Never mix BigInt and number in arithmetic.

10. **ABI files must match the deployed contract exactly.** If you change a contract and redeploy, recompile and recopy the ABI files. Stale ABIs cause silent failures.

11. **Follow the design system in Section 10 exactly.** Do not use Inter, Roboto, or Arial. Do not use purple gradients on white backgrounds. Use the exact hex values specified.

12. **All sensitive values go in `.env` files.** `.env` goes in `.gitignore` immediately. Never hardcode contract addresses in source files.

---

*End of AGENTS.md*