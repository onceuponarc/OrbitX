pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {CustomLaunchFactory} from "../src/custom-launch/CustomLaunchFactory.sol";

/// Deploy the Custom Launch factory. Isolated from Normal Launch ChapterFactory.
contract DeployCustomLaunch is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("CUSTOM_LAUNCH_OWNER", vm.addr(pk));
        vm.startBroadcast(pk);
        CustomLaunchFactory factory = new CustomLaunchFactory(owner);
        vm.stopBroadcast();
        console2.log("CUSTOM_LAUNCH_FACTORY", address(factory));
        console2.log("OWNER", owner);
    }
}
