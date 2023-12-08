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

const { EVENT_NAME, CONTRACT_ADDRESS, FIRST_ENTRY, LAST_ENTRY } = process.env;

Sentry.init({
  dsn: "https://0dbfee09b84de709b93feab9ea2fa9b7@o4506185897476096.ingest.sentry.io/4506357791129600",
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
  const csv = req.file.buffer.toString("utf8");
  const guestList = csv
    .split("\r\n")
    .splice(1)
    .map((guest) => {
      return guest.split(",").splice(0, 3);
    });

  const { eventId } = req.body;
  const event = await prisma.event.findFirst({ where: { eventId } });

  const holders = await prisma.holder.count({ where: { eventId: event.id } });

  if (holders !== guestList.length) {
    const guestListFormatted = guestList.splice(0, guestList.length - holders);
    const guests = guestListFormatted.map((guest) => {
      const guestNames = guest[1].split(" ");

      return {
        firstName: guestNames[0],
        lastName: guestNames[guestNames.length - 1],
        emailId: guest[2],
        eventName: event.eventname,
      };
    });
    const web3response = await writeHoldersToBatch(
      guests,
      event.contractAddress
    );

    if (web3response.success) {
      console.log({ web3response, guests });
      const inputParams = guests.map((guest) => {
        const { firstName, lastName, emailId } = guest;

        return {
          firstName,
          lastName,
          emailId,
          firstAllowedEntryDate: event.firstAllowedEntryDate,
          lastAllowedEntryDate: event.lastAllowedEntryDate,
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
      res.sendStatus(500).json({ message: "Error... Something Went Wrong" });
    }
  } else
    res.send({
      message: "All Guests already invited",
    });
});

app.get("/admin", (req, res) => {
  console.log("Rendering admin");
  res.render("pages/admin");
});

app.get("/currentBatchId", async (req, res) => {
  res.send(200);
});

app.post("/api/webhook", async (req, res) => {
  if (req.method === "POST") {
    // Middleware to parse JSON request body
    express.json()(req, res, async () => {
      const order_url = req.body.api_url;

      const order = await axios.get(order_url, {
        headers: {
          Authorization: `Bearer ${process.env.EVENTBRITE_OAUTH}`,
        },
      });

      console.log(
        `Order Placed by ${order.data.first_name} ${
          order.data.last_name
        } with email ${order.data.email} at ${new Date(order.data.created)}.`
      );
      const { first_name, last_name, email, event_id } = order.data;

      const event = await prisma.event.findFirst({
        where: { eventId: event_id },
      });

      // Interact with Smart Contract to Add Batch to it
      const web3response = await writeSingleUserToBatch({
        firstName: first_name,
        lastName: last_name,
        emailId: email,
        eventName: event.eventname,
      });

      log("app.ts", "/api/webhook handler", { web3response });

      // Add the batch holder to DB after sending an email

      if (web3response.success) {
        addBatch({
          event: event,
          batchId: web3response.batchId,
          addBatchTimestamp: Date.now(),
          contractAddress: CONTRACT_ADDRESS,
          inputParams: [
            {
              firstName: first_name,
              lastName: last_name,
              emailId: email,
              firstAllowedEntryDate: FIRST_ENTRY,
              lastAllowedEntryDate: LAST_ENTRY,
            },
          ],
        });
        Sentry.captureMessage(
          `Order Placed by ${order.data.first_name} ${
            order.data.last_name
          } with email ${order.data.email} at ${new Date(order.data.created)}.`,
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
      } else {
        res.sendStatus(500).json({ message: "Error... Something Went Wrong" });
      }

      // Perform actions (e.g., create a user) here
    });

    // Perform actions (e.g., create a user) here
    res.status(200).json({ message: "User created successfully" });
  } else {
    res.status(405).end(); // Method Not Allowed
  }
});

app.post("/claimTicket", async (req, res) => {
  const body: ClaimTicketRequestBody = req.body;

  const claimDateTime = new Date(stringToNumberTimestamp(body.claimTimestamp));
  const claimTimestampInDbRange = getTimestamp(claimDateTime);

  try {
    const whereObj = {
      firstname: body.firstName,
      lastname: body.lastName,
      email: body.email,
      eventname: body.eventName,
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
      console.log("Here");
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

  const newEvent = await prisma.event.create({
    data: {
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
      evenbriteApiKey: platform === "EVENTBRITE" ? eventbrite_api_key : "",
    },
  });

  res.sendStatus(200).send("Event Created", baseUrl);
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
