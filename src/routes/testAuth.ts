import pinataSDK from "@pinata/sdk";

const { PINATA_KEY, PINATA_KEY_SECRET, PINATA_JWT } = process.env;

const testAuth = async (req, res) => {
  const pinata = new pinataSDK({ pinataJWTKey: PINATA_JWT });
  const response = await pinata.testAuthentication();

  console.log({ response });
  res.send(response);
};

export default testAuth;
