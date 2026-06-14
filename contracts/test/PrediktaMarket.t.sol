// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PrediktaMarket.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal ERC-20 mock for testing
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock USDm", "USDm") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract PrediktaMarketTest is Test {
    PrediktaMarket public market;
    MockERC20      public token;

    address treasury  = makeAddr("treasury");
    address resolver  = makeAddr("resolver");
    address alice     = makeAddr("alice");
    address bob       = makeAddr("bob");
    address creator   = makeAddr("creator");
    address referrer  = makeAddr("referrer");

    bytes32 constant MID = keccak256("market-001");

    function setUp() public {
        token  = new MockERC20();
        market = new PrediktaMarket(treasury);

        market.setAllowedToken(address(token), true);
        market.setResolver(resolver, true);

        token.mint(alice,   1_000 ether);
        token.mint(bob,     1_000 ether);
        token.mint(creator, 1_000 ether);

        vm.prank(alice);   token.approve(address(market), type(uint256).max);
        vm.prank(bob);     token.approve(address(market), type(uint256).max);
        vm.prank(creator); token.approve(address(market), type(uint256).max);
    }

    // ─── createMarket ─────────────────────────────────────────────────────────

    function test_createMarket() public {
        uint256 closeDate = block.timestamp + 1 days;
        vm.prank(creator);
        market.createMarket(MID, address(token), 2, closeDate);

        PrediktaMarket.Market memory m = market.getMarket(MID);
        assertEq(m.creator,     creator);
        assertEq(m.closeDate,   closeDate);
        assertEq(m.optionCount, 2);
        assertEq(uint(m.status), uint(PrediktaMarket.MarketStatus.Active));
    }

    function test_createMarket_revertDuplicateId() public {
        vm.prank(creator);
        market.createMarket(MID, address(token), 2, block.timestamp + 1 days);
        vm.prank(creator);
        vm.expectRevert("Market already exists");
        market.createMarket(MID, address(token), 2, block.timestamp + 2 days);
    }

    function test_createMarket_revertDisallowedToken() public {
        address fake = makeAddr("fake");
        vm.prank(creator);
        vm.expectRevert("Token not allowed");
        market.createMarket(MID, fake, 2, block.timestamp + 1 days);
    }

    // ─── placeBet ─────────────────────────────────────────────────────────────

    function test_placeBet() public {
        vm.prank(creator);
        market.createMarket(MID, address(token), 2, block.timestamp + 1 days);

        vm.prank(alice);
        market.placeBet(MID, 0, 100 ether);

        PrediktaMarket.Position memory pos = market.getPosition(MID, alice);
        assertEq(pos.amount,      100 ether);
        assertEq(pos.optionIndex, 0);
        assertFalse(pos.claimed);

        assertEq(market.getOptionPool(MID, 0), 100 ether);
        assertEq(market.getMarket(MID).totalPool, 100 ether);
    }

    function test_placeBet_revertDoubleBet() public {
        vm.prank(creator);
        market.createMarket(MID, address(token), 2, block.timestamp + 1 days);

        vm.prank(alice);
        market.placeBet(MID, 0, 100 ether);
        vm.prank(alice);
        vm.expectRevert("Already bet");
        market.placeBet(MID, 1, 50 ether);
    }

    function test_placeBet_revertAfterClose() public {
        vm.prank(creator);
        market.createMarket(MID, address(token), 2, block.timestamp + 1 days);

        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        vm.expectRevert("Betting period closed");
        market.placeBet(MID, 0, 100 ether);
    }

    // ─── setReferrer ──────────────────────────────────────────────────────────

    function test_setReferrer() public {
        vm.prank(resolver);
        market.setReferrer(creator, referrer);
        assertEq(market.referrers(creator), referrer);
    }

    function test_setReferrer_revertDouble() public {
        vm.prank(resolver);
        market.setReferrer(creator, referrer);
        vm.prank(resolver);
        vm.expectRevert("Referrer already set");
        market.setReferrer(creator, alice);
    }

    function test_setReferrer_revertSelf() public {
        vm.prank(resolver);
        vm.expectRevert("Cannot refer yourself");
        market.setReferrer(creator, creator);
    }

    // ─── resolveMarket + claimWinnings ────────────────────────────────────────

    function test_resolveAndClaim_withReferrer() public {
        // pool = 1000, fees: 2% platform=20, 2% creator=20, 1% referrer=10
        // distributable = 950, alice wins all (600/600)
        uint256 closeDate = block.timestamp + 1 days;

        vm.prank(resolver);
        market.setReferrer(creator, referrer);

        vm.prank(creator);
        market.createMarket(MID, address(token), 2, closeDate);

        vm.prank(alice); market.placeBet(MID, 0, 600 ether);
        vm.prank(bob);   market.placeBet(MID, 1, 400 ether);

        vm.warp(closeDate + 1);

        uint256 treasuryBefore = token.balanceOf(treasury);
        uint256 creatorBefore  = token.balanceOf(creator);
        uint256 referrerBefore = token.balanceOf(referrer);

        vm.prank(resolver);
        market.resolveMarket(MID, 0);

        assertEq(token.balanceOf(treasury) - treasuryBefore, 20 ether);  // 2%
        assertEq(token.balanceOf(creator)  - creatorBefore,  20 ether);  // 2%
        assertEq(token.balanceOf(referrer) - referrerBefore, 10 ether);  // 1%

        // Alice claims: 600/600 * 950 = 950
        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        market.claimWinnings(MID);
        assertEq(token.balanceOf(alice) - aliceBefore, 950 ether);
    }

    function test_resolveAndClaim_noReferrer() public {
        // No referrer → 1% extra goes to treasury (total 3% treasury)
        uint256 closeDate = block.timestamp + 1 days;

        vm.prank(creator);
        market.createMarket(MID, address(token), 2, closeDate);

        vm.prank(alice); market.placeBet(MID, 0, 600 ether);
        vm.prank(bob);   market.placeBet(MID, 1, 400 ether);

        vm.warp(closeDate + 1);

        uint256 treasuryBefore = token.balanceOf(treasury);
        uint256 creatorBefore  = token.balanceOf(creator);

        vm.prank(resolver);
        market.resolveMarket(MID, 0);

        assertEq(token.balanceOf(treasury) - treasuryBefore, 30 ether);  // 2% + 1% fallback
        assertEq(token.balanceOf(creator)  - creatorBefore,  20 ether);  // 2%

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        market.claimWinnings(MID);
        assertEq(token.balanceOf(alice) - aliceBefore, 950 ether);
    }

    function test_claimWinnings_revertLoser() public {
        uint256 closeDate = block.timestamp + 1 days;
        vm.prank(creator);
        market.createMarket(MID, address(token), 2, closeDate);

        vm.prank(alice); market.placeBet(MID, 0, 500 ether);
        vm.prank(bob);   market.placeBet(MID, 1, 500 ether);

        vm.warp(closeDate + 1);
        vm.prank(resolver);
        market.resolveMarket(MID, 0);

        vm.prank(bob);
        vm.expectRevert("Not a winner");
        market.claimWinnings(MID);
    }

    function test_claimWinnings_revertDoubleClaim() public {
        uint256 closeDate = block.timestamp + 1 days;
        vm.prank(creator);
        market.createMarket(MID, address(token), 2, closeDate);

        vm.prank(alice); market.placeBet(MID, 0, 500 ether);
        vm.prank(bob);   market.placeBet(MID, 1, 500 ether);

        vm.warp(closeDate + 1);
        vm.prank(resolver);
        market.resolveMarket(MID, 0);

        vm.prank(alice); market.claimWinnings(MID);
        vm.prank(alice);
        vm.expectRevert("Already claimed");
        market.claimWinnings(MID);
    }

    // ─── cancelMarket + refund ────────────────────────────────────────────────

    function test_cancelAndRefund() public {
        vm.prank(creator);
        market.createMarket(MID, address(token), 2, block.timestamp + 1 days);

        vm.prank(alice); market.placeBet(MID, 0, 300 ether);

        market.cancelMarket(MID);

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        market.refund(MID);
        assertEq(token.balanceOf(alice) - aliceBefore, 300 ether);
    }

    // ─── getProbabilities ─────────────────────────────────────────────────────

    function test_getProbabilities() public {
        vm.prank(creator);
        market.createMarket(MID, address(token), 2, block.timestamp + 1 days);

        vm.prank(alice); market.placeBet(MID, 0, 75 ether);
        vm.prank(bob);   market.placeBet(MID, 1, 25 ether);

        uint256[] memory probs = market.getProbabilities(MID);
        assertEq(probs[0], 75);
        assertEq(probs[1], 25);
    }
}
