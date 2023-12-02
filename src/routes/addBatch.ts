import {
  AddBatchRequestBody,
  AddBatchResponseData,
  CsvRowWithMessageId,
  ResponseData,
} from "../types/DatabaseTypes";
import { log, logError } from "../utils/logger.utils.js";
import { sendClaimableEmail } from "../utils/sendEmail.js";
import {
  getDaysBetweenIncludingLastDate,
  getTimestamp,
  stringToNumberTimestamp,
} from "../utils/time.utils.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const requestBody: AddBatchRequestBody = {
  inputParams: [
    {
      firstName: "Mihirsinh",
      lastName: "Parmar",
      email: "mihirsinh@chainlabs.in",
      firstAllowedEntryDate: Date.now().toString(),
      lastAllowedEntryDate: Date.now().toString(),
    },
  ],
  batchId: 1,
  eventName: "Vivacity 2023",
  contractAddress: "0x",
  addBatchTimestamp: Date.now(),
};

async function addBatchToDb(
  data: Array<CsvRowWithMessageId>,
  batchId: string,
  contractAddress: String,
  eventName: string,
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
      email: entry.email,
      batchId: batchId,
      eventname: eventName,
      mailsent: true,
      mailsentTimestamp: mailSentTimestamp,
      messageId: entry.messageId,
      daysEntered: 0,
      maxDaysEntry: maxDaysEntry,
      contractAddress: contractAddress.toString(),
      firstAllowedEntryDate: firstEntryDateTimestamp,
      lastAllowedEntryDate: lastEntryDateTimestamp,
    };
  });
  try {
    const storedValues = insertData.map(async (data) => {
      console.log({ data });
      const storedData = await prisma.holder.create({
        data,
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
    body.eventName
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
      body.eventName,
      mailSentOn
    );
    log("addBatch", "addBatch fn", { response: dbStoreResponse.storedValues });
  }
}
