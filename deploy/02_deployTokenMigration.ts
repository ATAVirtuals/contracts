import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { verifyContract } from "../utils/verification";
import { ethers, upgrades } from "hardhat";

const deployTokenMigration: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const network = hre.network.name;
  console.log(`\nDeploying contracts to ${network} with account: ${deployer}\n`);

  // Deploy MigratedToken first
  let migratedTokenAddress;
  let isNewMigratedTokenDeployment = false;
  try {
    const existingMigratedToken = await get("MigratedToken");
    migratedTokenAddress = existingMigratedToken.address;
    console.log("📝 MigratedToken already deployed at:", migratedTokenAddress);
  } catch {
    console.log("Deploying MigratedToken as a proxy...");
    const MigratedToken = await ethers.getContractFactory("MigratedToken");
    const migratedToken = await upgrades.deployProxy(MigratedToken, [deployer, deployer], {
      initializer: "initialize",
    });
    await migratedToken.waitForDeployment();
    migratedTokenAddress = await migratedToken.getAddress();
    isNewMigratedTokenDeployment = true;
    console.log("🔨 MigratedToken deployed to:", migratedTokenAddress);
  }

  // Deploy TokenMigration with both addresses
  const oldTokenAddress = "0x29e39327b5B1E500B87FC0fcAe3856CD8F96eD2a";
  let tokenMigrationAddress;
  let isNewTokenMigrationDeployment = false;
  try {
    const existingTokenMigration = await get("TokenMigration");
    tokenMigrationAddress = existingTokenMigration.address;
    console.log("📝 TokenMigration already deployed at:", tokenMigrationAddress);
  } catch {
    const tokenMigration = await deploy("TokenMigration", {
      from: deployer,
      args: [oldTokenAddress, migratedTokenAddress],
      log: true,
    });
    tokenMigrationAddress = tokenMigration.address;
    isNewTokenMigrationDeployment = true;
    console.log("🔨 TokenMigration deployed to:", tokenMigrationAddress);
  }

  // Initialize MigratedToken and grant MINTER_ROLE
  const migratedToken = await ethers.getContractAt("MigratedToken", migratedTokenAddress);
  try {
    await migratedToken.initialize(deployer, tokenMigrationAddress);
    console.log("✅ MigratedToken initialized");
  } catch (error) {
    console.log("ℹ️ MigratedToken already initialized");
  }

  try {
    const MINTER_ROLE = await migratedToken.MINTER_ROLE();
    await migratedToken.grantRole(MINTER_ROLE, tokenMigrationAddress);
    console.log("🔑 MINTER_ROLE granted to TokenMigration contract");
  } catch (error) {
    console.log("ℹ️ MINTER_ROLE already granted");
  }

  // Verify contracts on non-local networks
  if (network !== "localhost" && network !== "hardhat") {
    console.log("\n🔍 Verifying MigratedToken...\n");
    try {
      await verifyContract(hre, migratedTokenAddress, []);
      console.log("✅ MigratedToken verified");
    } catch (error) {
      console.log("ℹ️ MigratedToken already verified");
    }

    console.log("\n🔍 Verifying TokenMigration...\n");
    try {
      await verifyContract(hre, tokenMigrationAddress, [oldTokenAddress, migratedTokenAddress]);
      console.log("✅ TokenMigration verified");
    } catch (error) {
      console.log("ℹ️ TokenMigration already verified");
    }
  }

  if (isNewTokenMigrationDeployment) {
    const tokenMigrationContract = await ethers.getContractAt("TokenMigration", tokenMigrationAddress);

    // Grant roles to deployer
    const PAUSER_ROLE = await tokenMigrationContract.PAUSER_ROLE();

    try {
      await tokenMigrationContract.grantRole(PAUSER_ROLE, deployer);
      console.log("✅ Granted PAUSER_ROLE to deployer");
    } catch (error) {
      console.log("ℹ️ Failed to grant PAUSER_ROLE:", error.message);
    }
  }
};

export default deployTokenMigration;
deployTokenMigration.tags = ["TokenMigration", "TM"];
deployTokenMigration.dependencies = ["MigratedToken"];
