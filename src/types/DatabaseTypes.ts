import { Admin, Holder, Event } from "@prisma/client";
import { BytesLike } from "ethers";
import { BigNumberish } from "ethers";

type Email = string;

export interface HolderRow {
  id: number;
  firstName: string;
  lastName: string;
  email: Email;
  batchId: BigNumberish;
  eventName: string;
  mailSent: boolean;
  mailSentTimestamp?: number;
  isClaimed: boolean;
  claimedTimestamp?: number;
  claimTrx?: BytesLike;
  isRedeemed: boolean; // ensure they can enter all three days
  redeemedTimestamp?: number;
  daysEntered?: number;
  maxDaysEntry?: number;
  messageId?: string;
  firstAllowedEntryDate: Date;
  lastAllowedEntryDate: Date;
  contractAddress?: BytesLike;
  tokenId?: BigNumberish;
  accountAddress?: BytesLike;
}

export interface CsvRow {
  firstName: string;
  lastName: string;
  emailId: string;
  firstAllowedEntryDate: string;
  lastAllowedEntryDate: string;
  ticketId?: string;
}

export interface CsvRowWithMessageId extends CsvRow {
  messageId: string | undefined;
}

export interface ResponseData<RequestSpecificResponseData> {
  success: boolean;
  data: RequestSpecificResponseData;
}

export interface AddBatchRequestBody {
  inputParams: Array<CsvRow>;
  batchId: BigNumberish;
  event: Event;
  contractAddress: BytesLike;
  addBatchTimestamp: number;
}

export interface AddBatchResponseData {
  usersAdded: number;
  message: string;
}

export interface QueryParams {
  firstName: string;
  lastName: string;
  emailId: string;
  batchId?: string;
  eventName: string;
}

export interface ClaimTicketRequestBody {
  email: string;
  firstName: string;
  lastName: string;
  eventName: string;
  contractAddress: string;
  accountAddress: string;
  tokenId: number;
  isSubscribed: boolean;
  claimTimestamp: string;
  claimTrx: BytesLike;
  batchId: number;
}

export interface ClaimTicketResponseData {
  message: string;
}

export interface VerifyTicketRequestBody {
  accountAddress: BytesLike;
  tokenId: number;
  contractAddress: BytesLike;
  redeemedTimestamp: string;
}

export interface VerifyTicketResponseData {
  isValid: boolean; // true - ticket is valid and the user can enter venue || false - ticket is invalid and user cannot enter venue
  message: string;
  eventDay: number | undefined; // day of event, first day of event, second day of event etc.
}

export interface GetClaimedTicketsRequestBody {
  startTimestamp?: number;
  endTimestamp?: number;
}

export interface GetClaimedTicketsResponseData {
  usersClaimedTicket: Array<HolderRow>;
  startTimestamp: number;
  endTimestamp: number;
  numberOfTicketsClaimed: number;
  message: string;
}

export interface GetRedeemedTicketsRequestBody {
  startTimestamp?: number;
  endTimestamp?: number;
}

export interface GetRedeemedTicketsResponseData {
  usersRedeemedTicket: Array<HolderRow>;
  startTimestamp: number;
  endTimestamp: number;
  numberOfTicketsRedeemed: number;
  message: string;
}
