import { Event, PrismaClient } from "@prisma/client";
import { CsvRowWithMessageId } from "../types/DatabaseTypes.js";
import { log, logError } from "../utils/logger.utils.js";
import {
  getDaysBetweenIncludingLastDate,
  getTimestamp,
  stringToNumberTimestamp,
} from "../utils/time.utils.js";

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

export default addBatchToDb;
