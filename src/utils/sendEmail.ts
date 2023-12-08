import dotenv from "dotenv";
import {
  SESClient,
  SESClientConfig,
  SendBulkTemplatedEmailCommand,
  SendBulkTemplatedEmailCommandInput,
} from "@aws-sdk/client-ses";
import { CsvRow } from "../types/DatabaseTypes.js";
import { log, logError } from "./logger.utils.js";

const {
  AWS_ACCESS_KEY,
  AWS_SECRET_ACCESS_KEY,
  AWS_API_VERSION,
  AWS_REGION,
  AWS_SES_VERIFIED_MAIL,
} = process.env;

const generateClaimUrl = (
  email: string,
  lastName: string,
  firstName: string,
  batchId: string,
  eventName: string,
  claimBaseUrl: string
) => {
  log("sendEmail", "generateClaimUrl", "Generating Claim URL");
  const whitespaceRegExp = / /g;
  return `${claimBaseUrl}/claim?emailid=${email.replace(
    whitespaceRegExp,
    "%20"
  )}&lastname=${lastName.replace(
    whitespaceRegExp,
    "%20"
  )}&firstname=${firstName.replace(
    whitespaceRegExp,
    "%20"
  )}&batchid=${batchId.replace(
    whitespaceRegExp,
    "%20"
  )}&eventname=${eventName.replace(whitespaceRegExp, "%20")}`;
};

export async function sendClaimableEmail(
  receivers: Array<CsvRow>,
  batchId: string,
  eventName: string,
  claimBaseUrl: string,
  emailTemplate: string
) {
  try {
    log("sendEmail", "sendClaimableEmail", "Sending Claimable Emails");

    log("sendEmail", "sendClaimableEmail", "Build configuration");
    const configure: SESClientConfig = {
      credentials: {
        accessKeyId: AWS_ACCESS_KEY as string,
        secretAccessKey: AWS_SECRET_ACCESS_KEY as string,
      },
      apiVersion: AWS_API_VERSION,
      region: AWS_REGION,
    };

    log("sendEmail", "sendClaimableEmail", "Initialise SES client");
    const ses = new SESClient(configure);
    log("sendEmail", "sendClaimableEmail", { ses });

    log("sendEmail", "sendClaimableEmail", {
      msg: "Create array inputs of receivers",
      receivers,
    });

    const destinations = receivers.map((receiver) => ({
      Destination: {
        ToAddresses: [receiver.emailId],
      },
      ReplacementTemplateData: JSON.stringify({
        contact: { firstName: receiver.firstName },
        claim: {
          url: generateClaimUrl(
            receiver.emailId,
            receiver.lastName,
            receiver.firstName,
            batchId,
            eventName,
            claimBaseUrl
          ),
        },
        company: {
          instagram: "https://instagram.com/simplrhq",
          twitter: "https://twitter.com/simplrhq",
          linkedin: "https://www.linkedin.com/company/0xchainlabs/",
          youtube: "https://www.youtube.com/@simplr3479",
        },
      }),
    }));

    log("sendEmail", "sendClaimableEmail", "Create input for Bulk Send Email");
    const bulkSendInput: SendBulkTemplatedEmailCommandInput = {
      Destinations: destinations,
      Source: AWS_SES_VERIFIED_MAIL,
      Template: emailTemplate,
      DefaultTemplateData: JSON.stringify({ contact: { firstName: "Buddy" } }),
    };

    log("sendEmail", "sendClaimableEmail", "Generate bulk send command");
    const buldSendCommand = new SendBulkTemplatedEmailCommand(bulkSendInput);
    console.log({ buldSendCommand });
    log("sendEmail", "sendClaimableEmail", "Send bulk Email");
    const output = await ses.send(buldSendCommand);
    console.log({ output });
    if (output.$metadata.httpStatusCode === 200) {
      log("sendEmail", "sendClaimableEmail", "Request sent successfully");
      log(
        "sendEmail",
        "sendClaimableEmail",
        "Sorting out all the unsuccessful sends"
      );
      return { areMailsSent: 1, messageIds: output.Status };
    } else {
      log("sendEmail", "sendClaimableEmail", "Error while bulk sending Emails");
      log("sendEmail", "sendClaimableEmail", output);
      return { areMailsSent: -1, messageIds: undefined };
    }
  } catch (err) {
    console.log({ err });
    return { areMailsSent: -1, messageIds: undefined };
    logError("sendEmail", "sendClaimableEmail", { err });
  }
}
