import axios from "axios";
import { ethers } from "ethers";
import { keccak256 } from "ethers/lib/utils.js";
import { MerkleTree } from "merkletreejs";

export const PINATA_URL = "https://api.pinata.cloud/";

const { PINATA_KEY, PINATA_KEY_SECRET } = process.env;

export const sendDataToIPFS = async (hashedData) => {
  const data = JSON.stringify(hashedData);
  console.log(data);

  const cid = await axios
    .post(`${PINATA_URL}pinning/pinJSONToIPFS`, data, {
      headers: {
        pinata_api_key: PINATA_KEY,
        pinata_secret_api_key: PINATA_KEY_SECRET,
      },
    })
    .then(function (response) {
      console.log("Hash:", response.data.IpfsHash);
      return response.data.IpfsHash;
    })
    .catch(function (error) {
      console.log(error);
    });
  return cid;
};

export const getMerkleTreeRoot = async (hashes) => {
  const leafs = hashes.map((entry) => ethers.utils.keccak256(entry));
  console.log({ leafs });

  const tree = new MerkleTree(leafs, keccak256, { sortPairs: true });

  const MerkleRoot = tree.getHexRoot();
  return MerkleRoot;
};
