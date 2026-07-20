// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  PraxisPaymentRegistry
 * @notice Immutable on-chain audit registry for autonomous agent payment decisions.
 *
 *         Each payment anchored here proves that:
 *           1. A Proof-of-Reasoning was produced (proofHash)
 *           2. Budget and policy guards approved the payment
 *           3. A payment firewall validated the intent
 *           4. The payment was executed and linked to this proof
 *
 *         Security model:
 *           - Only the authorised backend signer (owner) can record payments
 *           - A proofHash can never be recorded twice (replay protection)
 *           - Records are immutable — no update or delete functions exist
 *           - Ownership can be transferred to a multisig after deployment
 *
 * @dev    USDC amount is stored in base units (6 decimals).
 *         proofHash is the SHA-256 of the canonical Proof-of-Reasoning JSON,
 *         passed as bytes32 (first 32 bytes of the 32-byte hash).
 */
contract PraxisPaymentRegistry {

    // ── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public pendingOwner;     // two-step ownership transfer

    uint256 public totalRecorded;    // global counter for analytics

    struct PaymentRecord {
        string  runId;        // off-chain run identifier (cuid/uuid)
        bytes32 proofHash;    // SHA-256 of Proof-of-Reasoning JSON
        address payer;        // agent wallet that authorised the payment
        address payee;        // vendor receiving address
        address token;        // ERC-20 token address (USDC)
        uint256 amount;       // token base units (USDC = 6 decimals)
        uint256 timestamp;    // block.timestamp at anchor time
        string  chainId;      // CAIP-2 network id stored for cross-chain audits
    }

    /// proofHash → full record
    mapping(bytes32 => PaymentRecord) public records;

    /// proofHash → anchored flag (cheaper than checking records[h].timestamp > 0)
    mapping(bytes32 => bool) public recorded;

    /// runId (as bytes32 keccak hash) → proofHash, for reverse lookup
    mapping(bytes32 => bytes32) public runProof;

    // ── Events ───────────────────────────────────────────────────────────────

    event PraxisPaymentRecorded(
        string  indexed runId,
        bytes32 indexed proofHash,
        address indexed payee,
        address         payer,
        address         token,
        uint256         amount,
        uint256         timestamp
    );

    event OwnershipTransferInitiated(address indexed newOwner);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event OwnershipRenounced(address indexed previousOwner);

    // ── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ── Core: record a payment ────────────────────────────────────────────────

    /**
     * @notice Anchor an autonomous payment decision on-chain.
     * @dev    Callable only by the authorised backend signer (owner).
     *
     * @param runId     Off-chain run identifier string
     * @param proofHash bytes32 of SHA-256(canonical Proof-of-Reasoning JSON)
     * @param payer     Agent wallet address that authorised the payment
     * @param payee     Vendor receiving address
     * @param token     ERC-20 token contract address
     * @param amount    Payment amount in token base units (USDC: multiply USD by 1e6)
     * @param chainId   CAIP-2 chain identifier e.g. "eip155:84532"
     */
    function recordPayment(
        string  calldata runId,
        bytes32          proofHash,
        address          payer,
        address          payee,
        address          token,
        uint256          amount,
        string  calldata chainId
    ) external onlyOwner {
        // Input validation
        require(proofHash != bytes32(0),         "INVALID_PROOF_HASH");
        require(!recorded[proofHash],            "ALREADY_RECORDED");
        require(bytes(runId).length > 0,         "INVALID_RUN_ID");
        require(bytes(runId).length <= 128,      "RUN_ID_TOO_LONG");
        require(payee != address(0),             "INVALID_PAYEE");
        require(amount > 0,                      "INVALID_AMOUNT");
        require(bytes(chainId).length > 0,       "INVALID_CHAIN_ID");

        // Store record
        records[proofHash] = PaymentRecord({
            runId:     runId,
            proofHash: proofHash,
            payer:     payer,
            payee:     payee,
            token:     token,
            amount:    amount,
            timestamp: block.timestamp,
            chainId:   chainId
        });

        recorded[proofHash]                    = true;
        runProof[keccak256(bytes(runId))]      = proofHash;
        unchecked { totalRecorded++; }

        emit PraxisPaymentRecorded(
            runId,
            proofHash,
            payee,
            payer,
            token,
            amount,
            block.timestamp
        );
    }

    // ── Read helpers ──────────────────────────────────────────────────────────

    /// @notice Returns true if the given proofHash has been anchored.
    function isRecorded(bytes32 proofHash) external view returns (bool) {
        return recorded[proofHash];
    }

    /// @notice Returns the proofHash anchored for a given runId string.
    ///         Returns bytes32(0) if not found.
    function getProofHashByRunId(string calldata runId)
        external view returns (bytes32)
    {
        return runProof[keccak256(bytes(runId))];
    }

    /// @notice Returns the full PaymentRecord for a given proofHash.
    function getRecord(bytes32 proofHash)
        external view returns (PaymentRecord memory)
    {
        require(recorded[proofHash], "NOT_RECORDED");
        return records[proofHash];
    }

    // ── Ownership: two-step transfer ─────────────────────────────────────────

    /**
     * @notice Step 1: nominate a new owner. Does not transfer yet.
     * @dev    Transfer to a multisig after initial deployment.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_ADDRESS");
        require(newOwner != owner,      "SAME_OWNER");
        pendingOwner = newOwner;
        emit OwnershipTransferInitiated(newOwner);
    }

    /**
     * @notice Step 2: new owner accepts the transfer.
     */
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "NOT_PENDING_OWNER");
        emit OwnershipTransferred(owner, pendingOwner);
        owner        = pendingOwner;
        pendingOwner = address(0);
    }

    /**
     * @notice Permanently renounce ownership. USE WITH EXTREME CARE.
     *         After this, no new payments can ever be recorded.
     */
    function renounceOwnership() external onlyOwner {
        emit OwnershipRenounced(owner);
        owner        = address(0);
        pendingOwner = address(0);
    }
}
