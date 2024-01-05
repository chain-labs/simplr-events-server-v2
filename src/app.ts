import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { createYoga } from "graphql-yoga";
import express from "express";
import bodyParser from "body-parser";

import { Admin, Holder, Event } from "@prisma/client";

import schema from "./schema.js";
import { createContext } from "./context.js";
import cors from "cors";
import multer from "multer";

import Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";
import dotenv from "dotenv";
import {
  addBatch,
  writeHoldersToBatch,
  writeSingleUserToBatch,
} from "./routes/addBatch.js";
import { log } from "./utils/logger.utils.js";
import { ClaimTicketRequestBody } from "./types/DatabaseTypes.js";
import { getTimestamp, stringToNumberTimestamp } from "./utils/time.utils.js";

const app = express();
const yoga = createYoga({ schema, context: createContext });

dotenv.config();

app.use(yoga.graphqlEndpoint, yoga);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

const prisma = new PrismaClient();

const upload = multer();

const WEBHOOK_ENDPOINT = "http://events-api.simplrhq.com/api/webhook";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // enable Express.js middleware tracing
    new Sentry.Integrations.Express({ app }),
    new ProfilingIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0,
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});

// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());

// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());

app.use(express.json());

app.set("view engine", "ejs");

//Views

// Create a Yoga instance with a GraphQL schema.

app.get("/", (req, res) => {
  Sentry.captureMessage(`Hello World`);
  res.send("Hello World!!");
});

app.post("/uploadGuestList", upload.single("uploadCsv"), async (req, res) => {
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

  if (holders.length !== guestList.length) {
    const guestListFormatted = guestList.filter((guest) => {
      const ind = holders.findIndex((holder) => guest[0] === holder.ticketId);
      log("app", "uploadFile", { guest, ind: !!ind });
      return !!ind;
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
  } else
    res.send({
      message: "All Guests already invited",
      guestList,
      holders,
    });
});

app.get("/currentBatchId", async (req, res) => {
  res.send(200);
});

app.post("/api/webhook", async (req, res) => {
  if (req.method === "POST") {
    // Middleware to parse JSON request body
    express.json()(req, res, async () => {
      // Get Correct Event from webhook ID
      const webhookId = req.body.config.webhook_id;

      const event = await prisma.event.findFirst({
        where: { webhookId },
      });
      const order_url: string = req.body.api_url;

      const ticketId = order_url.slice(0, -1).split("orders/")[1];
      const existingHolder = await prisma.holder.count({
        where: { ticketId },
      });

      console.log({ ticketId, existingHolder });

      if (event && !existingHolder) {
        const eventbrite_api_key = event.eventbriteApiKey;

        const order = await axios.get(order_url, {
          headers: {
            Authorization: `Bearer ${eventbrite_api_key}`,
          },
        });

        console.log(
          `Order Placed by ${order.data.first_name} ${
            order.data.last_name
          } with email ${order.data.email} at ${new Date(order.data.created)}.`
        );
        const { first_name, last_name, email } = order.data;

        // Interact with Smart Contract to Add Batch to it
        const web3response = await writeSingleUserToBatch({
          firstName: first_name,
          lastName: last_name,
          emailId: email,
          eventName: event.eventname,
          contractAddress: event.contractAddress,
        });

        log("app.ts", "/api/webhook handler", { web3response });

        // Add the batch holder to DB after sending an email

        if (web3response.success) {
          addBatch({
            event: event,
            batchId: web3response.batchId,
            addBatchTimestamp: Date.now(),
            contractAddress: event.contractAddress,
            inputParams: [
              {
                firstName: first_name,
                lastName: last_name,
                emailId: email,
                firstAllowedEntryDate: event.firstAllowedEntryDate.toString(),
                lastAllowedEntryDate: event.lastAllowedEntryDate.toString(),
                ticketId,
              },
            ],
          });
          Sentry.captureMessage(
            `Order Placed by ${order.data.first_name} ${
              order.data.last_name
            } with email ${order.data.email} at ${new Date(
              order.data.created
            )}.`,
            {
              tags: {
                body: req.body,
                order: order.data,
              },
            }
          );
          res
            .sendStatus(200)
            .json({ message: `Batch created for email ${email}` });
        }
      } else {
        res.sendStatus(500).json({ message: "Error... Something Went Wrong" });
      }
    });
  } else {
    res.status(405).end(); // Method Not Allowed
  }
});

app.post("/claimTicket", async (req, res) => {
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
});

app.post("/registerEvent", async (req, res) => {
  const {
    eventname,
    eventId,
    platform,
    contractAddress,
    firstAllowedEntryDate,
    lastAllowedEntryDate,
    emailTemplate,
    baseClaimUrl,
    eventbrite_api_key,
  }: {
    eventname: string;
    eventId: string;
    platform: "EVENTBRITE" | "LUMA";
    contractAddress: string;
    firstAllowedEntryDate: string;
    lastAllowedEntryDate: string;
    emailTemplate: string;
    baseClaimUrl: string;
    eventbrite_api_key?: string;
  } = req.body;

  const baseUrl = baseClaimUrl.endsWith("/")
    ? baseClaimUrl.slice(0, baseClaimUrl.length - 1)
    : baseClaimUrl;

  const newData = {
    eventname: eventname,
    eventId: eventId,
    platform: platform,
    admin: {
      create: {
        username: `${eventname.toLowerCase().split(" ").join("-")}-admin`,
        password: `${eventname.toLowerCase().split(" ").join("-")}-pwd`,
      },
    },
    contractAddress,
    firstAllowedEntryDate: parseInt(firstAllowedEntryDate),
    lastAllowedEntryDate: parseInt(lastAllowedEntryDate),
    emailTemplate,
    baseClaimUrl,
    eventbriteApiKey: platform === "EVENTBRITE" ? eventbrite_api_key : "",
    webhookId: "",
  };

  if (platform === "EVENTBRITE") {
    // Fetch OrganizationId from evenbrite_api_key
    const organizationEndpoint = `https://www.eventbriteapi.com/v3/users/me/organizations/`;
    const { data: organization } = await axios.get(organizationEndpoint, {
      headers: {
        Authorization: `Bearer ${eventbrite_api_key}`,
      },
    });

    const orgId = organization.organizations[0].id;

    // Create Webhook using OrganizationId and eventbrite_api_key
    const webhookCreateEndpoint = `https://www.eventbriteapi.com/v3/organizations/${orgId}/webhooks/`;
    const headers = {
      Authorization: `Bearer ${eventbrite_api_key}`,
      "Content-Type": "application/json",
    };

    const body = {
      endpoint_url: WEBHOOK_ENDPOINT,
      actions: "order.placed,order.updated",
      event_id: eventId,
    };

    const { data: webhook } = await axios.post(webhookCreateEndpoint, body, {
      headers,
    });

    const webhookId = webhook.id;

    //Store WebhookID in dbData along with others
    newData.webhookId = webhookId;
  }

  const newEvent = await prisma.event.create({
    data: newData,
  });

  res.send({ msg: "Created Event", newEvent });
});

app.post("/uploadGuests", async (req, res) => {
  const body = req.body;
});

// The error handler must be registered before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  res.end(res.sentry + "\n");
});

// Pass it into a server to hook into request handlers.

const { PORT } = process.env;

// Start the server and you're done!
app.listen(PORT, () => {
  console.info(`Server is running on http://localhost:${PORT}/graphql`);
});

export default app;
