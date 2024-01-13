import { PrismaClient } from "@prisma/client";
import axios from "axios";
import addMinterRole from "../functions/addMinterRole.js";
import addSmartContractToPaymaster from "../functions/addSmartContractToPaymaster.js";
import CONTRACT from "../contracts.js";

const WEBHOOK_ENDPOINT = "http://events-api.simplrhq.com/api/webhook";

const prisma = new PrismaClient();

const registerEvent = async (req, res) => {
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

  //Add minter role
  const minterRoleResponse = await addMinterRole(contractAddress);

  if (!minterRoleResponse.success) {
    res.send({ code: 500, error: minterRoleResponse.err });
  }

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

  const biconomyWhitelistingResponse = await addSmartContractToPaymaster(
    eventname,
    contractAddress,
    CONTRACT.SimplrEvents.abi,
    ["mintTicket"]
  );

  if (biconomyWhitelistingResponse.success) {
    const newEvent = await prisma.event.create({
      data: newData,
    });

    res.send({ msg: "Created Event", newEvent });
  } else {
    res.send({
      msg: "Error while adding smart contract to paymaster. Try Again!",
      err: biconomyWhitelistingResponse.res,
    });
  }
};

export default registerEvent;
