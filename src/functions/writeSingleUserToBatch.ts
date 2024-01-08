import { ethers } from "ethers";
import { logError } from "../utils/logger.utils.js";
import { getMerkleTreeRoot, sendDataToIPFS } from "../utils/sendDataToIpfs.js";
import CONTRACT from "../contracts.js";
import { QueryParams } from "../types/DatabaseTypes.js";

const { ALCHEMY_KEY, MINTER_PRIVATE_KEY } = process.env;

interface Args extends QueryParams {
  contractAddress: string;
}

export const writeSingleUserToBatch = async ({
  contractAddress,
  firstName,
  lastName,
  emailId,
  eventName,
}: Args) => {
  try {
    const provider = new ethers.providers.JsonRpcProvider(
      `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_KEY}`
    );
    const signer = new ethers.Wallet(MINTER_PRIVATE_KEY, provider);
    const contractABI = CONTRACT.SimplrEvents.abi;
    const contract = new ethers.Contract(
      contractAddress,
      contractABI,
      provider
    );

    const currentBatchId = await contract.callStatic.currentBatchId();
    console.log({ currentBatchId: currentBatchId.toString() });
    const batchId = parseInt(currentBatchId) + 1;

    //create hash
    const concatenatedString = `${emailId}-${lastName}-${firstName}-${batchId}-${eventName}`;
    const hash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(concatenatedString)
    );
    const cid = await sendDataToIPFS([hash]);
    const merkleRoot = await getMerkleTreeRoot([hash]);
    console.log("Merkle Root:", { merkleRoot });

    const tx = contract.connect(signer).addBatch(merkleRoot, cid, { value: 0 });
    return { batchId, success: true };
  } catch (err) {
    logError("function/addBatch", "writeSingleUserToBatch", { err });
    return { success: false };
  }
};
