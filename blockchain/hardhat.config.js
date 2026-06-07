require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: __dirname + "/.env" });

const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    amoy: {
      url: POLYGON_RPC_URL,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};
