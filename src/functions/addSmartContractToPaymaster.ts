import axios from "axios";
import { log, logError } from "../utils/logger.utils.js";

export default async function addSmartContractToPaymaster(
  name: string,
  address: string,
  abi: any,
  whitelistedMethods: string[]
) {
  const string_abi = JSON.stringify(abi);

  const AUTH_TOKEN = process.env.BICONOMY_AUTH_TOKEN;
  const API_KEY = process.env.BICONOMY_DAPP_API_KEY;

  const formattedName = name.replace(/[^a-zA-Z0-9\s]/g, "");
  console.log({ formattedName });

  const endpoint =
    "https://paymaster-dashboard-backend.prod.biconomy.io/api/v2/public/sdk/smart-contract";

  const headers = {
    apiKey: API_KEY,
    authToken: AUTH_TOKEN,
  };

  const data = {
    name: formattedName,
    address,
    abi: string_abi,
    whitelistedMethods,
  };

  try {
    const response = await axios.post(endpoint, data, { headers });

    log(
      "functions/addSmartContractToPaymaster",
      "index",
      response.data.message,
      { statusCode: response.data.statusCode }
    );

    return { success: true, res: response.data };
  } catch (err) {
    logError(
      "functions/addSmartContractToPaymaster",
      "index",
      "Error on Adding Smart Contract",
      { res: err.response.data }
    );
  }
}
