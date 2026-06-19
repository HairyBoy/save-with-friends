// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAavePool, IScaledToken} from "./interfaces/IAaveV3.sol";

/// @title YieldSavingsVaults — solo savings-lock that earns Aave yield (v3)
/// @notice The yield sibling of the thin-escrow `SavingsVaults`. Same unlock model
/// (goal reached OR deadline passed OR a keyholder approves an early exit, solo =
/// 1-of-N), but deposited principal is supplied to **Aave V3** while it sits locked,
/// and **the saver keeps the yield** — withdrawal returns principal + everything it
/// earned. Design + rationale in .private/CONTRACTS_PLAN.md (v3 section).
///
/// @dev Accounting. The contract holds ONE commingled aToken position for every
/// vault. aTokens rebase, so a raw `balanceOf` can't say what each vault owns. Each
/// vault instead tracks its **scaled** shares (`scaledSaved`) — the rebase-invariant
/// unit Aave mints — captured as the scaled-balance delta around each `supply`. A
/// vault's redeemable value = `scaledSaved.rayMul(getReserveNormalizedIncome)`, which
/// grows with the index. `saved` separately tracks raw principal, so the GOAL is met
/// by what you put in (predictable), never by market yield drifting you over the line.
///
/// Conservation: `Σ vaults[i].scaledSaved <= aToken.scaledBalanceOf(this)`. Withdrawal
/// converts scaled→underlying with a **floor** (`_rayMulFloor`), guaranteeing the burn
/// never exceeds the vault's ledgered shares — so one vault's sub-wei rounding can
/// never eat another vault's principal. Dust accrues on the safe side (the contract
/// holds at least what it owes) and, like v1's stray tokens, is left stranded. The
/// only saver-facing cost: a withdraw with ~zero elapsed yield (e.g. deposit then
/// instant keyholder early-exit) can return up to 1 base unit (1e-6 USDC) less than
/// principal. Any lock held long enough to matter earns yield that dwarfs it.
contract YieldSavingsVaults is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// Ray, the 27-decimal fixed point Aave indexes use.
    uint256 private constant RAY = 1e27;

    /// The one canonical stablecoin, set once at deploy. Must be a supported Aave
    /// V3 reserve (USDC on Celo). The contract holds nothing else (besides its aToken).
    IERC20 public immutable token;
    /// The Aave V3 Pool principal is supplied to / withdrawn from.
    IAavePool public immutable pool;
    /// The reserve's aToken, in scaled units. Passed at deploy (not read from the
    /// Pool) to keep this contract free of Aave's DataTypes structs.
    IScaledToken public immutable aToken;

    uint256 public constant MAX_KEYHOLDERS = 10;

    uint8 public constant REASON_GOAL = 1;
    uint8 public constant REASON_APPROVAL = 2;

    struct Vault {
        address owner; // slot0: 160
        uint64 deadline; // slot0: +64  (unix; always > creation time)
        bool closed; // slot0: +8
        uint256 goal; // slot1
        uint256 saved; // slot2  raw principal deposited (drives goal + display)
        uint256 scaledSaved; // slot3  Aave scaled shares (principal + accrued yield)
        uint32 approvals; // slot4: distinct keyholder approvals so far
        uint32 threshold; // slot4: approvals needed to early-unlock (solo = 1)
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
    // `amount` is the full payout (principal + yield); `yield_` is the earned portion.
    event Withdrawn(uint256 indexed id, address to, uint256 amount, uint256 yield_);

    constructor(IERC20 _token, IAavePool _pool, IScaledToken _aToken) {
        token = _token;
        pool = _pool;
        aToken = _aToken;
        // One-time max approval: every deposit supplies through the (trusted) Pool.
        _token.forceApprove(address(_pool), type(uint256).max);
    }

    /// @notice Create a solo vault (unfunded). Fund it later via deposit().
    function createVault(uint256 goal, uint64 deadline, address[] calldata keyholders)
        external
        returns (uint256 id)
    {
        return _createVault(goal, deadline, keyholders);
    }

    /// @notice Create a solo vault AND fund it with `initialDeposit` in one tx (the
    /// owner must approve `initialDeposit` first). `initialDeposit` may be 0.
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
            require(!isKeyholder[id][k], "dup keyholder"); // dedup
            isKeyholder[id][k] = true;
            keyholderList[id].push(k);
            emit KeyholderAdded(id, k);
        }

        ownerVaults[msg.sender].push(id);
        emit VaultCreated(msg.sender, id, goal, deadline);
    }

    /// @notice Owner adds funds; they're supplied to Aave to earn yield while locked.
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

        // Supply to Aave and credit this vault the SCALED shares minted (the position
        // is commingled, so we can never read a raw per-vault balance back out).
        uint256 scaledBefore = aToken.scaledBalanceOf(address(this));
        pool.supply(address(token), received, address(this), 0);
        uint256 scaledReceived = aToken.scaledBalanceOf(address(this)) - scaledBefore;

        v.saved += received;
        v.scaledSaved += scaledReceived;
        emit Deposited(id, msg.sender, received, v.saved);

        // Goal-cross (by principal) is the only unlock transition emittable from here.
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

    /// @notice Owner withdraws principal + all accrued Aave yield once unlocked. Closes it.
    function withdraw(uint256 id) external nonReentrant {
        Vault storage v = vaults[id];
        require(msg.sender == v.owner, "not owner");
        require(!v.closed, "closed"); // enforces "no withdraw after close"
        require(unlocked(id), "locked");

        uint256 scaled = v.scaledSaved;
        uint256 principal = v.saved;
        v.scaledSaved = 0; // effects (CEI)
        v.saved = 0;
        v.closed = true;

        // Floor conversion => burn <= our ledgered scaled shares => conservation safe.
        uint256 amount = _rayMulFloor(scaled, pool.getReserveNormalizedIncome(address(token)));
        uint256 got;
        if (amount > 0) {
            got = pool.withdraw(address(token), amount, v.owner); // interaction
        }
        uint256 yield_ = got > principal ? got - principal : 0;
        emit Withdrawn(id, v.owner, got, yield_);
    }

    /// @notice True once goal reached OR deadline passed OR approvals >= threshold.
    /// @dev Goal uses raw principal (`saved`), so unlocking is never triggered by yield
    /// drift, and this stays a pure-storage view (no external Aave call).
    function unlocked(uint256 id) public view returns (bool) {
        Vault storage v = vaults[id];
        return v.saved >= v.goal || block.timestamp >= v.deadline || v.approvals >= v.threshold;
    }

    /// @notice Current redeemable value of a vault (principal + accrued yield), in
    /// token units. Frontend shows yield as `withdrawable - saved`.
    function withdrawable(uint256 id) external view returns (uint256) {
        return _rayMulFloor(vaults[id].scaledSaved, pool.getReserveNormalizedIncome(address(token)));
    }

    /// scaled * index / RAY, rounded DOWN — see the conservation note on the contract.
    function _rayMulFloor(uint256 scaled, uint256 index) private pure returns (uint256) {
        return (scaled * index) / RAY;
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
