// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAavePool, IScaledToken} from "./interfaces/IAaveV3.sol";

/// @title YieldSharedVaults — group savings-lock that earns Aave yield (v3)
/// @notice The yield sibling of `SharedVaults`. A fixed group pools a stablecoin until
/// goal / deadline / a strict majority approving an early exit; while it sits locked the
/// pot is supplied to **Aave V3** and **the savers keep the yield**. Payout is either
/// BY_CONTRIBUTION (each member withdraws their own stake **plus the yield it earned**)
/// or OWNER_TAKES_ALL (only the owner withdraws the whole pot + all its yield).
///
/// @dev Accounting mirrors the solo `YieldSavingsVaults`: one commingled aToken position,
/// each stake tracked in rebase-invariant **scaled** shares. The pot's total scaled
/// (`scaledSaved`) backs OWNER_TAKES_ALL; per-member scaled (`scaledContributionOf`)
/// backs BY_CONTRIBUTION, so yield is split pro-rata by *amount AND time in the pool*
/// (an earlier/larger stake earns proportionally more — exactly what scaled shares
/// encode). `saved`/`contributionOf` track raw principal for the goal latch + display.
/// Withdrawal floors scaled→underlying so one stake's rounding can't eat another's
/// (conservation: `Σ scaledContributionOf == scaledSaved <= aToken.scaledBalanceOf(this)`).
/// As in the solo vault, a withdraw with ~zero elapsed yield can floor to up to 1 base
/// unit (1e-6 USDC) under principal — the conservation-safe direction; real locks earn
/// far more. Stranded dust has no sweep (a deliberate thin-escrow `no`, as in v1).
contract YieldSharedVaults is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant RAY = 1e27;

    IERC20 public immutable token;
    IAavePool public immutable pool;
    IScaledToken public immutable aToken;

    uint256 public constant MAX_MEMBERS = 20;

    uint8 public constant REASON_GOAL = 1;
    uint8 public constant REASON_APPROVAL = 2;

    enum Payout {
        BY_CONTRIBUTION, // each member withdraws their own stake + its yield
        OWNER_TAKES_ALL // only the owner withdraws the whole pot + all yield (a group gift)
    }

    struct Vault {
        address owner; // slot0: 160
        uint64 deadline; // slot0: +64  (unix; always > creation time)
        bool closed; // slot0: +8
        uint8 payout; // slot0: +8  (Payout)
        bool goalReached; // slot0: +8  (latched — see unlocked())
        uint256 goal; // slot1
        uint256 saved; // slot2  total raw principal pooled, not yet withdrawn
        uint256 scaledSaved; // slot3  total Aave scaled shares, not yet withdrawn
        uint32 approvals; // slot4: distinct members who approved an early exit
        uint32 memberCount; // slot4: fixed at creation (owner + invited)
    }

    mapping(uint256 => Vault) private vaults;
    mapping(uint256 => mapping(address => bool)) public isMember;
    mapping(uint256 => mapping(address => bool)) public hasApproved;
    mapping(uint256 => mapping(address => uint256)) public contributionOf; // raw principal per member
    mapping(uint256 => mapping(address => uint256)) public scaledContributionOf; // scaled shares per member
    mapping(uint256 => address[]) private memberList;
    mapping(address => uint256[]) private memberVaults;

    uint256 public nextId = 1; // start at 1 so id 0 cleanly means "none"

    event VaultCreated(
        address indexed owner, uint256 indexed id, uint256 goal, uint64 deadline, uint8 payout, uint32 memberCount
    );
    event MemberAdded(uint256 indexed id, address indexed member);
    event Deposited(uint256 indexed id, address indexed from, uint256 amount, uint256 newSaved);
    event EarlyApprovalGiven(uint256 indexed id, address indexed member, uint32 approvals);
    event Unlocked(uint256 indexed id, uint8 reason);
    // `amount` is the full payout (principal + yield); `yield_` is the earned portion.
    event Withdrawn(uint256 indexed id, address indexed to, uint256 amount, uint256 yield_);

    constructor(IERC20 _token, IAavePool _pool, IScaledToken _aToken) {
        token = _token;
        pool = _pool;
        aToken = _aToken;
        _token.forceApprove(address(_pool), type(uint256).max);
    }

    /// @notice Create a shared vault with a FIXED member set and fund it with the
    /// owner's `initialDeposit` (owner must approve first; may be 0).
    function createVault(
        uint256 goal,
        uint64 deadline,
        Payout payout,
        address[] calldata members,
        uint256 initialDeposit
    ) external nonReentrant returns (uint256 id) {
        require(goal > 0, "goal=0");
        require(deadline > block.timestamp, "deadline<=now");
        require(members.length >= 1, "need members"); // shared => >= 2 people total
        require(members.length + 1 <= MAX_MEMBERS, "too many members");

        id = nextId++;
        Vault storage v = vaults[id];
        v.owner = msg.sender;
        v.deadline = deadline;
        v.goal = goal;
        v.payout = uint8(payout);

        _addMember(id, msg.sender); // owner is a member (contributes + votes)
        for (uint256 i = 0; i < members.length; i++) {
            address m = members[i];
            require(m != address(0), "member=0");
            require(!isMember[id][m], "dup member"); // also catches m == owner
            _addMember(id, m);
        }
        v.memberCount = uint32(memberList[id].length);

        emit VaultCreated(msg.sender, id, goal, deadline, uint8(payout), v.memberCount);

        if (initialDeposit > 0) {
            _deposit(id, initialDeposit);
        }
    }

    function _addMember(uint256 id, address m) internal {
        isMember[id][m] = true;
        memberList[id].push(m);
        memberVaults[m].push(id);
        emit MemberAdded(id, m);
    }

    /// @notice A member adds their own funds; the pot is supplied to Aave to earn yield.
    function deposit(uint256 id, uint256 amount) external nonReentrant {
        _deposit(id, amount);
    }

    function _deposit(uint256 id, uint256 amount) internal {
        Vault storage v = vaults[id];
        require(isMember[id][msg.sender], "not member");
        require(!v.closed, "closed");
        require(!unlocked(id), "unlocked"); // no new funds once it's open for withdrawal
        require(amount > 0, "amount=0");

        uint256 balBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - balBefore; // trust the delta

        uint256 scaledBefore = aToken.scaledBalanceOf(address(this));
        pool.supply(address(token), received, address(this), 0);
        uint256 scaledReceived = aToken.scaledBalanceOf(address(this)) - scaledBefore;

        contributionOf[id][msg.sender] += received;
        scaledContributionOf[id][msg.sender] += scaledReceived;
        v.saved += received;
        v.scaledSaved += scaledReceived;
        emit Deposited(id, msg.sender, received, v.saved);

        // Goal-cross (by principal) latched — see unlocked(): in BY_CONTRIBUTION mode
        // `saved` drops as members withdraw, so a live saved>=goal check would re-lock.
        if (v.saved >= v.goal) {
            v.goalReached = true;
            emit Unlocked(id, REASON_GOAL);
        }
    }

    /// @notice A member approves an early exit. Unlocks on a STRICT majority. Idempotent.
    function approveEarlyExit(uint256 id) external {
        Vault storage v = vaults[id];
        require(isMember[id][msg.sender], "not member");
        require(!v.closed, "closed");
        if (hasApproved[id][msg.sender]) return; // already counted — no-op

        hasApproved[id][msg.sender] = true;
        v.approvals += 1;
        emit EarlyApprovalGiven(id, msg.sender, v.approvals);

        // Emit Unlocked exactly on the crossing into majority.
        if (v.approvals * 2 > v.memberCount && (v.approvals - 1) * 2 <= v.memberCount) {
            emit Unlocked(id, REASON_APPROVAL);
        }
    }

    /// @notice Withdraw once unlocked. BY_CONTRIBUTION: each member pulls their own
    /// stake + the yield it earned. OWNER_TAKES_ALL: only the owner pulls the whole pot.
    function withdraw(uint256 id) external nonReentrant {
        Vault storage v = vaults[id];
        require(isMember[id][msg.sender], "not member");
        require(!v.closed, "closed");
        require(unlocked(id), "locked");

        uint256 income = pool.getReserveNormalizedIncome(address(token));
        uint256 scaled;
        uint256 principal;

        if (v.payout == uint8(Payout.OWNER_TAKES_ALL)) {
            require(msg.sender == v.owner, "owner only");
            scaled = v.scaledSaved;
            principal = v.saved;
            require(scaled > 0, "amount=0");
            v.scaledSaved = 0; // effects
            v.saved = 0;
            v.closed = true;
        } else {
            scaled = scaledContributionOf[id][msg.sender];
            principal = contributionOf[id][msg.sender];
            require(scaled > 0, "amount=0");
            scaledContributionOf[id][msg.sender] = 0; // effects
            contributionOf[id][msg.sender] = 0;
            v.scaledSaved -= scaled;
            v.saved -= principal;
            if (v.scaledSaved == 0) v.closed = true; // last one out closes it
        }

        // Floor conversion => burn <= ledgered shares => one stake can't eat another's.
        uint256 amount = _rayMulFloor(scaled, income);
        uint256 got = pool.withdraw(address(token), amount, msg.sender); // interaction (CEI)
        uint256 yield_ = got > principal ? got - principal : 0;
        emit Withdrawn(id, msg.sender, got, yield_);
    }

    /// @notice True once goal reached (latched) OR deadline passed OR a strict majority
    /// approved. All three are monotonic, so an unlocked vault never re-locks. Uses raw
    /// principal for the goal, so yield drift never trips it; pure-storage (no Aave call).
    function unlocked(uint256 id) public view returns (bool) {
        Vault storage v = vaults[id];
        return v.goalReached || block.timestamp >= v.deadline || v.approvals * 2 > v.memberCount;
    }

    /// scaled * index / RAY, rounded DOWN — conservation-safe (see contract docs).
    function _rayMulFloor(uint256 scaled, uint256 index) private pure returns (uint256) {
        return (scaled * index) / RAY;
    }

    // --- views ---

    /// @notice Current redeemable value of the whole pot (principal + accrued yield).
    function potValue(uint256 id) external view returns (uint256) {
        return _rayMulFloor(vaults[id].scaledSaved, pool.getReserveNormalizedIncome(address(token)));
    }

    /// @notice Current redeemable value of a member's stake (principal + its yield).
    function memberValue(uint256 id, address member) external view returns (uint256) {
        return _rayMulFloor(scaledContributionOf[id][member], pool.getReserveNormalizedIncome(address(token)));
    }

    function getVault(uint256 id) external view returns (Vault memory) {
        return vaults[id];
    }

    function getMembers(uint256 id) external view returns (address[] memory) {
        return memberList[id];
    }

    function getMemberVaults(address member) external view returns (uint256[] memory) {
        return memberVaults[member];
    }
}
