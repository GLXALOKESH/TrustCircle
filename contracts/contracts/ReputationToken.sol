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

    constructor() ERC721("TrustCircle Reputation", "TCREP") {}

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
