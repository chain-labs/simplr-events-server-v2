import axios from "axios";
import express from "express";
import Sentry from "@sentry/node";
import { PrismaClient } from "@prisma/client";

import { writeSingleUserToBatch } from "../../functions/writeSingleUserToBatch.js";
import { log } from "../../utils/logger.utils.js";
import addBatch from "../../functions/addBatch.js";

const prisma = new PrismaClient();

const eventbriteWebhook = async (req, res) => {
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
};

export default eventbriteWebhook;
