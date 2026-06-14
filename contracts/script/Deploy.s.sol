// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrediktaMarket.sol";

contract DeployPredikta is Script {
    // Celo Mainnet token addresses
    address constant USDm = 0x765DE816845861e75A25fCA122bb6898B8B1282a; // USDm (ex-cUSD)
    address constant USDC = 0xcebA9300f2b948710d2653dD7B07f33A8B32118C;
    address constant USDT = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;

    function run() external {
        address treasury  = vm.envAddress("TREASURY_ADDRESS");
        address deployer  = vm.envAddress("DEPLOYER_ADDRESS");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        PrediktaMarket market = new PrediktaMarket(treasury);

        // Allow all three Celo stablecoins
        market.setAllowedToken(USDm, true);
        market.setAllowedToken(USDC, true);
        market.setAllowedToken(USDT, true);

        // Backend resolver (Server Action address)
        address resolver = vm.envAddress("RESOLVER_ADDRESS");
        market.setResolver(resolver, true);

        vm.stopBroadcast();

        console.log("PrediktaMarket deployed at:", address(market));
        console.log("Treasury:", treasury);
        console.log("Resolver:", resolver);
        console.log("Deployer:", deployer);
    }
}
