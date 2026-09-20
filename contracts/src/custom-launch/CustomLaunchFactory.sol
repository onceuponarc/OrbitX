pragma solidity ^0.8.26;

import {IERC20, SafeERC20} from "../IERC20.sol";
import {LaunchTypes} from "./LaunchTypes.sol";
import {CustomLaunchToken} from "./CustomLaunchToken.sol";
import {CustomLaunchPool} from "./CustomLaunchPool.sol";
import {FeeRouter} from "./FeeRouter.sol";
import {StrategyHub} from "./StrategyHub.sol";

contract CustomLaunchFactory {
    using SafeERC20 for IERC20;

    address public owner;
    bool public paused;
    uint256 public launches;

    mapping(uint256 => address) public hubOf;
    mapping(address => uint256) public idOf;

    event LaunchCreated(
        uint256 indexed id,
        address indexed creator,
        address hub,
        address token,
        address pool,
        address router,
        uint16 tradeFeeBps
    );

    constructor(address owner_) {
        owner = owner_ == address(0) ? msg.sender : owner_;
    }

    function setPaused(bool paused_) external {
        if (msg.sender != owner) revert LaunchTypes.Unauthorized();
        paused = paused_;
    }

    function createLaunch(LaunchTypes.CreateParams calldata p)
        external
        returns (uint256 id, address hubAddr, address tokenAddr, address poolAddr, address routerAddr)
    {
        if (paused) revert LaunchTypes.Paused();
        if (p.tradeFeeBps > LaunchTypes.MAX_TRADE_FEE_BPS) revert LaunchTypes.FeeCap();
        if (p.protocol == address(0) || p.creator == address(0) || p.quote == address(0)) revert LaunchTypes.ZeroAddress();
        if (p.supply == 0 || p.tokenLiquidity == 0 || p.quoteLiquidity == 0) revert LaunchTypes.InsufficientBalance();
        if (p.tokenLiquidity >= p.supply) revert LaunchTypes.InsufficientBalance();
        _validateSplit(p.splitBps);

        StrategyHub hub = new StrategyHub(address(this), p.creator, p.protocol);
        CustomLaunchToken token = new CustomLaunchToken(p.name, p.symbol, p.decimals, p.uri, p.supply, address(hub));
        FeeRouter router = new FeeRouter(address(hub), p.protocol, address(token), p.quote, p.splitBps);
        CustomLaunchPool pool = new CustomLaunchPool(address(token), p.quote, address(router), address(hub), p.tradeFeeBps);
        hub.bind(
            address(token),
            p.quote,
            address(pool),
            address(router),
            p.charity,
            p.treasury,
            p.community,
            p.maxExecution,
            p.cooldown,
            p.flywheel
        );
        SafeERC20.pull(IERC20(p.quote), msg.sender, address(hub), p.quoteLiquidity);
        hub.seed(p.tokenLiquidity, p.quoteLiquidity, p.creator);

        id = ++launches;
        hubAddr = address(hub);
        tokenAddr = address(token);
        poolAddr = address(pool);
        routerAddr = address(router);
        hubOf[id] = hubAddr;
        idOf[hubAddr] = id;
        emit LaunchCreated(id, p.creator, hubAddr, tokenAddr, poolAddr, routerAddr, p.tradeFeeBps);
    }

    function pauseHub(address hub, bool paused_) external {
        if (msg.sender != owner) revert LaunchTypes.Unauthorized();
        StrategyHub(hub).setPaused(paused_);
    }

    function _validateSplit(uint16[9] calldata split) internal pure {
        uint256 sum;
        for (uint8 i; i < LaunchTypes.DEST_COUNT; i++) sum += split[i];
        if (sum != LaunchTypes.SPLIT_TOTAL_BPS) revert LaunchTypes.SplitInvalid();
        if (split[LaunchTypes.DEST_PROTOCOL] != LaunchTypes.PROTOCOL_SHARE_BPS) revert LaunchTypes.ProtocolShareLocked();
    }
}
