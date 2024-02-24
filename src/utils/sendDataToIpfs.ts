import axios from "axios";
import { ethers } from "ethers";
import { keccak256 } from "ethers/lib/utils.js";
import { MerkleTree } from "merkletreejs";

export const PINATA_URL = "https://api.pinata.cloud/";

const { PINATA_KEY, PINATA_KEY_SECRET, PINATA_JWT } = process.env;

export const sendDataToIPFS = async (hashedData) => {
  const data = { pinataContent: hashedData };
  const body = JSON.stringify(data);
  console.log({ body, hashedData });

  const cid = await axios
    .post(`${PINATA_URL}pinning/pinJSONToIPFS`, body, {
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": "application/json",
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
