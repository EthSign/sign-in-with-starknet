import {
  json,
  Contract,
  WeierstrassSignatureType,
  typedData,
  TypedData,
  shortString,
  RpcProvider,
  constants,
  Account,
} from "starknet";
import fs from "fs";
import "dotenv/config";

interface SigningResults {
  address: string;
  message: TypedData;
  signature: WeierstrassSignatureType;
}

const types = {
  StarkNetDomain: [
    { name: "name", type: "shortstring" },
    { name: "version", type: "shortstring" },
    { name: "chainId", type: "shortstring" },
    { name: "revision", type: "shortstring" },
  ],
  SIWS: [
    { name: "address", type: "ContractAddress" },
    { name: "statement", type: "string" },
    { name: "uri", type: "string" },
    { name: "nonce", type: "string" },
    { name: "issuedAt", type: "timestamp" },
    { name: "expiresAt", type: "timestamp" },
  ],
};

const provider = new RpcProvider({
  nodeUrl: process.env.RPC_URL!,
  chainId: constants.StarknetChainId.SN_MAIN,
});

async function sign(): Promise<SigningResults> {
  const accountAddress = process.env.ACCOUNT_ADDRESS!;
  const privateKey = process.env.ACCOUNT_PRIVATE_KEY!;
  const account = new Account(provider, accountAddress, privateKey);
  const typedDataToSign: TypedData = {
    types: types,
    primaryType: "SIWS",
    domain: {
      name: "EthSign",
      version: "1",
      chainId: shortString.encodeShortString("SN_MAIN"),
      revision: "1",
    },
    message: {
      address: accountAddress,
      statement: "EthSign is signing you in.",
      uri: "https://ethsign.xyz",
      nonce: (Math.random() + 1).toString(36).substring(7),
      issuedAt: `${Math.floor(Date.now() / 1000)}`,
      expiresAt: "0",
    },
  };
  // This is offchain
  const signature = (await account.signMessage(
    typedDataToSign
  )) as WeierstrassSignatureType;
  return {
    address: accountAddress,
    message: typedDataToSign,
    signature: signature,
  };
}

async function verify(
  address: string,
  message: TypedData,
  signature: WeierstrassSignatureType
): Promise<boolean> {
  const compiledAccount = json.parse(
    fs.readFileSync("./ArgentAccount.json").toString("ascii")
  );
  const contractAccount = new Contract(compiledAccount.abi, address, provider);
  const typedDataHash = typedData.getMessageHash(message, address);
  // Cryptographic verification
  const results = await contractAccount.isValidSignature(typedDataHash, [
    signature.r,
    signature.s,
  ]);
  // Perform additional data validation here (not shown)
  // For example, if the message has expired

  // Return results
  return results.isValid === 1n;
}

async function main() {
  const signingResults = await sign();
  console.log("Signing results:", signingResults);
  const verificationResults = await verify(
    signingResults.address,
    signingResults.message,
    signingResults.signature
  );
  console.log(`Verification ${verificationResults ? "successful" : "failed"}.`);
}

main();
