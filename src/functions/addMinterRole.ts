import { ethers } from "ethers";
import CONTRACT from "../contracts.js";
import { logError } from "../utils/logger.utils.js";
import { TEST_NETWORK, getRpcUrl } from "../constants.js";

const { ALCHEMY_KEY, MINTER_PRIVATE_KEY } = process.env;

const addMinterRole = async (contractAddress: string) => {
  try {
    const provider = new ethers.providers.JsonRpcProvider(
      getRpcUrl(TEST_NETWORK, ALCHEMY_KEY)
    );

    const signer = new ethers.Wallet(MINTER_PRIVATE_KEY, provider);
    console.log({ provider, signer });

    const contractABI = CONTRACT.SimplrEvents.abi;
    const minterAddress = await signer.getAddress();
    const contract = new ethers.Contract(
      contractAddress,
      contractABI,
      provider
    );

    const tx = await contract
      .connect(signer)
      .addNewMinter(minterAddress, { value: 0 });

    console.log({ tx });

    await tx.wait();

    return { success: true };
  } catch (err) {
    logError("functions/addMinterRole.ts", "addMinterRole", "Error", err);
    return { success: false, err };
  }
};

export default addMinterRole;
