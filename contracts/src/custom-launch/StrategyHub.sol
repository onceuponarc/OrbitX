pragma solidity ^0.8.26;

import {IERC20, SafeERC20} from "../IERC20.sol";
import {CustomLaunchToken} from "./CustomLaunchToken.sol";
import {CustomLaunchPool} from "./CustomLaunchPool.sol";
import {LaunchTypes} from "./LaunchTypes.sol";

/// @notice Protocol-controlled strategy vault. Creator may invoke allowed actions only.
contract StrategyHub {
    using SafeERC20 for IERC20;

    address public immutable factory;
    address public immutable creator;
    address public immutable protocol;
    address public charity;
    address public treasury;
    address public community;
    CustomLaunchToken public token;
    IERC20 public quote;
    CustomLaunchPool public pool;
    address public router;

    mapping(uint8 => mapping(address => uint256)) public balances;
    mapping(bytes32 => bool) public usedExecutions;
    uint8[] public flywheel;
    uint256 public maxExecution;
    uint32 public cooldown;
    uint64 public lastExecutedAt;
    bool public paused;
    bool public destinationsLocked;
    bool private locked;

    event Credited(uint8 dest, address asset, uint256 amount);
    event Executed(bytes32 indexed execId, uint8 action, address asset, uint256 amount, uint256 received);
    event Failed(bytes32 indexed execId, uint8 action, string reason);

    modifier lock() {
        if (locked) revert LaunchTypes.Reentrant();
        locked = true;
        _;
        locked = false;
    }

    modifier onlyCreator() {
        if (msg.sender != creator) revert LaunchTypes.Unauthorized();
        _;
    }

    constructor(address factory_, address creator_, address protocol_) {
        if (factory_ == address(0) || creator_ == address(0) || protocol_ == address(0)) revert LaunchTypes.ZeroAddress();
        factory = factory_;
        creator = creator_;
        protocol = protocol_;
    }

    function bind(
        address token_,
        address quote_,
        address pool_,
        address router_,
        address charity_,
        address treasury_,
        address community_,
        uint256 maxExecution_,
        uint32 cooldown_,
        uint8[] memory flywheel_
    ) external {
        if (msg.sender != factory) revert LaunchTypes.Unauthorized();
        if (destinationsLocked) revert LaunchTypes.DestinationLocked();
        token = CustomLaunchToken(token_);
        quote = IERC20(quote_);
        pool = CustomLaunchPool(pool_);
        router = router_;
        charity = charity_;
        treasury = treasury_;
        community = community_;
        maxExecution = maxExecution_;
        cooldown = cooldown_;
        flywheel = flywheel_;
        destinationsLocked = true;
    }

    function seed(uint256 tokenLiquidity, uint256 quoteLiquidity, address creator_) external {
        if (msg.sender != factory) revert LaunchTypes.Unauthorized();
        if (creator_ != creator) revert LaunchTypes.Unauthorized();
        balances[LaunchTypes.DEST_LIQUIDITY][address(quote)] += quoteLiquidity;
        balances[LaunchTypes.DEST_LIQUIDITY][address(token)] += tokenLiquidity;
        _debit(LaunchTypes.DEST_LIQUIDITY, address(quote), quoteLiquidity);
        _debit(LaunchTypes.DEST_LIQUIDITY, address(token), tokenLiquidity);
        token.approve(address(pool), tokenLiquidity);
        quote.approve(address(pool), quoteLiquidity);
        pool.addLiquidity(tokenLiquidity, quoteLiquidity, 1);
        token.approve(address(pool), 0);
        quote.approve(address(pool), 0);
        uint256 rest = token.balanceOf(address(this));
        if (rest > 0) {
            // Circulating remainder goes to the creator as the token, not as a strategy vault.
            SafeERC20.push(IERC20(address(token)), creator, rest);
        }
    }

    function donate(uint8 dest, address asset, uint256 amount) external onlyCreator {
        if (dest == LaunchTypes.DEST_PROTOCOL || dest >= LaunchTypes.DEST_COUNT) revert LaunchTypes.BadAction();
        if (amount == 0) revert LaunchTypes.InsufficientBalance();
        SafeERC20.pull(IERC20(asset), msg.sender, address(this), amount);
        balances[dest][asset] += amount;
        emit Credited(dest, asset, amount);
    }

    function credit(uint8 dest, address asset, uint256 amount) external {
        if (msg.sender != router && msg.sender != factory) revert LaunchTypes.Unauthorized();
        if (dest >= LaunchTypes.DEST_COUNT) revert LaunchTypes.BadAction();
        balances[dest][asset] += amount;
        emit Credited(dest, asset, amount);
    }

    function setPaused(bool paused_) external {
        if (msg.sender != factory) revert LaunchTypes.Unauthorized();
        paused = paused_;
    }

    function execute(bytes32 execId, uint8 action, uint256 amount, uint256 minOut)
        external
        lock
        onlyCreator
        returns (uint256 received)
    {
        if (paused) revert LaunchTypes.Paused();
        if (usedExecutions[execId]) revert LaunchTypes.DuplicateExecution();
        if (amount == 0) revert LaunchTypes.InsufficientBalance();
        if (maxExecution > 0 && amount > maxExecution) revert LaunchTypes.MaxExecution();
        if (cooldown > 0 && lastExecutedAt + cooldown > block.timestamp) revert LaunchTypes.CooldownActive();
        usedExecutions[execId] = true;
        lastExecutedAt = uint64(block.timestamp);
        received = _dispatch(action, amount, minOut);
        emit Executed(execId, action, address(quote), amount, received);
    }

    function executeHolders(bytes32 execId, address[] calldata recipients, uint256[] calldata amounts, bool inToken)
        external
        lock
        onlyCreator
    {
        if (paused) revert LaunchTypes.Paused();
        if (usedExecutions[execId]) revert LaunchTypes.DuplicateExecution();
        if (recipients.length != amounts.length || recipients.length == 0) revert LaunchTypes.BadAction();
        usedExecutions[execId] = true;
        lastExecutedAt = uint64(block.timestamp);
        address asset = inToken ? address(token) : address(quote);
        uint256 total;
        for (uint256 i; i < amounts.length; i++) total += amounts[i];
        _debit(LaunchTypes.DEST_HOLDERS, asset, total);
        for (uint256 i; i < recipients.length; i++) {
            if (recipients[i] == creator) revert LaunchTypes.Unauthorized();
            SafeERC20.push(IERC20(asset), recipients[i], amounts[i]);
        }
        emit Executed(execId, LaunchTypes.ACTION_HOLDERS, asset, total, total);
    }

    function _dispatch(uint8 action, uint256 amount, uint256 minOut) internal returns (uint256 received) {
        if (action == LaunchTypes.ACTION_BUYBACK) return _buyback(amount, minOut, false);
        if (action == LaunchTypes.ACTION_BURN) return _burn(amount);
        if (action == LaunchTypes.ACTION_BUYBACK_BURN) return _buyback(amount, minOut, true);
        if (action == LaunchTypes.ACTION_ADD_LIQUIDITY) return _addLiquidity(amount, minOut);
        if (action == LaunchTypes.ACTION_CHARITY) return _send(LaunchTypes.DEST_CHARITY, charity, amount);
        if (action == LaunchTypes.ACTION_TREASURY) return _send(LaunchTypes.DEST_TREASURY, treasury, amount);
        if (action == LaunchTypes.ACTION_COMMUNITY) return _send(LaunchTypes.DEST_COMMUNITY, community, amount);
        if (action == LaunchTypes.ACTION_CREATOR_CLAIM) return _send(LaunchTypes.DEST_CREATOR, creator, amount);
        if (action == LaunchTypes.ACTION_FLYWHEEL) return _flywheel(amount, minOut);
        revert LaunchTypes.BadAction();
    }

    function _buyback(uint256 amount, uint256 minOut, bool thenBurn) internal returns (uint256 bought) {
        _debit(LaunchTypes.DEST_BUYBACK, address(quote), amount);
        quote.approve(address(pool), amount);
        bought = pool.swapQuoteForToken(amount, minOut);
        quote.approve(address(pool), 0);
        if (thenBurn) {
            token.burn(bought);
            return bought;
        }
        balances[LaunchTypes.DEST_BUYBACK][address(token)] += bought;
    }

    function _burn(uint256 amount) internal returns (uint256) {
        uint256 tokenBal = balances[LaunchTypes.DEST_BURN][address(token)];
        if (tokenBal >= amount) {
            _debit(LaunchTypes.DEST_BURN, address(token), amount);
            token.burn(amount);
            return amount;
        }
        _debit(LaunchTypes.DEST_BURN, address(quote), amount);
        quote.approve(address(pool), amount);
        uint256 bought = pool.swapQuoteForToken(amount, 0);
        quote.approve(address(pool), 0);
        token.burn(bought);
        return bought;
    }

    function _addLiquidity(uint256 quoteAmount, uint256 minUnits) internal returns (uint256 units) {
        uint256 tokenAmount = (quoteAmount * pool.reserveToken()) / pool.reserveQuote();
        _debit(LaunchTypes.DEST_LIQUIDITY, address(quote), quoteAmount);
        if (balances[LaunchTypes.DEST_LIQUIDITY][address(token)] < tokenAmount) {
            revert LaunchTypes.InsufficientBalance();
        }
        _debit(LaunchTypes.DEST_LIQUIDITY, address(token), tokenAmount);
        token.approve(address(pool), tokenAmount);
        quote.approve(address(pool), quoteAmount);
        units = pool.addLiquidity(tokenAmount, quoteAmount, minUnits);
        token.approve(address(pool), 0);
        quote.approve(address(pool), 0);
        // Units stay in the pool forever. No LP token is issued to the creator.
    }

    function _send(uint8 dest, address to, uint256 amount) internal returns (uint256) {
        if (to == address(0)) revert LaunchTypes.ZeroAddress();
        if (dest != LaunchTypes.DEST_CREATOR && to == creator) revert LaunchTypes.Unauthorized();
        _debit(dest, address(quote), amount);
        SafeERC20.push(quote, to, amount);
        return amount;
    }

    function _flywheel(uint256 amount, uint256 minOut) internal returns (uint256 last) {
        if (flywheel.length == 0) revert LaunchTypes.BadAction();
        uint256 slice = amount / flywheel.length;
        if (slice == 0) revert LaunchTypes.InsufficientBalance();
        for (uint256 i; i < flywheel.length; i++) {
            uint8 step = flywheel[i];
            if (step == LaunchTypes.ACTION_FLYWHEEL) revert LaunchTypes.BadAction();
            last = _dispatch(step, slice, minOut);
        }
    }

    function _debit(uint8 dest, address asset, uint256 amount) internal {
        uint256 bal = balances[dest][asset];
        if (bal < amount) revert LaunchTypes.InsufficientBalance();
        balances[dest][asset] = bal - amount;
    }
}
