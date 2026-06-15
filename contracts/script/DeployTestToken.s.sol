// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/TestToken.sol";
import "../src/PrediktaMarket.sol";

contract DeployTestToken is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.envAddress("DEPLOYER_ADDRESS");
        address market      = vm.envAddress("MARKET_ADDRESS");

        vm.startBroadcast(deployerKey);

        TestToken token = new TestToken();

        // Habilitar en el contrato de mercado
        PrediktaMarket(market).setAllowedToken(address(token), true);

        // Mintear 100 tUSDm al deployer
        token.mint(deployer, 100 * 10 ** 18);

        vm.stopBroadcast();

        console.log("TestToken deployed at:", address(token));
    }
}
