pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {CustomLaunchFactory} from "../src/custom-launch/CustomLaunchFactory.sol";
import {CustomLaunchPool} from "../src/custom-launch/CustomLaunchPool.sol";
import {CustomLaunchToken} from "../src/custom-launch/CustomLaunchToken.sol";
import {FeeRouter} from "../src/custom-launch/FeeRouter.sol";
import {StrategyHub} from "../src/custom-launch/StrategyHub.sol";
import {LaunchTypes} from "../src/custom-launch/LaunchTypes.sol";
import {MockUSDC} from "../test/MockUSDC.sol";

contract ExerciseCustomLaunch is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address creator = vm.addr(pk);
        address protocol = address(0xA11CE);
        address trader = vm.addr(uint256(0xB0B));

        vm.startBroadcast(pk);
        CustomLaunchFactory factory = new CustomLaunchFactory(creator);
        MockUSDC usdc = new MockUSDC();
        usdc.mint(creator, 1_000_000e6);
        usdc.mint(trader, 50_000e6);
        payable(trader).transfer(1 ether);
        usdc.approve(address(factory), type(uint256).max);

        uint16[9] memory split;
        split[0] = 2500;
        split[1] = 2500;
        split[2] = 1500;
        split[3] = 1500;
        split[4] = 1000;
        split[5] = 500;
        split[6] = 200;
        split[7] = 200;
        split[8] = 100;

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
        vm.stopBroadcast();

        StrategyHub hub = StrategyHub(hubAddr);
        CustomLaunchToken token = CustomLaunchToken(tokenAddr);
        CustomLaunchPool pool = CustomLaunchPool(poolAddr);
        FeeRouter router = FeeRouter(routerAddr);

        vm.startBroadcast(uint256(0xB0B));
        usdc.approve(address(pool), 5_000e6);
        pool.swapQuoteForToken(5_000e6, 1);
        vm.stopBroadcast();

        vm.startBroadcast(pk);
        router.harvestAll();
        uint256 buyback = hub.balances(LaunchTypes.DEST_BUYBACK, address(usdc));
        uint256 creatorBal = hub.balances(LaunchTypes.DEST_CREATOR, address(usdc));
        hub.execute(keccak256("claim-local"), LaunchTypes.ACTION_CREATOR_CLAIM, creatorBal, 0);
        uint256 supplyBefore = token.totalSupply();
        hub.execute(keccak256("bb-local"), LaunchTypes.ACTION_BUYBACK_BURN, buyback, 1);
        vm.stopBroadcast();

        console2.log("FACTORY", address(factory));
        console2.log("HUB", hubAddr);
        console2.log("TOKEN", tokenAddr);
        console2.log("POOL", poolAddr);
        console2.log("ROUTER", routerAddr);
        console2.log("BUYBACK_BURNED", token.burned());
        console2.log("SUPPLY_BEFORE", supplyBefore);
        console2.log("SUPPLY_AFTER", token.totalSupply());
        console2.log("CREATOR_FEES", creatorBal);
        console2.log("RESERVE_QUOTE", pool.reserveQuote());
    }
}
