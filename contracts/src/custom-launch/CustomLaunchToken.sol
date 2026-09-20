pragma solidity ^0.8.26;

import {IERC20} from "../IERC20.sol";
import {LaunchTypes} from "./LaunchTypes.sol";

/// @notice Custom Launch token. Minted once at create. Burn is executor-only.
contract CustomLaunchToken is IERC20 {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    uint256 public burned;
    address public immutable hub;
    string public uri;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Burned(address indexed from, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        string memory uri_,
        uint256 supply_,
        address hub_
    ) {
        if (hub_ == address(0)) revert LaunchTypes.ZeroAddress();
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        uri = uri_;
        hub = hub_;
        totalSupply = supply_;
        balanceOf[hub_] = supply_;
        emit Transfer(address(0), hub_, supply_);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        _move(from, to, amount);
        return true;
    }

    function burn(uint256 amount) external {
        if (msg.sender != hub) revert LaunchTypes.Unauthorized();
        uint256 bal = balanceOf[hub];
        if (bal < amount) revert LaunchTypes.InsufficientBalance();
        unchecked {
            balanceOf[hub] = bal - amount;
            totalSupply -= amount;
            burned += amount;
        }
        emit Transfer(hub, address(0), amount);
        emit Burned(hub, amount);
    }

    function _move(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert LaunchTypes.ZeroAddress();
        uint256 bal = balanceOf[from];
        if (bal < amount) revert LaunchTypes.InsufficientBalance();
        unchecked {
            balanceOf[from] = bal - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }
}
