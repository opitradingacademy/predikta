// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title PrediktaMarket
/// @notice Prediction market contract for MiniPay/Celo. Manages fund custody,
///         pools, automatic prize distribution and commissions.
contract PrediktaMarket is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant PLATFORM_FEE_BPS  = 200;  // 2%
    uint256 public constant CREATOR_FEE_BPS   = 200;  // 2%
    uint256 public constant REFERRER_FEE_BPS  = 100;  // 1%
    uint256 public constant BPS_DENOMINATOR   = 10_000;

    // ─── Types ────────────────────────────────────────────────────────────────

    enum MarketStatus { Active, Resolved, Cancelled }

    struct Market {
        address creator;
        address token;
        uint256 closeDate;
        uint256 totalPool;
        uint8   optionCount;
        uint8   winningOption;
        MarketStatus status;
    }

    struct Position {
        uint256 amount;
        uint8   optionIndex;
        bool    claimed;
    }

    // ─── Storage ──────────────────────────────────────────────────────────────

    address public treasury;
    mapping(address => bool)    public allowedTokens;
    mapping(address => bool)    public resolvers;
    mapping(address => address) public referrers; // creator => who invited them

    // marketId => Market
    mapping(bytes32 => Market) public markets;
    // marketId => optionIndex => totalStaked
    mapping(bytes32 => mapping(uint8 => uint256)) public optionPools;
    // marketId => user => Position
    mapping(bytes32 => mapping(address => Position)) public positions;

    // ─── Events ───────────────────────────────────────────────────────────────

    event MarketCreated(bytes32 indexed marketId, address indexed creator, address token, uint256 closeDate, uint8 optionCount);
    event BetPlaced(bytes32 indexed marketId, address indexed user, uint8 optionIndex, uint256 amount);
    event MarketResolved(bytes32 indexed marketId, uint8 winningOption, uint256 platformFee, uint256 creatorFee, uint256 referrerFee, address referrer);
    event WinningsClaimed(bytes32 indexed marketId, address indexed user, uint256 payout);
    event MarketCancelled(bytes32 indexed marketId);
    event Refunded(bytes32 indexed marketId, address indexed user, uint256 amount);
    event ReferrerSet(address indexed user, address indexed referrer);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyResolver() {
        require(resolvers[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _treasury) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setAllowedToken(address token, bool allowed) external onlyOwner {
        allowedTokens[token] = allowed;
    }

    function setResolver(address resolver, bool allowed) external onlyOwner {
        resolvers[resolver] = allowed;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
    }

    /// @notice Records who invited a user. Can only be set once per user.
    ///         Called by the backend resolver when a referred user creates their first market.
    function setReferrer(address user, address ref) external onlyResolver {
        require(user != address(0) && ref != address(0), "Invalid address");
        require(user != ref,                             "Cannot refer yourself");
        require(referrers[user] == address(0),           "Referrer already set");
        referrers[user] = ref;
        emit ReferrerSet(user, ref);
    }

    // ─── Market lifecycle ─────────────────────────────────────────────────────

    /// @notice Creates a new prediction market.
    function createMarket(
        bytes32 marketId,
        address token,
        uint8   optionCount,
        uint256 closeDate
    ) external {
        require(allowedTokens[token],                     "Token not allowed");
        require(optionCount >= 2 && optionCount <= 10,    "Invalid option count");
        require(closeDate > block.timestamp,              "Close date in the past");
        require(markets[marketId].closeDate == 0,         "Market already exists");

        markets[marketId] = Market({
            creator:      msg.sender,
            token:        token,
            closeDate:    closeDate,
            totalPool:    0,
            optionCount:  optionCount,
            winningOption: 0,
            status:       MarketStatus.Active
        });

        emit MarketCreated(marketId, msg.sender, token, closeDate, optionCount);
    }

    /// @notice Places a bet on a market option. One bet per user per market.
    function placeBet(
        bytes32 marketId,
        uint8   optionIndex,
        uint256 amount
    ) external nonReentrant {
        Market storage m = markets[marketId];
        require(m.status == MarketStatus.Active,              "Market not active");
        require(block.timestamp < m.closeDate,                "Betting period closed");
        require(optionIndex < m.optionCount,                  "Invalid option");
        require(amount > 0,                                   "Amount must be > 0");
        require(positions[marketId][msg.sender].amount == 0,  "Already bet");

        IERC20(m.token).safeTransferFrom(msg.sender, address(this), amount);

        positions[marketId][msg.sender] = Position({
            amount:      amount,
            optionIndex: optionIndex,
            claimed:     false
        });

        optionPools[marketId][optionIndex] += amount;
        m.totalPool += amount;

        emit BetPlaced(marketId, msg.sender, optionIndex, amount);
    }

    /// @notice Resolves a market and distributes fees: 2% platform, 2% creator, 1% referrer.
    ///         If the creator has no referrer, the 1% goes to the treasury.
    function resolveMarket(bytes32 marketId, uint8 winningOption) external onlyResolver nonReentrant {
        Market storage m = markets[marketId];
        require(m.status == MarketStatus.Active,  "Cannot resolve");
        require(block.timestamp >= m.closeDate,   "Market still open");
        require(winningOption < m.optionCount,    "Invalid option");

        m.winningOption = winningOption;
        m.status        = MarketStatus.Resolved;

        uint256 platformFee  = (m.totalPool * PLATFORM_FEE_BPS)  / BPS_DENOMINATOR;
        uint256 creatorFee   = (m.totalPool * CREATOR_FEE_BPS)   / BPS_DENOMINATOR;
        uint256 referrerFee  = (m.totalPool * REFERRER_FEE_BPS)  / BPS_DENOMINATOR;

        address ref = referrers[m.creator];

        if (platformFee > 0) IERC20(m.token).safeTransfer(treasury,   platformFee);
        if (creatorFee  > 0) IERC20(m.token).safeTransfer(m.creator,  creatorFee);

        if (referrerFee > 0) {
            // No referrer → 1% goes to treasury
            IERC20(m.token).safeTransfer(ref != address(0) ? ref : treasury, referrerFee);
        }

        emit MarketResolved(marketId, winningOption, platformFee, creatorFee, referrerFee, ref);
    }

    /// @notice Winners call this to receive their payout.
    function claimWinnings(bytes32 marketId) external nonReentrant {
        Market storage m = markets[marketId];
        require(m.status == MarketStatus.Resolved, "Not resolved");

        Position storage pos = positions[marketId][msg.sender];
        require(pos.amount > 0,                    "No position");
        require(!pos.claimed,                      "Already claimed");
        require(pos.optionIndex == m.winningOption, "Not a winner");

        pos.claimed = true;

        uint256 winnerPool    = optionPools[marketId][m.winningOption];
        uint256 totalFeesBps  = PLATFORM_FEE_BPS + CREATOR_FEE_BPS + REFERRER_FEE_BPS;
        uint256 distributable = m.totalPool - (m.totalPool * totalFeesBps) / BPS_DENOMINATOR;
        uint256 payout        = (pos.amount * distributable) / winnerPool;

        IERC20(m.token).safeTransfer(msg.sender, payout);

        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    /// @notice Cancels a market (only owner). All bets become refundable.
    function cancelMarket(bytes32 marketId) external onlyOwner {
        Market storage m = markets[marketId];
        require(m.status == MarketStatus.Active, "Cannot cancel");
        m.status = MarketStatus.Cancelled;
        emit MarketCancelled(marketId);
    }

    /// @notice Refunds a user's bet on a cancelled market.
    function refund(bytes32 marketId) external nonReentrant {
        Market storage m = markets[marketId];
        require(m.status == MarketStatus.Cancelled, "Not cancelled");

        Position storage pos = positions[marketId][msg.sender];
        require(pos.amount > 0,   "No position");
        require(!pos.claimed,     "Already refunded");

        pos.claimed = true;
        IERC20(m.token).safeTransfer(msg.sender, pos.amount);

        emit Refunded(marketId, msg.sender, pos.amount);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getMarket(bytes32 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    function getPosition(bytes32 marketId, address user) external view returns (Position memory) {
        return positions[marketId][user];
    }

    function getOptionPool(bytes32 marketId, uint8 optionIndex) external view returns (uint256) {
        return optionPools[marketId][optionIndex];
    }

    /// @notice Returns probability (0-100) for each option based on current pools.
    function getProbabilities(bytes32 marketId) external view returns (uint256[] memory probs) {
        Market storage m = markets[marketId];
        probs = new uint256[](m.optionCount);
        if (m.totalPool == 0) {
            for (uint8 i = 0; i < m.optionCount; i++) probs[i] = 100 / m.optionCount;
            return probs;
        }
        for (uint8 i = 0; i < m.optionCount; i++) {
            probs[i] = (optionPools[marketId][i] * 100) / m.totalPool;
        }
    }
}
