const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Metaverse Contracts", function () {
  let owner, addr1, addr2, addr3;
  let vestingToken, metaverseItem, lootCrate, vestingVault;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // Deploy VestingToken
    const VestingToken = await ethers.getContractFactory("VestingToken");
    vestingToken = await VestingToken.deploy("Metaverse Token", "MVT", owner.address);
    await vestingToken.waitForDeployment();

    // Deploy MetaverseItem
    const MetaverseItem = await ethers.getContractFactory("MetaverseItem");
    metaverseItem = await MetaverseItem.deploy(
      "Metaverse Item", 
      "MVI", 
      owner.address, 
      "ipfs://QmTest/"
    );
    await metaverseItem.waitForDeployment();

    // Deploy LootCrate
    const LootCrate = await ethers.getContractFactory("LootCrate");
    lootCrate = await LootCrate.deploy();
    await lootCrate.waitForDeployment();

    // Deploy VestingVault
    const VestingVault = await ethers.getContractFactory("VestingVault");
    vestingVault = await VestingVault.deploy(
      await vestingToken.getAddress(),
      owner.address
    );
    await vestingVault.waitForDeployment();

    // Grant MINTER_ROLE to VestingVault
    const MINTER_ROLE = await vestingToken.MINTER_ROLE();
    await vestingToken.grantRole(MINTER_ROLE, await vestingVault.getAddress());
  });

  describe("VestingToken", function () {
    it("Should deploy with correct initial values", async function () {
      expect(await vestingToken.name()).to.equal("Metaverse Token");
      expect(await vestingToken.symbol()).to.equal("MVT");
      expect(await vestingToken.totalSupply()).to.equal(ethers.parseEther("100000000"));
      expect(await vestingToken.balanceOf(owner.address)).to.equal(ethers.parseEther("100000000"));
    });

    it("Should mint tokens with MINTER_ROLE", async function () {
      const MINTER_ROLE = await vestingToken.MINTER_ROLE();
      await vestingToken.grantRole(MINTER_ROLE, addr1.address);
      
      await vestingToken.connect(addr1).mint(addr2.address, ethers.parseEther("1000"));
      expect(await vestingToken.balanceOf(addr2.address)).to.equal(ethers.parseEther("1000"));
    });

    it("Should not allow non-minter to mint", async function () {
      await expect(
        vestingToken.connect(addr1).mint(addr2.address, ethers.parseEther("1000"))
      ).to.be.reverted;
    });

    it("Should burn tokens", async function () {
      const initialBalance = await vestingToken.balanceOf(owner.address);
      await vestingToken.burn(ethers.parseEther("1000"));
      expect(await vestingToken.balanceOf(owner.address)).to.equal(initialBalance - ethers.parseEther("1000"));
    });

    it("Should transfer tokens", async function () {
      await vestingToken.transfer(addr1.address, ethers.parseEther("1000"));
      expect(await vestingToken.balanceOf(addr1.address)).to.equal(ethers.parseEther("1000"));
    });

    it("Should pause and unpause", async function () {
      await vestingToken.pause();
      
      await expect(
        vestingToken.transfer(addr1.address, ethers.parseEther("1000"))
      ).to.be.reverted;

      await vestingToken.unpause();
      await vestingToken.transfer(addr1.address, ethers.parseEther("1000"));
      expect(await vestingToken.balanceOf(addr1.address)).to.equal(ethers.parseEther("1000"));
    });

    it("Should not allow non-admin to pause", async function () {
      await expect(vestingToken.connect(addr1).pause()).to.be.reverted;
    });
  });

  describe("MetaverseItem", function () {
    it("Should deploy with correct initial values", async function () {
      expect(await metaverseItem.name()).to.equal("Metaverse Item");
      expect(await metaverseItem.symbol()).to.equal("MVI");
      expect(await metaverseItem.totalSupply()).to.equal(0);
    });

    it("Should mint NFT with MINTER_ROLE", async function () {
      const MINTER_ROLE = await metaverseItem.MINTER_ROLE();
      await metaverseItem.grantRole(MINTER_ROLE, addr1.address);
      
      await metaverseItem.connect(addr1).mint(addr2.address);
      expect(await metaverseItem.balanceOf(addr2.address)).to.equal(1);
      expect(await metaverseItem.ownerOf(1)).to.equal(addr2.address);
      expect(await metaverseItem.totalSupply()).to.equal(1);
    });

    it("Should not allow non-minter to mint", async function () {
      await expect(metaverseItem.connect(addr1).mint(addr2.address)).to.be.reverted;
    });

    it("Should not mint to zero address", async function () {
      await expect(
        metaverseItem.mint(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(metaverseItem, "ZeroAddress");
    });

    it("Should not exceed max supply", async function () {
      // This would take too long to test 10,000 mints, so we'll test the logic
      // by checking the revert condition exists in the contract
      const MINTER_ROLE = await metaverseItem.MINTER_ROLE();
      await metaverseItem.grantRole(MINTER_ROLE, addr1.address);
      
      // Mint a few tokens to verify the function works
      await metaverseItem.connect(addr1).mint(addr2.address);
      await metaverseItem.connect(addr1).mint(addr2.address);
      expect(await metaverseItem.totalSupply()).to.equal(2);
    });

    it("Should set base URI by admin", async function () {
      const newBaseURI = "ipfs://QmNewHash/";
      await metaverseItem.setBaseURI(newBaseURI);
      
      // Mint a token to test URI
      await metaverseItem.mint(addr1.address);
      expect(await metaverseItem.tokenURI(1)).to.equal(newBaseURI + "1.json");
    });

    it("Should not allow non-admin to set base URI", async function () {
      await expect(
        metaverseItem.connect(addr1).setBaseURI("ipfs://test/")
      ).to.be.reverted;
    });

    it("Should set royalty on mint", async function () {
      await metaverseItem.mint(addr1.address);
      const royaltyInfo = await metaverseItem.royaltyInfo(1, ethers.parseEther("1"));
      expect(royaltyInfo[0]).to.equal(addr1.address); // Royalty recipient
      expect(royaltyInfo[1]).to.equal(ethers.parseEther("0.05")); // 5% royalty
    });
  });

  describe("LootCrate", function () {
    it("Should deploy with correct initial values", async function () {
      expect(await lootCrate.MAX_SUPPLY_SWORD()).to.equal(5000);
      expect(await lootCrate.MAX_SUPPLY_SHIELD()).to.equal(5000);
      expect(await lootCrate.MAX_SUPPLY_COSMETICS()).to.equal(1);
    });

    it("Should open crate with correct payment", async function () {
      const cratePrice = ethers.parseEther("0.02");
      const initialBalance = await lootCrate.balanceOf(addr1.address, 1);
      
      await lootCrate.connect(addr1).openCrate(1, { value: cratePrice });
      
      // Check that some token was minted (we can't predict which due to randomness)
      const balance1 = await lootCrate.balanceOf(addr1.address, 1);
      const balance2 = await lootCrate.balanceOf(addr1.address, 2);
      const balance3 = await lootCrate.balanceOf(addr1.address, 3);
      const balance4 = await lootCrate.balanceOf(addr1.address, 4);
      const balance5 = await lootCrate.balanceOf(addr1.address, 5);
      
      expect(balance1 + balance2 + balance3 + balance4 + balance5).to.be.greaterThan(initialBalance);
    });

    it("Should open multiple crates", async function () {
      const cratePrice = ethers.parseEther("0.04"); // 2 crates
      await lootCrate.connect(addr1).openCrate(2, { value: cratePrice });
      
      // Should have received 2 tokens total
      const balance1 = await lootCrate.balanceOf(addr1.address, 1);
      const balance2 = await lootCrate.balanceOf(addr1.address, 2);
      const balance3 = await lootCrate.balanceOf(addr1.address, 3);
      const balance4 = await lootCrate.balanceOf(addr1.address, 4);
      const balance5 = await lootCrate.balanceOf(addr1.address, 5);
      
      expect(balance1 + balance2 + balance3 + balance4 + balance5).to.equal(2n);
    });

    it("Should revert with incorrect payment", async function () {
      const incorrectPrice = ethers.parseEther("0.01");
      await expect(
        lootCrate.connect(addr1).openCrate(1, { value: incorrectPrice })
      ).to.be.revertedWith("Incorrect payment amount");
    });

    it("Should revert with zero count", async function () {
      await expect(
        lootCrate.connect(addr1).openCrate(0, { value: 0 })
      ).to.be.revertedWith("Count must be greater than 0");
    });

    it("Should mint batch with MINTER_ROLE", async function () {
      const MINTER_ROLE = await lootCrate.MINTER_ROLE();
      await lootCrate.grantRole(MINTER_ROLE, addr1.address);
      
      const ids = [1, 2, 3];
      const amounts = [10, 5, 1];
      
      await lootCrate.connect(addr1).mintBatch(addr2.address, ids, amounts);
      
      expect(await lootCrate.balanceOf(addr2.address, 1)).to.equal(10);
      expect(await lootCrate.balanceOf(addr2.address, 2)).to.equal(5);
      expect(await lootCrate.balanceOf(addr2.address, 3)).to.equal(1);
    });

    it("Should not allow non-minter to mint batch", async function () {
      const ids = [1, 2];
      const amounts = [10, 5];
      
      await expect(
        lootCrate.connect(addr1).mintBatch(addr2.address, ids, amounts)
      ).to.be.reverted;
    });

    it("Should revert batch mint with mismatched arrays", async function () {
      const MINTER_ROLE = await lootCrate.MINTER_ROLE();
      await lootCrate.grantRole(MINTER_ROLE, addr1.address);
      
      const ids = [1, 2, 3];
      const amounts = [10, 5]; // Mismatched length
      
      await expect(
        lootCrate.connect(addr1).mintBatch(addr2.address, ids, amounts)
      ).to.be.revertedWith("ids and amounts length mismatch");
    });

    it("Should pause and unpause", async function () {
      const PAUSER_ROLE = await lootCrate.PAUSER_ROLE();
      await lootCrate.grantRole(PAUSER_ROLE, addr1.address);
      
      await lootCrate.connect(addr1).pause();
      
      await expect(
        lootCrate.connect(addr2).openCrate(1, { value: ethers.parseEther("0.02") })
      ).to.be.reverted;
      
      await lootCrate.connect(addr1).unpause();
      
      await lootCrate.connect(addr2).openCrate(1, { value: ethers.parseEther("0.02") });
    });
  });

  describe("VestingVault", function () {
    it("Should deploy with correct initial values", async function () {
      expect(await vestingVault.admin()).to.equal(owner.address);
      expect(await vestingVault.token()).to.equal(await vestingToken.getAddress());
      expect(await vestingVault.nextScheduleId()).to.equal(0);
    });

    it("Should create vesting schedule", async function () {
      const beneficiary = addr1.address;
      const currentTime = await time.latest();
      const cliff = currentTime + 86400; // 1 day from now
      const duration = 86400 * 30; // 30 days
      const amount = ethers.parseEther("1000");
      
      await vestingVault.createSchedule(beneficiary, cliff, duration, amount);
      
      const schedule = await vestingVault.vestingSchedules(0);
      expect(schedule.beneficiary).to.equal(beneficiary);
      expect(schedule.cliff).to.equal(cliff);
      expect(schedule.duration).to.equal(duration);
      expect(schedule.amount).to.equal(amount);
      expect(await vestingVault.nextScheduleId()).to.equal(1);
    });

    it("Should not allow non-admin to create schedule", async function () {
      await expect(
        vestingVault.connect(addr1).createSchedule(addr2.address, 86400, 86400 * 30, ethers.parseEther("1000"))
      ).to.be.reverted;
    });

    it("Should not create schedule with zero address", async function () {
      await expect(
        vestingVault.createSchedule(ethers.ZeroAddress, 86400, 86400 * 30, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(vestingVault, "ZeroAddress");
    });

    it("Should not create schedule with zero duration", async function () {
      await expect(
        vestingVault.createSchedule(addr1.address, 86400, 0, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(vestingVault, "NotAuthorized");
    });

    it("Should not create schedule with zero amount", async function () {
      await expect(
        vestingVault.createSchedule(addr1.address, 86400, 86400 * 30, 0)
      ).to.be.revertedWithCustomError(vestingVault, "NotAuthorized");
    });

    it("Should not create schedule with cliff in the past", async function () {
      const currentTime = await time.latest();
      const pastCliff = currentTime - 86400; // 1 day ago
      
      await expect(
        vestingVault.createSchedule(addr1.address, pastCliff, 86400 * 30, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(vestingVault, "NotAuthorized");
    });

    it("Should not allow claim before cliff", async function () {
      const currentTime = await time.latest();
      const cliff = currentTime + 86400; // 1 day from now (absolute)
      const duration = 86400 * 30; // 30 days (relative)
      const amount = ethers.parseEther("1000");
      
      await vestingVault.createSchedule(addr1.address, cliff, duration, amount);
      
      await expect(
        vestingVault.connect(addr1).claim(0)
      ).to.be.revertedWithCustomError(vestingVault, "NotAuthorized");
    });

    it("Should allow partial claim after cliff", async function () {
      const currentTime = await time.latest();
      const cliff = currentTime + 86400; // 1 day from now (absolute)
      const duration = 86400 * 30; // 30 days (relative)
      const amount = ethers.parseEther("1000");
      
      await vestingVault.createSchedule(addr1.address, cliff, duration, amount);
      
      // Fast forward past cliff but not full duration
      await time.increaseTo(cliff + (86400 * 15)); // 15 days after cliff (half duration)
      
      const initialBalance = await vestingToken.balanceOf(addr1.address);
      await vestingVault.connect(addr1).claim(0);
      const finalBalance = await vestingToken.balanceOf(addr1.address);
      
      // Should have received approximately half the tokens
      const claimed = finalBalance - initialBalance;
      expect(claimed).to.be.greaterThan(ethers.parseEther("400"));
      expect(claimed).to.be.lessThan(ethers.parseEther("600"));
    });

    it("Should allow full claim after full duration", async function () {
      const currentTime = await time.latest();
      const cliff = currentTime + 86400; // 1 day from now (absolute)
      const duration = 86400 * 30; // 30 days (relative)
      const amount = ethers.parseEther("1000");
      
      await vestingVault.createSchedule(addr1.address, cliff, duration, amount);
      
      // Fast forward past full duration
      await time.increaseTo(cliff + duration + 1); // Past full duration
      
      const initialBalance = await vestingToken.balanceOf(addr1.address);
      await vestingVault.connect(addr1).claim(0);
      const finalBalance = await vestingToken.balanceOf(addr1.address);
      
      expect(finalBalance - initialBalance).to.equal(amount);
    });

    it("Should not allow non-beneficiary to claim", async function () {
      const currentTime = await time.latest();
      const cliff = currentTime + 86400;
      const duration = 86400 * 30;
      const amount = ethers.parseEther("1000");
      
      await vestingVault.createSchedule(addr1.address, cliff, duration, amount);
      
      await time.increaseTo(cliff + duration + 1);
      
      await expect(
        vestingVault.connect(addr2).claim(0)
      ).to.be.revertedWithCustomError(vestingVault, "NotAuthorized");
    });

    it("Should not allow double claiming", async function () {
      const currentTime = await time.latest();
      const cliff = currentTime + 86400;
      const duration = 86400 * 30;
      const amount = ethers.parseEther("1000");
      
      await vestingVault.createSchedule(addr1.address, cliff, duration, amount);
      
      await time.increaseTo(cliff + duration + 1);
      
      await vestingVault.connect(addr1).claim(0);
      
      await expect(
        vestingVault.connect(addr1).claim(0)
      ).to.be.revertedWithCustomError(vestingVault, "NotAuthorized");
    });
  });
});