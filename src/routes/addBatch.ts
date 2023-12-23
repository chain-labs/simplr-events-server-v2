import {
  AddBatchRequestBody,
  AddBatchResponseData,
  CsvRowWithMessageId,
  ResponseData,
} from "../types/DatabaseTypes.js";
import { log, logError } from "../utils/logger.utils.js";
import { sendClaimableEmail } from "../utils/sendEmail.js";
import {
  getDaysBetweenIncludingLastDate,
  getTimestamp,
  stringToNumberTimestamp,
} from "../utils/time.utils.js";
import { Event, PrismaClient } from "@prisma/client";
import ethers from "ethers";
import { QueryParams } from "../types/DatabaseTypes.js";
import CONTRACT from "../contracts.js";
import { getMerkleTreeRoot, sendDataToIPFS } from "../utils/sendDataToIpfs.js";

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

export const writeHoldersToBatch = async (
  queries: QueryParams[],
  contractAddress
) => {
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
    const tx = contract.connect(signer).addBatch(merkleRoot, cid, { value: 0 });
    return { batchId, success: true };
  } catch (err) {
    logError("function/addBatch", "writeHoldersToBatch", { err });
    return { success: false };
  }
};

const prisma = new PrismaClient();

async function addBatchToDb(
  data: Array<CsvRowWithMessageId>,
  batchId: string,
  contractAddress: string,
  event: Event,
  mailSentTimestamp: number
) {
  // write data
  const insertData = data.map((entry: CsvRowWithMessageId) => {
    const firstEntryDate = new Date(
      stringToNumberTimestamp(entry.firstAllowedEntryDate)
    );
    const firstEntryDateTimestamp = getTimestamp(firstEntryDate);
    const lastEntryDate = new Date(
      stringToNumberTimestamp(entry.lastAllowedEntryDate)
    );
    const lastEntryDateTimestamp = getTimestamp(lastEntryDate);
    const maxDaysEntry = getDaysBetweenIncludingLastDate(
      lastEntryDate,
      firstEntryDate
    );
    return {
      firstname: entry.firstName,
      lastname: entry.lastName,
      email: entry.emailId,
      batchId: batchId,
      ticketId: entry.ticketId,
      mailsent: true,
      mailsentTimestamp: mailSentTimestamp,
      messageId: entry.messageId,
      daysEntered: 0,
      maxDaysEntry: maxDaysEntry,
      contractAddress: contractAddress.toString(),
      firstAllowedEntryDate: firstEntryDateTimestamp,
      lastAllowedEntryDate: lastEntryDateTimestamp,
      event: {
        connect: { eventId: event.eventId },
      },
    };
  });
  try {
    const storedValues = insertData.map(async (data) => {
      console.log({ data });
      const storedData = await prisma.holder.create({
        data: {
          firstname: data.firstname,
          lastname: data.lastname,
          email: data.email,
          ticketId: data.ticketId,
          batchId: batchId,
          mailsent: true,
          mailsentTimestamp: mailSentTimestamp,
          messageId: data.messageId,
          daysEntered: 0,
          maxDaysEntry: data.maxDaysEntry,
          firstAllowedEntryDate: data.firstAllowedEntryDate,
          lastAllowedEntryDate: data.lastAllowedEntryDate,
          event: {
            connect: { id: event.id },
          },
        },
      });
      return storedData;
    });
    log("addBatch.mutation", "addBatchToDb", "Stored Values: ", storedValues);
    if (storedValues.length === insertData.length) {
      return { storedValues, success: true };
    } else {
      return { storedValues: null, success: false };
    }
  } catch (e) {
    logError("addBatch.mutation", "addBatchToDb", "Error at adding new batch");
    logError("addBatch.mutation", "addBatchToDb", "Input data:", insertData);
    logError("addBatch.mutation", "addBatchToDb", "Error", e);
    return { storedValues: null, success: false };
  }
}

export async function addBatch(body: AddBatchRequestBody) {
  const mailSentOn = Math.ceil(Date.now() / 1000);
  const { areMailsSent, messageIds } = await sendClaimableEmail(
    body.inputParams,
    body.batchId.toString(),
    body.event.eventname,
    body.event.baseClaimUrl,
    body.event.emailTemplate
  );
  // let areMailsSent = 1;

  // check if mail sent and perform logic accordingly
  if (messageIds === undefined || areMailsSent === -1) {
    logError("addBatch", "addBatch", "failed to send mails");
    const response: ResponseData<AddBatchResponseData> = {
      success: false,
      data: {
        usersAdded: 0,
        message: `Failed to send some mails`,
      },
    };
    return -1;
  } else {
    // store in db
    const dataToBeStored = body.inputParams.map((entry, i) => ({
      messageId: messageIds[i].MessageId,
      ...entry,
    }));
    log("addBatch", "addBatch.elseBlock", dataToBeStored);
    const dbStoreResponse = await addBatchToDb(
      dataToBeStored,
      body.batchId.toString(),
      body.contractAddress.toString(),
      body.event,
      mailSentOn
    );

    log("addBatch", "addBatch fn", { response: dbStoreResponse.storedValues });
  }
}
