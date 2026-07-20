export const REGISTRY_ABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "string",  name: "runId",     type: "string"  },
      { indexed: true,  internalType: "bytes32", name: "proofHash", type: "bytes32" },
      { indexed: true,  internalType: "address", name: "payee",     type: "address" },
      { indexed: false, internalType: "address", name: "payer",     type: "address" },
      { indexed: false, internalType: "address", name: "token",     type: "address" },
      { indexed: false, internalType: "uint256", name: "amount",    type: "uint256" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    name: "PraxisPaymentRecorded",
    type: "event",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "proofHash", type: "bytes32" },
    ],
    name: "isRecorded",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string",  name: "runId",     type: "string"  },
      { internalType: "bytes32", name: "proofHash", type: "bytes32" },
      { internalType: "address", name: "payer",     type: "address" },
      { internalType: "address", name: "payee",     type: "address" },
      { internalType: "address", name: "token",     type: "address" },
      { internalType: "uint256", name: "amount",    type: "uint256" },
    ],
    name: "recordPayment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "proofHash", type: "bytes32" },
    ],
    name: "records",
    outputs: [
      { internalType: "string",  name: "runId",     type: "string"  },
      { internalType: "bytes32", name: "proofHash", type: "bytes32" },
      { internalType: "address", name: "payer",     type: "address" },
      { internalType: "address", name: "payee",     type: "address" },
      { internalType: "address", name: "token",     type: "address" },
      { internalType: "uint256", name: "amount",    type: "uint256" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "newOwner", type: "address" },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
