import { createYoga } from "graphql-yoga";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import multer from "multer";
import Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";
import dotenv from "dotenv";

import schema from "./schema.js";
import { createContext } from "./context.js";
import uploadGuestList from "./routes/luma/uploadGuestList.js";
import eventbriteWebhook from "./routes/eventbrite/webhook.js";
import registerEvent from "./routes/registerEvent.js";
import claimTicket from "./routes/claimTicket.js";

const app = express();
const yoga = createYoga({ schema, context: createContext });
dotenv.config();
const upload = multer();

app.use(yoga.graphqlEndpoint, yoga);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());


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

app.get("/", (req, res) => {
  Sentry.captureMessage(`Hello World`);
  res.send("Hello World!!");
});
app.post("/uploadGuestList", upload.single("uploadCsv"), uploadGuestList);
app.post("/api/webhook", eventbriteWebhook);
app.post("/claimTicket", claimTicket);
app.post("/registerEvent", registerEvent);

// The error handler must be registered before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  res.end(res.sentry + "\n");
});

const { PORT } = process.env;

// Start the server and you're done!
app.listen(PORT, () => {
  console.info(`Server is running on http://localhost:${PORT}/graphql`);
});

export default app;
