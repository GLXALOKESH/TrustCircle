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

	constructor(address _vouchPool, address _reputationToken) {
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
