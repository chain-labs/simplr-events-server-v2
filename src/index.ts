import { createContext } from "./db/context";

const { PrismaClient } = require("@prisma/client");
const { createYoga } = require("graphql-yoga");
const { createServer } = require("node:http");
const { schema, context } = require("./db/schema");
const express = require("express");

const app = express();

// Create a Yoga instance with a GraphQL schema.
const yoga = createYoga({ schema, context: createContext });

app.use(yoga.graphqlEndpoint, yoga);

app.get("/", "Hello World!!");

// Pass it into a server to hook into request handlers.

// Start the server and you're done!
app.listen(4000, () => {
  console.info("Server is running on http://localhost:4000/graphql");
});
