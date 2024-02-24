import { PrismaClient } from "@prisma/client";
import { log, logError } from "../../utils/logger.utils.js";
import writeHoldersToBatch from "../../functions/writeHoldersToBatch.js";
import addBatch from "../../functions/addBatch.js";

const prisma = new PrismaClient();

const uploadGuestList = async (req, res) => {
  console.log("Got body:", req.body);
  // @ts-ignore
  const csv = req.file.buffer.toString("utf8");
  const guestList = csv
    .split("\r\n")
    .splice(1)
    .map((guest) => {
      return guest.split(",").splice(0, 3);
    });

  const { eventId } = req.body;
  const event = await prisma.event.findFirst({ where: { eventId } });

  const holders = await prisma.holder.findMany({
    where: { eventId: event.id },
  });

  if (holders.length < guestList.length) {
    try {
      const guestListFormatted = guestList.filter((guest) => {
        const ticketID = guest[0];
        const ind = holders.findIndex((holder) => ticketID === holder.ticketId);

        log("app", "uploadFile", { guest, ind: ind });
        return ind < 0;
      });
      log("App", "uploadfile", { guestList, guestListFormatted, holders });

      const guests = guestListFormatted.map((guest) => {
        const guestNames = guest[1].split(" ");

        return {
          firstName: guestNames[0],
          lastName: guestNames[guestNames.length - 1],
          emailId: guest[2],
          eventName: event.eventname,
          ticketId: guest[0],
        };
      });
      if (guestListFormatted.length) {
        const web3response = await writeHoldersToBatch(
          guests,
          event.contractAddress
        );

        if (web3response.success) {
          console.log({ web3response, guests });
          
          const inputParams = guests.map((guest) => {
            const { firstName, lastName, emailId, ticketId } = guest;

            return {
              firstName,
              lastName,
              emailId,
              firstAllowedEntryDate: event.firstAllowedEntryDate,
              lastAllowedEntryDate: event.lastAllowedEntryDate,
              ticketId,
            };
          });
          addBatch({
            event,
            batchId: web3response.batchId,
            addBatchTimestamp: Date.now(),
            contractAddress: event.contractAddress,
            inputParams,
          });
          res.json({
            message: `${guestListFormatted.length} guests added and sent email!`,
            guests,
          });
        } else {
          res.sendStatus(500).json({
            message: "Error... Something Went Wrong in contract Interaction",
            error: web3response.message,
          });
        }
      } else {
        res.sendStatus(500).json({ message: "Error... Something Went Wrong" });
      }
    } catch (err) {
      logError("uploadFile", "body", err);
    }
  } else
    res.send({
      message: "All Guests already invited",
      guestList,
      holders,
    });
};

export default uploadGuestList;
