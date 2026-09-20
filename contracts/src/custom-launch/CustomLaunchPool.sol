pragma solidity ^0.8.26;

import {IERC20, SafeERC20} from "../IERC20.sol";
import {LaunchTypes} from "./LaunchTypes.sol";

/// @notice Add-only constant-product book. No remove / withdraw / drain.
contract CustomLaunchPool {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    IERC20 public immutable quote;
    address public immutable router;
    address public immutable hub;
    uint16 public immutable tradeFeeBps;

    uint256 public reserveToken;
    uint256 public reserveQuote;
    uint256 public liquidityUnits;
    bool private locked;

    event Swap(address indexed trader, bool quoteIn, uint256 amountIn, uint256 amountOut, uint256 fee);
    event LiquidityAdded(address indexed from, uint256 tokenIn, uint256 quoteIn, uint256 units);

    modifier lock() {
        if (locked) revert LaunchTypes.Reentrant();
        locked = true;
        _;
        locked = false;
    }

    constructor(address token_, address quote_, address router_, address hub_, uint16 tradeFeeBps_) {
        if (token_ == address(0) || quote_ == address(0) || router_ == address(0) || hub_ == address(0)) {
            revert LaunchTypes.ZeroAddress();
        }
        if (tradeFeeBps_ > LaunchTypes.MAX_TRADE_FEE_BPS) revert LaunchTypes.FeeCap();
        token = IERC20(token_);
        quote = IERC20(quote_);
        router = router_;
        hub = hub_;
        tradeFeeBps = tradeFeeBps_;
    }

    function addLiquidity(uint256 tokenIn, uint256 quoteIn, uint256 minUnits) external lock returns (uint256 units) {
        if (tokenIn == 0 || quoteIn == 0) revert LaunchTypes.InsufficientBalance();
        SafeERC20.pull(token, msg.sender, address(this), tokenIn);
        SafeERC20.pull(quote, msg.sender, address(this), quoteIn);
        if (liquidityUnits == 0) {
            units = _sqrt(tokenIn * quoteIn);
        } else {
            uint256 fromToken = (tokenIn * liquidityUnits) / reserveToken;
            uint256 fromQuote = (quoteIn * liquidityUnits) / reserveQuote;
            units = fromToken < fromQuote ? fromToken : fromQuote;
        }
        if (units < minUnits || units == 0) revert LaunchTypes.Slippage();
        reserveToken += tokenIn;
        reserveQuote += quoteIn;
        liquidityUnits += units;
        emit LiquidityAdded(msg.sender, tokenIn, quoteIn, units);
    }

    function swapQuoteForToken(uint256 amountIn, uint256 minOut) external lock returns (uint256 amountOut) {
        amountOut = _swap(true, amountIn, minOut);
    }

    function swapTokenForQuote(uint256 amountIn, uint256 minOut) external lock returns (uint256 amountOut) {
        amountOut = _swap(false, amountIn, minOut);
    }

    function quoteOut(bool quoteIn, uint256 amountIn) public view returns (uint256 amountOut, uint256 fee) {
        fee = (amountIn * tradeFeeBps) / LaunchTypes.SPLIT_TOTAL_BPS;
        uint256 effectiveIn = amountIn - fee;
        if (quoteIn) {
            amountOut = (effectiveIn * reserveToken) / (reserveQuote + effectiveIn);
        } else {
            amountOut = (effectiveIn * reserveQuote) / (reserveToken + effectiveIn);
        }
    }

    function _swap(bool quoteIn, uint256 amountIn, uint256 minOut) internal returns (uint256 amountOut) {
        if (amountIn == 0) revert LaunchTypes.InsufficientBalance();
        (uint256 out, uint256 fee) = quoteOut(quoteIn, amountIn);
        if (out < minOut || out == 0) revert LaunchTypes.Slippage();
        if (quoteIn) {
            SafeERC20.pull(quote, msg.sender, address(this), amountIn);
            if (fee > 0) SafeERC20.push(quote, router, fee);
            SafeERC20.push(token, msg.sender, out);
            reserveQuote += (amountIn - fee);
            reserveToken -= out;
        } else {
            SafeERC20.pull(token, msg.sender, address(this), amountIn);
            if (fee > 0) SafeERC20.push(token, router, fee);
            SafeERC20.push(quote, msg.sender, out);
            reserveToken += (amountIn - fee);
            reserveQuote -= out;
        }
        emit Swap(msg.sender, quoteIn, amountIn, out, fee);
        return out;
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
