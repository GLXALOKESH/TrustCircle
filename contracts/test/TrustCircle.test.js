const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("TrustCircle", function () {
  let borrower;
  let voucher1;
  let voucher2;
  let lender;
  let other;

  let reputation;
  let vouchPool;
  let loanRequest;

  const LOAN_AMOUNT = ethers.parseEther("0.05");
  const TERM_DAYS = 30;
  const INTEREST_BPS = 1000; // 10%

  async function createAndCoverLoan() {
    await loanRequest.connect(borrower).createLoanRequest(
      LOAN_AMOUNT,
      TERM_DAYS,
      INTEREST_BPS,
      "Medical emergency",
      [voucher1.address, voucher2.address]
    );
    const loanId = await loanRequest.getTotalLoanCount();

    const stakeEach = ethers.parseEther("0.025");
    await vouchPool.connect(voucher1).stake(loanId, { value: stakeEach });
    await vouchPool.connect(voucher2).stake(loanId, { value: stakeEach });

    await loanRequest.checkAndActivate(loanId);

    return { loanId, stakeEach };
  }

  beforeEach(async function () {
    [, borrower, voucher1, voucher2, lender, other] = await ethers.getSigners();

    const ReputationToken = await ethers.getContractFactory("ReputationToken");
    reputation = await ReputationToken.deploy();
    await reputation.waitForDeployment();

    const VouchPool = await ethers.getContractFactory("VouchPool");
    vouchPool = await VouchPool.deploy(await reputation.getAddress());
    await vouchPool.waitForDeployment();

    const LoanRequest = await ethers.getContractFactory("LoanRequest");
    loanRequest = await LoanRequest.deploy(await vouchPool.getAddress(), await reputation.getAddress());
    await loanRequest.waitForDeployment();

    await reputation.setAuthorisedContracts(await loanRequest.getAddress(), await vouchPool.getAddress());
    await vouchPool.setLoanRequestContract(await loanRequest.getAddress());
  });

  it("Test 1 — Happy path (full repayment)", async function () {
    const { loanId, stakeEach } = await createAndCoverLoan();

    const loanAfterActivation = await loanRequest.getLoan(loanId);
    expect(loanAfterActivation.state).to.equal(1n);

    await expect(() =>
      loanRequest.connect(lender).fundLoan(loanId, { value: LOAN_AMOUNT })
    ).to.changeEtherBalances([lender, borrower], [-LOAN_AMOUNT, LOAN_AMOUNT]);

    const loanAfterFunding = await loanRequest.getLoan(loanId);
    expect(loanAfterFunding.state).to.equal(2n);

    const interest = (LOAN_AMOUNT * BigInt(INTEREST_BPS)) / 10000n;
    const totalDue = LOAN_AMOUNT + interest;

    const lenderPayout = LOAN_AMOUNT + (interest * 7000n) / 10000n;
    const voucherYieldPool = (interest * 3000n) / 10000n;
    const expectedVoucherPayout = stakeEach + voucherYieldPool / 2n;

    await expect(() =>
      loanRequest.connect(borrower).repayLoan(loanId, { value: totalDue })
    ).to.changeEtherBalances(
      [lender, voucher1, voucher2],
      [lenderPayout, expectedVoucherPayout, expectedVoucherPayout]
    );

    const loanAfterRepayment = await loanRequest.getLoan(loanId);
    expect(loanAfterRepayment.state).to.equal(3n);

    const borrowerTokenId = await reputation.addressToTokenId(borrower.address);
    const borrowerProfile = await reputation.profiles(borrowerTokenId);
    expect(borrowerProfile.repaymentCount).to.equal(1n);
  });

  it("Test 2 — Default + slash", async function () {
    const { loanId } = await createAndCoverLoan();

    await loanRequest.connect(lender).fundLoan(loanId, { value: LOAN_AMOUNT });

    const loan = await loanRequest.getLoan(loanId);
    const dueTimestamp = Number(loan.dueTimestamp);
    const latest = (await ethers.provider.getBlock("latest")).timestamp;
    const secondsToDue = dueTimestamp - latest;

    await network.provider.send("evm_increaseTime", [secondsToDue + 1]);
    await network.provider.send("evm_mine");

    await loanRequest.connect(lender).claimDefault(loanId);
    const afterClaim = await loanRequest.getLoan(loanId);
    expect(afterClaim.state).to.equal(4n);

    await network.provider.send("evm_increaseTime", [48 * 60 * 60]);
    await network.provider.send("evm_mine");

    const totalSlashed = ethers.parseEther("0.05");

    await expect(() =>
      loanRequest.connect(other).finalizeDefault(loanId)
    ).to.changeEtherBalance(lender, totalSlashed);

    const afterFinalize = await loanRequest.getLoan(loanId);
    expect(afterFinalize.state).to.equal(5n);

    const borrowerTokenId = await reputation.addressToTokenId(borrower.address);
    const borrowerProfile = await reputation.profiles(borrowerTokenId);
    expect(borrowerProfile.defaultCount).to.equal(1n);
  });

  it("Test 3 — Max loan cap enforcement", async function () {
    const maxLoan = await reputation.getMaxLoan(other.address);
    expect(maxLoan).to.equal(ethers.parseEther("0.05"));

    await expect(
      loanRequest.connect(other).createLoanRequest(
        ethers.parseEther("1"),
        30,
        1000,
        "Try large first loan",
        [voucher1.address, voucher2.address]
      )
    ).to.be.revertedWith("Amount exceeds trust limit");
  });
});
