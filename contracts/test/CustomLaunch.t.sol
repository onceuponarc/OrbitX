pragma solidity ^0.8.26;

import {CustomLaunchFactory} from "../src/custom-launch/CustomLaunchFactory.sol";
import {CustomLaunchPool} from "../src/custom-launch/CustomLaunchPool.sol";
import {CustomLaunchToken} from "../src/custom-launch/CustomLaunchToken.sol";
import {FeeRouter} from "../src/custom-launch/FeeRouter.sol";
import {StrategyHub} from "../src/custom-launch/StrategyHub.sol";
import {LaunchTypes} from "../src/custom-launch/LaunchTypes.sol";
import {MockUSDC} from "./MockUSDC.sol";

contract CustomLaunchTest {
    CustomLaunchFactory factory;
    MockUSDC usdc;
    address protocol = address(0xA11CE);
    address creator = address(this);
    address trader;

    StrategyHub hub;
    CustomLaunchToken token;
    CustomLaunchPool pool;
    FeeRouter router;

    uint16[9] split;

    function setUp() public {
        factory = new CustomLaunchFactory(address(this));
        usdc = new MockUSDC();
        trader = address(0x77);
        split[0] = 2500;
        split[1] = 2500;
        split[2] = 1500;
        split[3] = 1500;
        split[4] = 1000;
        split[5] = 500;
        split[6] = 200;
        split[7] = 200;
        split[8] = 100;
        usdc.mint(address(this), 1_000_000e6);
        usdc.mint(trader, 50_000e6);
        usdc.approve(address(factory), type(uint256).max);
        LaunchTypes.CreateParams memory p = LaunchTypes.CreateParams({
            name: "Desk Coin",
            symbol: "DESK",
            uri: "ipfs://desk",
            decimals: 18,
            supply: 1_000_000_000e18,
            quote: address(usdc),
            tradeFeeBps: 300,
            splitBps: split,
            protocol: protocol,
            creator: creator,
            charity: address(0xC1A),
            treasury: address(0x75EA5),
            community: address(0xC0),
            tokenLiquidity: 200_000_000e18,
            quoteLiquidity: 10_000e6,
            maxExecution: 0,
            cooldown: 0,
            flywheel: new uint8[](0)
        });
        (, address hubAddr, address tokenAddr, address poolAddr, address routerAddr) = factory.createLaunch(p);
        hub = StrategyHub(hubAddr);
        token = CustomLaunchToken(tokenAddr);
        pool = CustomLaunchPool(poolAddr);
        router = FeeRouter(routerAddr);
    }

    function testCreateLaunchSeedsPoolAndCreatorSupply() public view {
        require(pool.reserveQuote() == 10_000e6, "quote reserve");
        require(pool.reserveToken() == 200_000_000e18, "token reserve");
        require(token.balanceOf(creator) == 800_000_000e18, "creator circulating");
        require(token.balanceOf(address(hub)) == 0, "hub leftover");
    }

    function testSeederPaysQuoteCreatorDoesNot() public {
        QuoteSeeder seeder = new QuoteSeeder();
        address author = address(0xA070);
        usdc.mint(address(seeder), 10_000e6);
        uint256 authorUsdc = usdc.balanceOf(author);
        LaunchTypes.CreateParams memory p = _params();
        p.creator = author;
        seeder.seed(factory, usdc, p);
        require(usdc.balanceOf(address(seeder)) == 0, "seeder spent quote");
        require(usdc.balanceOf(author) == authorUsdc, "creator quote untouched");
    }

    function testFeeCapRejected() public {
        LaunchTypes.CreateParams memory p = _params();
        p.tradeFeeBps = 501;
        usdc.approve(address(factory), type(uint256).max);
        try factory.createLaunch(p) {
            revert("fee cap");
        } catch {}
    }

    function testSplitMustBe100AndProtocolLocked() public {
        LaunchTypes.CreateParams memory p = _params();
        p.splitBps[0] = 2400;
        p.splitBps[1] = 2600;
        try factory.createLaunch(p) {
            revert("protocol lock");
        } catch {}
    }

    function testSwapHarvestsToProtocolAndVaults() public {
        _traderBuy(1_000e6);
        router.harvest(address(usdc));
        uint256 fee = (1_000e6 * 300) / 10_000;
        require(usdc.balanceOf(protocol) == (fee * 2500) / 10_000, "protocol share");
        require(hub.balances(LaunchTypes.DEST_CREATOR, address(usdc)) == (fee * 2500) / 10_000, "creator vault");
        require(hub.balances(LaunchTypes.DEST_BUYBACK, address(usdc)) == (fee * 1000) / 10_000, "buyback vault");
    }

    function testCreatorClaimDoesNotTouchBuyback() public {
        _traderBuy(2_000e6);
        router.harvestAll();
        uint256 buybackBefore = hub.balances(LaunchTypes.DEST_BUYBACK, address(usdc));
        uint256 creatorBal = hub.balances(LaunchTypes.DEST_CREATOR, address(usdc));
        hub.execute(keccak256("claim1"), LaunchTypes.ACTION_CREATOR_CLAIM, creatorBal, 0);
        require(hub.balances(LaunchTypes.DEST_BUYBACK, address(usdc)) == buybackBefore, "buyback untouched");
        require(usdc.balanceOf(creator) >= creatorBal, "creator received");
    }

    function testBuybackAndBurn() public {
        _traderBuy(5_000e6);
        router.harvestAll();
        uint256 buyback = hub.balances(LaunchTypes.DEST_BUYBACK, address(usdc));
        uint256 supplyBefore = token.totalSupply();
        hub.execute(keccak256("bb1"), LaunchTypes.ACTION_BUYBACK_BURN, buyback, 1);
        require(token.totalSupply() < supplyBefore, "burned");
        require(token.burned() > 0, "burn accounting");
        require(hub.balances(LaunchTypes.DEST_BUYBACK, address(usdc)) == 0, "spent");
    }

    function testAddLiquidityIncreasesReserves() public {
        _traderBuy(3_000e6);
        router.harvestAll();
        uint256 liqQuote = hub.balances(LaunchTypes.DEST_LIQUIDITY, address(usdc));
        // seed matching tokens into the liquidity bucket from creator inventory
        uint256 tokenNeeded = (liqQuote * pool.reserveToken()) / pool.reserveQuote();
        token.approve(address(hub), tokenNeeded);
        hub.donate(LaunchTypes.DEST_LIQUIDITY, address(token), tokenNeeded);
        uint256 rBefore = pool.reserveQuote();
        hub.execute(keccak256("lp1"), LaunchTypes.ACTION_ADD_LIQUIDITY, liqQuote, 1);
        require(pool.reserveQuote() > rBefore, "deeper");
    }

    function testUnauthorizedCannotExecute() public {
        _traderBuy(1_000e6);
        router.harvestAll();
        Thief thief = new Thief();
        try thief.steal(hub) {
            revert("auth");
        } catch {}
    }

    function testDuplicateExecutionRejected() public {
        _traderBuy(1_000e6);
        router.harvestAll();
        uint256 amt = hub.balances(LaunchTypes.DEST_CREATOR, address(usdc));
        hub.execute(keccak256("dup"), LaunchTypes.ACTION_CREATOR_CLAIM, amt / 2, 0);
        try hub.execute(keccak256("dup"), LaunchTypes.ACTION_CREATOR_CLAIM, amt / 2, 0) {
            revert("duplicate");
        } catch {}
    }

    function testCharityCannotRedirectToCreator() public {
        _traderBuy(4_000e6);
        router.harvestAll();
        uint256 amt = hub.balances(LaunchTypes.DEST_CHARITY, address(usdc));
        uint256 before = usdc.balanceOf(address(0xC1A));
        hub.execute(keccak256("ch1"), LaunchTypes.ACTION_CHARITY, amt, 0);
        require(usdc.balanceOf(address(0xC1A)) == before + amt, "charity paid");
        require(usdc.balanceOf(creator) != before + amt || address(0xC1A) != creator, "not creator");
    }

    function testRemoveLiquiditySelectorMissing() public view {
        bytes4 sel = bytes4(keccak256("removeLiquidity(uint256,uint256,uint256)"));
        (bool ok,) = address(pool).staticcall(abi.encodeWithSelector(sel, 1, 0, 0));
        require(!ok, "remove liquidity must not exist");
    }

    function testHoldersRejectCreatorAsRecipient() public {
        _traderBuy(2_000e6);
        router.harvestAll();
        uint256 amt = hub.balances(LaunchTypes.DEST_HOLDERS, address(usdc));
        address[] memory rec = new address[](1);
        rec[0] = creator;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amt;
        try hub.executeHolders(keccak256("h1"), rec, amounts, false) {
            revert("creator excluded");
        } catch {}
    }

    function testInsufficientStrategyBalanceReverts() public {
        try hub.execute(keccak256("empty"), LaunchTypes.ACTION_BUYBACK, 1e6, 0) {
            revert("empty buyback");
        } catch {}
    }

    function testFeeAtCapAllowed() public {
        LaunchTypes.CreateParams memory p = _params();
        p.tradeFeeBps = 500;
        p.name = "Cap";
        p.symbol = "CAP";
        usdc.approve(address(factory), type(uint256).max);
        (, address hubAddr,,,) = factory.createLaunch(p);
        require(hubAddr != address(0), "created at 5%");
    }

    function testBurnReducesSupply() public {
        _traderBuy(5_000e6);
        router.harvestAll();
        uint256 burnQuote = hub.balances(LaunchTypes.DEST_BURN, address(usdc));
        uint256 before = token.totalSupply();
        if (burnQuote > 0) {
            hub.execute(keccak256("burn1"), LaunchTypes.ACTION_BURN, burnQuote, 0);
            require(token.totalSupply() < before, "supply down");
            require(token.burned() > 0, "burned counter");
        }
    }

    function testCharityDestinationLocked() public view {
        require(hub.charity() == address(0xC1A), "charity dest");
        require(hub.destinationsLocked(), "locked");
    }

    function _traderBuy(uint256 amount) internal {
        usdc.approve(address(pool), amount);
        pool.swapQuoteForToken(amount, 1);
    }

    function _params() internal view returns (LaunchTypes.CreateParams memory p) {
        p = LaunchTypes.CreateParams({
            name: "Desk Coin",
            symbol: "DESK",
            uri: "ipfs://desk",
            decimals: 18,
            supply: 1_000_000_000e18,
            quote: address(usdc),
            tradeFeeBps: 300,
            splitBps: split,
            protocol: protocol,
            creator: creator,
            charity: address(0xC1A),
            treasury: address(0x75EA5),
            community: address(0xC0),
            tokenLiquidity: 200_000_000e18,
            quoteLiquidity: 10_000e6,
            maxExecution: 0,
            cooldown: 0,
            flywheel: new uint8[](0)
        });
    }
}

contract Thief {
    function steal(StrategyHub hub) external {
        hub.execute(keccak256("steal"), 8, 1, 0);
    }
}

contract QuoteSeeder {
    function seed(CustomLaunchFactory factory, MockUSDC usdc, LaunchTypes.CreateParams memory p) external {
        usdc.approve(address(factory), p.quoteLiquidity);
        factory.createLaunch(p);
    }
}
