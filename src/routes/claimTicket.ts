import { PrismaClient } from "@prisma/client";
import { ClaimTicketRequestBody } from "../types/DatabaseTypes.js";
import { getTimestamp, stringToNumberTimestamp } from "../utils/time.utils.js";
import { log } from "../utils/logger.utils.js";

const prisma = new PrismaClient();

const claimTicket = async (req, res) => {
  const body: ClaimTicketRequestBody = req.body;

  const claimDateTime = new Date(stringToNumberTimestamp(body.claimTimestamp));
  const claimTimestampInDbRange = getTimestamp(claimDateTime);

  try {
    const event = await prisma.event.findFirst({
      where: {
        eventname: body.eventName,
      },
    });
    const whereObj = {
      firstname: body.firstName,
      lastname: body.lastName,
      email: body.email,
      eventID: event.id,

      contractAddress: body.contractAddress,
      batchId: body.batchId.toString(),
    };

    const currentValues = await prisma.holder.findFirst({
      where: whereObj,
      select: { isClaimed: true, id: true },
    });
    console.log({ currentValues });
    if (currentValues.isClaimed !== undefined && currentValues.isClaimed) {
      res.sendStatus(404).send("Ticket already claimed");
    } else {
      const storedData = await prisma.holder.update({
        where: {
          id: currentValues.id,
        },
        data: {
          isClaimed: true,
          claimedTimestamp: claimTimestampInDbRange,
          claimTrx: body.claimTrx.toString(),
          tokenId: body.tokenId.toString(),
          accountAddress: body.accountAddress.toString(),
          isSubscribed: body.isSubscribed,
        },
      });
      log(
        "ClaimTicket.mutation",
        "claimTicketAtDb",
        "Claimed ticket and the stored value is:",
        { storedData }
      );

      if (!storedData.isClaimed) {
        res.sendStatus(404).send("Not Found Currrent Ticket");
      } else {
        res.sendStatus(200).send({ success: true, value: storedData });
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error({ err });
  }
};

export default claimTicket;
