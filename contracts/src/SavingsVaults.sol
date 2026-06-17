// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SavingsVaults — solo savings-lock (v1)
/// @notice Thin single-token escrow holding only its own funds. A vault locks the
/// owner's stablecoin (canonical cUSD; a mock on Anvil) until ONE of: the goal is
/// reached, the deadline passes, or enough keyholders approve an early exit
/// (solo = 1-of-N). Design + rationale in .private/CONTRACTS_PLAN.md.
contract SavingsVaults is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// The one canonical stablecoin, set once at deploy. The contract holds nothing else.
    IERC20 public immutable token;

    uint256 public constant MAX_KEYHOLDERS = 10;

    // Reasons for the Unlocked event. The deadline path has no transaction when the
    // clock crosses it, so it emits nothing — deadline-unlock is purely view-derived.
    uint8 public constant REASON_GOAL = 1;
    uint8 public constant REASON_APPROVAL = 2;

    struct Vault {
        address owner; // slot0: 160
        uint64 deadline; // slot0: +64  (unix; always > creation time)
        bool closed; // slot0: +8
        uint256 goal; // slot1
        uint256 saved; // slot2
        uint32 approvals; // slot3: distinct keyholder approvals so far
        uint32 threshold; // slot3: approvals needed to early-unlock (solo = 1)
    }

    mapping(uint256 => Vault) private vaults;
    mapping(uint256 => mapping(address => bool)) public isKeyholder;
    mapping(uint256 => mapping(address => bool)) public hasApproved;
    mapping(uint256 => address[]) private keyholderList;
    mapping(address => uint256[]) private ownerVaults;

    uint256 public nextId = 1; // start at 1 so id 0 cleanly means "none"

    event VaultCreated(address indexed owner, uint256 indexed id, uint256 goal, uint64 deadline);
    event KeyholderAdded(uint256 indexed id, address indexed keyholder);
    event Deposited(uint256 indexed id, address from, uint256 amount, uint256 newSaved);
    event EarlyApprovalGiven(uint256 indexed id, address indexed keyholder, uint32 approvals);
    event Unlocked(uint256 indexed id, uint8 reason);
    event Withdrawn(uint256 indexed id, address to, uint256 amount);

    constructor(IERC20 _token) {
        token = _token;
    }

    /// @notice Create a solo vault (unfunded). Fund it later via deposit().
    function createVault(uint256 goal, uint64 deadline, address[] calldata keyholders)
        external
        returns (uint256 id)
    {
        return _createVault(goal, deadline, keyholders);
    }

    /// @notice Create a solo vault AND fund it with `initialDeposit` in one tx (the
    /// owner must approve `initialDeposit` first). Lets the client open a funded
    /// vault without a separate deposit transaction. `initialDeposit` may be 0.
    function createVault(
        uint256 goal,
        uint64 deadline,
        address[] calldata keyholders,
        uint256 initialDeposit
    ) external nonReentrant returns (uint256 id) {
        id = _createVault(goal, deadline, keyholders);
        if (initialDeposit > 0) {
            _deposit(id, initialDeposit);
        }
    }

    function _createVault(uint256 goal, uint64 deadline, address[] calldata keyholders)
        internal
        returns (uint256 id)
    {
        require(goal > 0, "goal=0");
        require(deadline > block.timestamp, "deadline<=now"); // liveness: always a backstop
        require(keyholders.length <= MAX_KEYHOLDERS, "too many keyholders");

        id = nextId++;
        Vault storage v = vaults[id];
        v.owner = msg.sender;
        v.deadline = deadline;
        v.goal = goal;
        v.threshold = 1; // solo: any one designated unlocker (1-of-N)

        for (uint256 i = 0; i < keyholders.length; i++) {
            address k = keyholders[i];
            require(k != address(0), "keyholder=0");
            require(k != msg.sender, "owner!=keyholder"); // else owner could self-approve past the lock
            require(!isKeyholder[id][k], "dup keyholder"); // dedup (protects the v2 majority threshold)
            isKeyholder[id][k] = true;
            keyholderList[id].push(k);
            emit KeyholderAdded(id, k);
        }

        ownerVaults[msg.sender].push(id);
        emit VaultCreated(msg.sender, id, goal, deadline);
    }

    /// @notice Owner adds funds. Credited by measured balance delta (token-quirk safe).
    function deposit(uint256 id, uint256 amount) external nonReentrant {
        _deposit(id, amount);
    }

    function _deposit(uint256 id, uint256 amount) internal {
        Vault storage v = vaults[id];
        require(msg.sender == v.owner, "not owner"); // owner-only: a stranger can't force-unlock your goal
        require(!v.closed, "closed");
        require(amount > 0, "amount=0");

        bool wasGoalMet = v.saved >= v.goal;

        uint256 balBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - balBefore; // trust the delta, not `amount`

        v.saved += received;
        emit Deposited(id, msg.sender, received, v.saved);

        // Goal-cross is the only unlock transition emittable from here.
        if (!wasGoalMet && v.saved >= v.goal) {
            emit Unlocked(id, REASON_GOAL);
        }
    }

    /// @notice A keyholder approves an early exit (emergency bailout). Idempotent.
    function approveEarlyExit(uint256 id) external {
        Vault storage v = vaults[id];
        require(isKeyholder[id][msg.sender], "not keyholder");
        require(!v.closed, "closed");
        if (hasApproved[id][msg.sender]) return; // already counted — no-op

        hasApproved[id][msg.sender] = true;
        v.approvals += 1;
        emit EarlyApprovalGiven(id, msg.sender, v.approvals);

        if (v.approvals == v.threshold) {
            emit Unlocked(id, REASON_APPROVAL);
        }
    }

    /// @notice Owner withdraws the full balance once the vault is unlocked. Closes it.
    function withdraw(uint256 id) external nonReentrant {
        Vault storage v = vaults[id];
        require(msg.sender == v.owner, "not owner");
        require(!v.closed, "closed"); // enforces "no withdraw after close" (not just the saved=0 side effect)
        require(unlocked(id), "locked");

        uint256 amount = v.saved;
        v.saved = 0; // effects
        v.closed = true;
        token.safeTransfer(v.owner, amount); // interaction (CEI)
        emit Withdrawn(id, v.owner, amount);
    }

    /// @notice True once goal reached OR deadline passed OR approvals >= threshold.
    function unlocked(uint256 id) public view returns (bool) {
        Vault storage v = vaults[id];
        return v.saved >= v.goal || block.timestamp >= v.deadline || v.approvals >= v.threshold;
    }

    // --- views ---
    function getVault(uint256 id) external view returns (Vault memory) {
        return vaults[id];
    }

    function getOwnerVaults(address owner) external view returns (uint256[] memory) {
        return ownerVaults[owner];
    }

    function getOwnerVaultCount(address owner) external view returns (uint256) {
        return ownerVaults[owner].length;
    }

    function getKeyholders(uint256 id) external view returns (address[] memory) {
        return keyholderList[id];
    }
}
