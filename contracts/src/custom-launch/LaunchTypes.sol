pragma solidity ^0.8.26;

/// @notice Shared Custom Launch types. Isolated from Normal Launch Chapter contracts.
library LaunchTypes {
    uint16 public constant MAX_TRADE_FEE_BPS = 500;
    uint16 public constant SPLIT_TOTAL_BPS = 10_000;
    uint16 public constant PROTOCOL_SHARE_BPS = 2_500;

    uint8 public constant DEST_PROTOCOL = 0;
    uint8 public constant DEST_CREATOR = 1;
    uint8 public constant DEST_HOLDERS = 2;
    uint8 public constant DEST_LIQUIDITY = 3;
    uint8 public constant DEST_BUYBACK = 4;
    uint8 public constant DEST_BURN = 5;
    uint8 public constant DEST_CHARITY = 6;
    uint8 public constant DEST_TREASURY = 7;
    uint8 public constant DEST_COMMUNITY = 8;
    uint8 public constant DEST_COUNT = 9;

    uint8 public constant ACTION_BUYBACK = 1;
    uint8 public constant ACTION_BURN = 2;
    uint8 public constant ACTION_BUYBACK_BURN = 3;
    uint8 public constant ACTION_ADD_LIQUIDITY = 4;
    uint8 public constant ACTION_CHARITY = 5;
    uint8 public constant ACTION_TREASURY = 6;
    uint8 public constant ACTION_COMMUNITY = 7;
    uint8 public constant ACTION_CREATOR_CLAIM = 8;
    uint8 public constant ACTION_HOLDERS = 9;
    uint8 public constant ACTION_FLYWHEEL = 10;

    struct Split {
        uint16[9] bps;
    }

    struct CreateParams {
        string name;
        string symbol;
        string uri;
        uint8 decimals;
        uint256 supply;
        address quote;
        uint16 tradeFeeBps;
        uint16[9] splitBps;
        address protocol;
        address creator;
        address charity;
        address treasury;
        address community;
        uint256 tokenLiquidity;
        uint256 quoteLiquidity;
        uint256 maxExecution;
        uint32 cooldown;
        uint8[] flywheel;
    }

    error FeeCap();
    error SplitInvalid();
    error ProtocolShareLocked();
    error ZeroAddress();
    error Unauthorized();
    error InsufficientBalance();
    error CooldownActive();
    error Paused();
    error MaxExecution();
    error BadAction();
    error DestinationLocked();
    error NoRemoveLiquidity();
    error Reentrant();
    error DuplicateExecution();
    error Slippage();
    error QuoteMismatch();
}
