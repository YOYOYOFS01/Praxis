// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  PraxisDeferredEscrow
 * @notice Optional stretch contract — deferred payment escrow for agent transactions.
 *
 *         Flow:
 *           1. deposit(token, amount)
 *              Buyer (or agent wallet) deposits tokens into escrow.
 *
 *           2. lockIntent(proofHash, payer, payee, token, amount)
 *              Owner reserves deposited funds for a specific payment intent,
 *              identified by its Proof-of-Reasoning hash.
 *
 *           3a. settle(proofHash)
 *               Owner releases reserved funds to the payee after service delivery.
 *               Also calls PraxisPaymentRegistry.recordPayment to anchor on-chain.
 *
 *           3b. refund(proofHash)
 *               Owner returns reserved funds to the payer if settlement fails.
 *
 *         Security model:
 *           - Only the authorised backend signer (owner) can lock, settle, or refund
 *           - Each proofHash can only be locked once (replay protection)
 *           - Funds can only flow to the pre-locked payee, never elsewhere
 *           - Deposit → lock → settle/refund is strictly enforced in order
 *           - No reentrancy risk: state updated before external calls
 *
 * @dev    Build this ONLY after PraxisPaymentRegistry and the full mock demo are stable.
 *         The registry is required for the MVP; this is a stretch goal.
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IPraxisRegistry {
    function recordPayment(
        string  calldata runId,
        bytes32          proofHash,
        address          payer,
        address          payee,
        address          token,
        uint256          amount,
        string  calldata chainId
    ) external;
}

