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
  console.log("VITE_VOUCH_POOL_ADDRESS=" + await vouchPool.getAddress());
  console.log("VITE_REPUTATION_ADDRESS=" + await reputation.getAddress());
  console.log("VITE_CHAIN_ID=11155111");
}

main().catch(console.error);
