import axios from "axios";
import { createYoga } from "graphql-yoga";
import express from "express";
import bodyParser from "body-parser";

import schema from "./schema.js";
import { createContext } from "./context.js";

import Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";
import dotenv from "dotenv";

const app = express();
const yoga = createYoga({ schema, context: createContext });

dotenv.config();

app.use(yoga.graphqlEndpoint, yoga);
app.use(bodyParser.urlencoded({ extended: true }));

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

app.post("/api/webhook", async (req, res) => {
  console.log("Webhook sent");
  if (req.method === "POST") {
    console.log({ req: req.body });
    const order_url = req.body.api_url;
    // Sentry.captureMessage("WEbhook REceived");

    const order = await axios.get(order_url, {
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_EVENTBRITE_OAUTH}`,
      },
    });

    console.log({ order });
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

const PORT = process.env.PORT;

// Start the server and you're done!
app.listen(PORT, () => {
  console.info(`Server is running on http://localhost:${PORT}/graphql`);
});

export default app;
