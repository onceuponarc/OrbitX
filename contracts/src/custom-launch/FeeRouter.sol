pragma solidity ^0.8.26;

import {IERC20, SafeERC20} from "../IERC20.sol";
import {LaunchTypes} from "./LaunchTypes.sol";
import {StrategyHub} from "./StrategyHub.sol";

/// @notice Splits accrued trading fees into protocol, creator, and strategy vaults.
contract FeeRouter {
    using SafeERC20 for IERC20;

    address public immutable hub;
    address public immutable protocol;
    IERC20 public immutable token;
    IERC20 public immutable quote;
    uint16[9] public splitBps;
    bool private locked;

    event Harvested(address indexed asset, uint256 amount, uint8 dest, uint256 share);

    modifier lock() {
        if (locked) revert LaunchTypes.Reentrant();
        locked = true;
        _;
        locked = false;
    }

    constructor(address hub_, address protocol_, address token_, address quote_, uint16[9] memory splitBps_) {
        if (hub_ == address(0) || protocol_ == address(0) || token_ == address(0) || quote_ == address(0)) {
            revert LaunchTypes.ZeroAddress();
        }
        _validate(splitBps_);
        hub = hub_;
        protocol = protocol_;
        token = IERC20(token_);
        quote = IERC20(quote_);
        splitBps = splitBps_;
    }

    function harvest(address asset) public lock {
        IERC20 erc = IERC20(asset);
        if (address(erc) != address(token) && address(erc) != address(quote)) revert LaunchTypes.QuoteMismatch();
        uint256 bal = erc.balanceOf(address(this));
        if (bal == 0) return;
        uint256 used;
        for (uint8 i; i < LaunchTypes.DEST_COUNT; i++) {
            uint256 share = i == LaunchTypes.DEST_COUNT - 1 ? bal - used : (bal * splitBps[i]) / LaunchTypes.SPLIT_TOTAL_BPS;
            if (share == 0) continue;
            used += share;
            if (i == LaunchTypes.DEST_PROTOCOL) {
                SafeERC20.push(erc, protocol, share);
            } else {
                SafeERC20.push(erc, hub, share);
                StrategyHub(hub).credit(i, address(erc), share);
            }
            emit Harvested(asset, bal, i, share);
        }
    }

    function harvestAll() external {
        harvest(address(quote));
        harvest(address(token));
    }

    function _validate(uint16[9] memory split) internal pure {
        uint256 sum;
        for (uint8 i; i < LaunchTypes.DEST_COUNT; i++) sum += split[i];
        if (sum != LaunchTypes.SPLIT_TOTAL_BPS) revert LaunchTypes.SplitInvalid();
        if (split[LaunchTypes.DEST_PROTOCOL] != LaunchTypes.PROTOCOL_SHARE_BPS) revert LaunchTypes.ProtocolShareLocked();
    }
}
