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

    constructor(address _reputationToken) {
        reputationToken = IReputationToken(_reputationToken);
    }

    receive() external payable {}

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