contract PraxisDeferredEscrow {

    // ── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public pendingOwner;

    /// Address of the PraxisPaymentRegistry — set once at deploy, immutable
    address public immutable registry;

    /// CAIP-2 chain id stored in registry records
    string  public chainId;

    enum IntentStatus { None, Locked, Settled, Refunded }

    struct Intent {
        bytes32      proofHash;
        string       runId;
        address      payer;
        address      payee;
        address      token;
        uint256      amount;
        IntentStatus status;
        uint256      lockedAt;
    }

    /// proofHash → intent
    mapping(bytes32 => Intent) public intents;

    /// payer → token → available (unlocked) balance
    mapping(address => mapping(address => uint256)) public deposits;

    // ── Events ───────────────────────────────────────────────────────────────

    event Deposited(
        address indexed payer,
        address indexed token,
        uint256         amount
    );

    event IntentLocked(
        bytes32 indexed proofHash,
        string          runId,
        address indexed payee,
        address indexed payer,
        uint256         amount
    );

    event Settled(
        bytes32 indexed proofHash,
        address indexed payee,
        uint256         amount
    );

    event Refunded(
        bytes32 indexed proofHash,
        address indexed payer,
        uint256         amount
    );

    event OwnershipTransferInitiated(address indexed newOwner);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    // ── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param _registry Address of the deployed PraxisPaymentRegistry contract
     * @param _chainId  CAIP-2 chain identifier e.g. "eip155:84532"
     */
    constructor(address _registry, string memory _chainId) {
        require(_registry != address(0), "ZERO_REGISTRY");
        require(bytes(_chainId).length > 0, "EMPTY_CHAIN_ID");
        owner    = msg.sender;
        registry = _registry;
        chainId  = _chainId;
    }

    // ── Step 1: Deposit ───────────────────────────────────────────────────────

    /**
     * @notice Deposit ERC-20 tokens into escrow.
     * @dev    Caller must have approved this contract to spend `amount` of `token`.
     */
    function deposit(address token, uint256 amount) external {
        require(token  != address(0), "ZERO_TOKEN");
        require(amount > 0,           "ZERO_AMOUNT");

        bool ok = IERC20(token).transferFrom(msg.sender, address(this), amount);
        require(ok, "TRANSFER_FAILED");

        deposits[msg.sender][token] += amount;
        emit Deposited(msg.sender, token, amount);
    }

    // ── Step 2: Lock intent ───────────────────────────────────────────────────

    /**
     * @notice Reserve deposited funds for a specific payment intent.
     * @dev    Caller must be the owner (backend signer). Can only be called once per proofHash.
     */
    function lockIntent(
        bytes32          proofHash,
        string  calldata runId,
        address          payer,
        address          payee,
        address          token,
        uint256          amount
    ) external onlyOwner {
        require(proofHash != bytes32(0),              "INVALID_PROOF");
        require(bytes(runId).length > 0,              "INVALID_RUN_ID");
        require(payee != address(0),                  "INVALID_PAYEE");
        require(amount > 0,                           "INVALID_AMOUNT");
        require(intents[proofHash].status == IntentStatus.None, "ALREADY_LOCKED");
        require(deposits[payer][token] >= amount,     "INSUFFICIENT_DEPOSIT");

        // Reduce available balance
        deposits[payer][token] -= amount;

        intents[proofHash] = Intent({
            proofHash: proofHash,
            runId:     runId,
            payer:     payer,
            payee:     payee,
            token:     token,
            amount:    amount,
            status:    IntentStatus.Locked,
            lockedAt:  block.timestamp
        });

        emit IntentLocked(proofHash, runId, payee, payer, amount);
    }

    // ── Step 3a: Settle ───────────────────────────────────────────────────────

    /**
     * @notice Release locked funds to the payee after service delivery.
     *         Also anchors the payment in PraxisPaymentRegistry.
     */
    function settle(bytes32 proofHash) external onlyOwner {
        Intent storage intent = intents[proofHash];
        require(intent.status == IntentStatus.Locked, "NOT_LOCKED");

        // Update state BEFORE external calls (checks-effects-interactions)
        intent.status = IntentStatus.Settled;

        // Transfer to payee
        bool ok = IERC20(intent.token).transfer(intent.payee, intent.amount);
        require(ok, "TRANSFER_FAILED");

        // Anchor in registry — non-blocking (if registry call fails, revert entire tx)
        IPraxisRegistry(registry).recordPayment(
            intent.runId,
            intent.proofHash,
            intent.payer,
            intent.payee,
            intent.token,
            intent.amount,
            chainId
        );

        emit Settled(proofHash, intent.payee, intent.amount);
    }

    // ── Step 3b: Refund ───────────────────────────────────────────────────────

    /**
     * @notice Return locked funds to the payer if settlement fails or is cancelled.
     */
    function refund(bytes32 proofHash) external onlyOwner {
        Intent storage intent = intents[proofHash];
        require(intent.status == IntentStatus.Locked, "NOT_LOCKED");

        // Update state BEFORE external calls
        intent.status = IntentStatus.Refunded;

        // Return to payer's available balance (not directly transferred — payer must withdraw)
        deposits[intent.payer][intent.token] += intent.amount;

        emit Refunded(proofHash, intent.payer, intent.amount);
    }

    // ── Withdraw (available balance) ─────────────────────────────────────────

    /**
     * @notice Withdraw available (not locked) deposited tokens.
     */
    function withdraw(address token, uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        require(deposits[msg.sender][token] >= amount, "INSUFFICIENT_BALANCE");

        deposits[msg.sender][token] -= amount;

        bool ok = IERC20(token).transfer(msg.sender, amount);
        require(ok, "TRANSFER_FAILED");
    }

    // ── Batch settle ─────────────────────────────────────────────────────────

    /**
     * @notice Settle multiple intents in one transaction (gas optimisation).
     * @dev    Any single failure reverts the entire batch.
     */
    function batchSettle(bytes32[] calldata proofHashes) external onlyOwner {
        for (uint256 i = 0; i < proofHashes.length; i++) {
            Intent storage intent = intents[proofHashes[i]];
            require(intent.status == IntentStatus.Locked, "NOT_LOCKED");

            intent.status = IntentStatus.Settled;

            bool ok = IERC20(intent.token).transfer(intent.payee, intent.amount);
            require(ok, "TRANSFER_FAILED");

            IPraxisRegistry(registry).recordPayment(
                intent.runId,
                intent.proofHash,
                intent.payer,
                intent.payee,
                intent.token,
                intent.amount,
                chainId
            );

            emit Settled(proofHashes[i], intent.payee, intent.amount);
        }
    }

    // ── Read helpers ──────────────────────────────────────────────────────────

    function getIntent(bytes32 proofHash)
        external view returns (Intent memory)
    {
        return intents[proofHash];
    }

    function getBalance(address payer, address token)
        external view returns (uint256)
    {
        return deposits[payer][token];
    }

    // ── Ownership ─────────────────────────────────────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_ADDRESS");
        pendingOwner = newOwner;
        emit OwnershipTransferInitiated(newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "NOT_PENDING_OWNER");
        emit OwnershipTransferred(owner, pendingOwner);
        owner        = pendingOwner;
        pendingOwner = address(0);
    }

    // ── Safety: reject plain ETH transfers ────────────────────────────────────

    receive()  external payable { revert("NO_ETH_ACCEPTED"); }
    fallback() external payable { revert("NO_ETH_ACCEPTED"); }
}
