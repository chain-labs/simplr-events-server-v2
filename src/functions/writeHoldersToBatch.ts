import { ethers } from "ethers";
import { QueryParams } from "../types/DatabaseTypes.js";
import CONTRACT from "../contracts.js";
import { getMerkleTreeRoot, sendDataToIPFS } from "../utils/sendDataToIpfs.js";
import { logError } from "../utils/logger.utils.js";

const { ALCHEMY_KEY, MINTER_PRIVATE_KEY } = process.env;

const writeHoldersToBatch = async (queries: QueryParams[], contractAddress) => {
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

    const hashes = [];

    queries.forEach((query) => {
      //create hash
      const { firstName, lastName, eventName, emailId } = query;
      const concatenatedString = `${emailId}-${lastName}-${firstName}-${batchId}-${eventName}`;
      const hash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(concatenatedString)
      );
      hashes.push(hash);
    });
    const cid = await sendDataToIPFS(hashes);

    const merkleRoot = await getMerkleTreeRoot(hashes);
    const tx = await contract
      .connect(signer)
      .addBatch(merkleRoot, cid, { value: 0 });
    console.log({ cid, merkleRoot, tx });

    return { batchId, success: true };
  } catch (err) {
    logError("function/addBatch", "writeHoldersToBatch", { err });
    return { success: false, message: err };
  }
};

export default writeHoldersToBatch;
