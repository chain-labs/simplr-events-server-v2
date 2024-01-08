import ethers from "ethers";
import { AddBatchRequestBody, AddBatchResponseData, QueryParams, ResponseData } from "../types/DatabaseTypes.js";
import CONTRACT from "../contracts.js";
import { getMerkleTreeRoot, sendDataToIPFS } from "../utils/sendDataToIpfs.js";
import { log, logError } from "../utils/logger.utils.js";
import addBatchToDb from "./addBatchToDb.js";
import { sendClaimableEmail } from "../utils/sendEmail.js";

const { ALCHEMY_KEY, CONTRACT_ADDRESS, MINTER_PRIVATE_KEY } = process.env;

async function addBatch(body: AddBatchRequestBody) {
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

export default addBatch;
