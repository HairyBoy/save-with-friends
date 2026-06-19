// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SharedVaults — group savings-lock (v1)
/// @notice A pooled single-token escrow for saving WITH friends. Membership is FIXED
/// at creation (assembled off-chain, then the owner launches with the final roster —
/// a leaked invite link can't add anyone here), so the set of contributors and the
/// majority denominator never change. Each member deposits their own funds; the pot
/// unlocks on goal / deadline / a strict majority of members approving an early exit.
/// Payout is either BY_CONTRIBUTION (each withdraws what they put in) or
/// OWNER_TAKES_ALL (a group gift — only the owner withdraws the pot). Sibling of the
/// solo SavingsVaults; same safety posture (CEI, ReentrancyGuard, balance-delta).
contract SharedVaults is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    uint256 public constant MAX_MEMBERS = 20;

    uint8 public constant REASON_GOAL = 1;
    uint8 public constant REASON_APPROVAL = 2;

    enum Payout {
        BY_CONTRIBUTION, // each member withdraws their own contribution
        OWNER_TAKES_ALL // only the owner withdraws the whole pot (a group gift)
    }

    struct Vault {
        address owner; // slot0: 160
        uint64 deadline; // slot0: +64  (unix; always > creation time)
        bool closed; // slot0: +8
        uint8 payout; // slot0: +8  (Payout)
        bool goalReached; // slot0: +8  (latched — see unlocked())
        uint256 goal; // slot1
        uint256 saved; // slot2  (total pooled, not yet withdrawn)
        uint32 approvals; // slot3: distinct members who approved an early exit
        uint32 memberCount; // slot3: fixed at creation (owner + invited members)
    }

    mapping(uint256 => Vault) private vaults;
    mapping(uint256 => mapping(address => bool)) public isMember;
    mapping(uint256 => mapping(address => bool)) public hasApproved;
    mapping(uint256 => mapping(address => uint256)) public contributionOf;
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
    event Withdrawn(uint256 indexed id, address indexed to, uint256 amount);

    constructor(IERC20 _token) {
        token = _token;
    }

    /// @notice Create a shared vault with a FIXED member set and fund it with the
    /// owner's `initialDeposit` (owner must approve first; may be 0). `members` are the
    /// invited friends (the owner is added automatically); at least one is required.
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

    /// @notice A member adds their own funds. Credited by measured balance delta.
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

        contributionOf[id][msg.sender] += received;
        v.saved += received;
        emit Deposited(id, msg.sender, received, v.saved);

        // Goal-cross is the only unlock transition emittable from here (we required
        // !unlocked above, so the goal wasn't met before this deposit). Latch it: in
        // BY_CONTRIBUTION mode `saved` drops as members withdraw, so a saved>=goal
        // check would re-lock the vault mid-withdrawal and strand the rest.
        if (v.saved >= v.goal) {
            v.goalReached = true;
            emit Unlocked(id, REASON_GOAL);
        }
    }

    /// @notice A member approves an early exit. Unlocks once a STRICT majority of the
    /// (fixed) members have approved. Idempotent per member.
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
    /// contribution. OWNER_TAKES_ALL: only the owner pulls the whole pot.
    function withdraw(uint256 id) external nonReentrant {
        Vault storage v = vaults[id];
        require(isMember[id][msg.sender], "not member");
        require(!v.closed, "closed");
        require(unlocked(id), "locked");

        uint256 amount;
        if (v.payout == uint8(Payout.OWNER_TAKES_ALL)) {
            require(msg.sender == v.owner, "owner only");
            amount = v.saved;
            require(amount > 0, "amount=0");
            v.saved = 0; // effects
            v.closed = true;
        } else {
            amount = contributionOf[id][msg.sender];
            require(amount > 0, "amount=0");
            contributionOf[id][msg.sender] = 0; // effects
            v.saved -= amount;
            if (v.saved == 0) v.closed = true; // last one out closes it
        }

        token.safeTransfer(msg.sender, amount); // interaction (CEI)
        emit Withdrawn(id, msg.sender, amount);
    }

    /// @notice True once the goal was reached (latched) OR deadline passed OR a strict
    /// majority approved. All three conditions are monotonic, so an unlocked vault can
    /// never re-lock — even as `saved` falls during by-contribution withdrawals.
    function unlocked(uint256 id) public view returns (bool) {
        Vault storage v = vaults[id];
        return v.goalReached || block.timestamp >= v.deadline || v.approvals * 2 > v.memberCount;
    }

    // --- views ---
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
