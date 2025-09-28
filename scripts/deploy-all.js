const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy VestingToken
  console.log("\n=== Deploying VestingToken ===");
  const VestingToken = await hre.ethers.getContractFactory("VestingToken");
  const vestingToken = await VestingToken.deploy("Metaverse Token", "MVT", deployer.address);
  await vestingToken.waitForDeployment();
  console.log("VestingToken deployed to:", await vestingToken.getAddress());

  // Deploy MetaverseItem
  console.log("\n=== Deploying MetaverseItem ===");
  const MetaverseItem = await hre.ethers.getContractFactory("MetaverseItem");
  const metaverseItem = await MetaverseItem.deploy(
    "Metaverse Item",
    "MVI", 
    deployer.address,
    "ipfs://QmYourHashHere/"
  );
  await metaverseItem.waitForDeployment();
  console.log("MetaverseItem deployed to:", await metaverseItem.getAddress());

  // Deploy LootCrate
  console.log("\n=== Deploying LootCrate ===");
  const LootCrate = await hre.ethers.getContractFactory("LootCrate");
  const lootCrate = await LootCrate.deploy();
  await lootCrate.waitForDeployment();
  console.log("LootCrate deployed to:", await lootCrate.getAddress());

  // Deploy VestingVault
  console.log("\n=== Deploying VestingVault ===");
  const VestingVault = await hre.ethers.getContractFactory("VestingVault");
  const vestingVault = await VestingVault.deploy(
    await vestingToken.getAddress(),
    deployer.address
  );
  await vestingVault.waitForDeployment();
  console.log("VestingVault deployed to:", await vestingVault.getAddress());

  // Grant MINTER_ROLE to VestingVault in VestingToken
  console.log("\n=== Setting up permissions ===");
  const MINTER_ROLE = await vestingToken.MINTER_ROLE();
  await vestingToken.grantRole(MINTER_ROLE, await vestingVault.getAddress());
  console.log("Granted MINTER_ROLE to VestingVault");

  console.log("\n=== Deployment Summary ===");
  console.log("VestingToken:", await vestingToken.getAddress());
  console.log("MetaverseItem:", await metaverseItem.getAddress());
  console.log("LootCrate:", await lootCrate.getAddress());
  console.log("VestingVault:", await vestingVault.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});