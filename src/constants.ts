const toBool = (value: string | undefined): boolean => {
  if (value === "true") {
    return true;
  } else {
    return false;
  }
};

export const TEST_NETWORK = toBool(process.env.TEST_NETWORK);

export const getRpcUrl = (test: boolean, ALCHEMY_KEY: string): string => {
  if (test) return `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_KEY}`;
  else return `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
};
