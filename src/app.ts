import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { createYoga } from "graphql-yoga";
import express from "express";
import bodyParser from "body-parser";

import schema from "./schema.js";
import { createContext } from "./context.js";

import Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";
import dotenv from "dotenv";
import { addBatch, writeSingleUserToBatch } from "./routes/addBatch.js";
import { log } from "./utils/logger.utils.js";

const app = express();
const yoga = createYoga({ schema, context: createContext });

dotenv.config();

app.use(yoga.graphqlEndpoint, yoga);
app.use(bodyParser.urlencoded({ extended: true }));

const prisma = new PrismaClient();

Sentry.init({
  dsn: "https://cd6298599b4ed906e40f0a21179df3b9@o4505385751019520.ingest.sentry.io/4506315784781824",
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

// Create a Yoga instance with a GraphQL schema.

app.get("/", (req, res) => {
  Sentry.captureMessage(`Hello World`);
  res.send("Hello World!!");
});

app.post("/post-test", (req, res) => {
  console.log("Got body:", req.body);
  res.sendStatus(200);
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
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_EVENTBRITE_OAUTH}`,
        },
      });

      console.log(
        `Order Placed by ${order.data.first_name} ${
          order.data.last_name
        } with email ${order.data.email} at ${new Date(order.data.created)}.`
      );
      const { first_name, last_name, email } = order.data;
      const { EVENT_NAME, CONTRACT_ADDRESS, FIRST_ENTRY, LAST_ENTRY } =
        process.env;

      // Interact with Smart Contract to Add Batch to it
      const web3response = await writeSingleUserToBatch({
        firstName: first_name,
        lastName: last_name,
        emailId: email,
        eventName: EVENT_NAME,
      });

      log("app.ts", "/api/webhook handler", { web3response });

      // Add the batch holder to DB after sending an email

      if (web3response.success) {
        addBatch({
          eventName: EVENT_NAME,
          batchId: web3response.batchId,
          addBatchTimestamp: Date.now(),
          contractAddress: CONTRACT_ADDRESS,
          inputParams: [
            {
              firstName: first_name,
              lastName: last_name,
              email,
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
