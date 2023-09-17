/* eslint-disable prefer-const */
import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { Pair, Token, KalyswapFactory, Bundle } from "../generated/schema";
import { Sync, Transfer } from "../generated/templates/Pair/Pair";

import {
  getKLCPriceInUSD,
  findEthPerToken,
  getTrackedLiquidityUSD,
} from "./pricing";
import {
  ADDRESS_ZERO,
  BI_18,
  convertTokenToDecimal,
  FACTORY_ADDRESS,
  ZERO_BD,
} from "./helpers";

let MINING_POOLS: string[] = [
  "0xdbfd50b15ce8249ae736ceb259927e77fec231bf", // MiniChefV2

  "0x8fd2755c6ae7252753361991bdcd6ff55bdc01ce", // v1 WKLC-KSWAP

  "0x574d3245e36cf8c9dc86430eadb0fdb2f385f829", // v2 WKLC-KSWAP
];

export function handleTransfer(event: Transfer): void {
  let eventToAsHexString = event.params.to.toHexString();
  let eventFromAsHexString = event.params.from.toHexString();

  // ignore initial transfers for first adds
  if (
    eventToAsHexString == ADDRESS_ZERO &&
    event.params.value.equals(BigInt.fromI32(1000))
  ) {
    return;
  }

  // skip if staking/unstaking
  if (
    MINING_POOLS.includes(eventFromAsHexString) ||
    MINING_POOLS.includes(eventToAsHexString)
  ) {
    return;
  }

  // get pair and load contract
  let pair = Pair.load(event.address.toHexString());

  // liquidity token amount being transferred
  let value = convertTokenToDecimal(event.params.value, BI_18);

  if (eventFromAsHexString == ADDRESS_ZERO) {
    // update total supply
    pair.totalSupply = pair.totalSupply.plus(value);
    pair.save();
  }

  // burn
  if (eventToAsHexString == ADDRESS_ZERO && eventFromAsHexString == pair.id) {
    pair.totalSupply = pair.totalSupply.minus(value);
    pair.save();
  }
}

export function handleSync(event: Sync): void {
  let pair = Pair.load(event.address.toHex());
  let token0 = Token.load(pair.token0);
  let token1 = Token.load(pair.token1);
  let kalyswap = KalyswapFactory.load(FACTORY_ADDRESS);

  // reset factory liquidity by subtracting only tracked liquidity
  kalyswap.totalLiquidityETH = kalyswap.totalLiquidityETH.minus(
    pair.trackedReserveETH
  );

  // reset token total liquidity amounts
  token0.totalLiquidity = token0.totalLiquidity.minus(pair.reserve0);
  token1.totalLiquidity = token1.totalLiquidity.minus(pair.reserve1);

  pair.reserve0 = convertTokenToDecimal(event.params.reserve0, token0.decimals);
  pair.reserve1 = convertTokenToDecimal(event.params.reserve1, token1.decimals);

  if (pair.reserve1.notEqual(ZERO_BD))
    pair.token0Price = pair.reserve0.div(pair.reserve1);
  else pair.token0Price = ZERO_BD;
  if (pair.reserve0.notEqual(ZERO_BD))
    pair.token1Price = pair.reserve1.div(pair.reserve0);
  else pair.token1Price = ZERO_BD;

  pair.save();

  // update ETH price now that reserves could have changed
  let bundle = Bundle.load("1");
  bundle.ethPrice = getKLCPriceInUSD(event.block.number);
  bundle.save();

  token0.derivedETH = findEthPerToken(token0 as Token);
  token0.derivedUSD = token0.derivedETH.times(bundle.ethPrice);
  token1.derivedETH = findEthPerToken(token1 as Token);
  token1.derivedUSD = token1.derivedETH.times(bundle.ethPrice);
  // token0.save() // Not required to save since nothing loads token0 before save() at end of this method
  // token1.save() // Not required to save since nothing loads token1 before save() at end of this method

  // get tracked liquidity - will be 0 if neither is in whitelist
  if (bundle.ethPrice.notEqual(ZERO_BD)) {
    pair.trackedReserveUSD = getTrackedLiquidityUSD(
      pair.reserve0,
      token0 as Token,
      pair.reserve1,
      token1 as Token,
      bundle.ethPrice
    );
    pair.trackedReserveETH = pair.trackedReserveUSD.div(bundle.ethPrice);
  }

  // use derived amounts within pair
  pair.reserveETH = pair.reserve0
    .times(token0.derivedETH as BigDecimal)
    .plus(pair.reserve1.times(token1.derivedETH as BigDecimal));
  pair.reserveUSD = pair.reserveETH.times(bundle.ethPrice);

  // use tracked amounts globally
  kalyswap.totalLiquidityETH = kalyswap.totalLiquidityETH.plus(
    pair.trackedReserveETH
  );
  kalyswap.totalLiquidityUSD = kalyswap.totalLiquidityETH.times(
    bundle.ethPrice
  );

  // now correctly set liquidity amounts for each token
  token0.totalLiquidity = token0.totalLiquidity.plus(pair.reserve0);
  token1.totalLiquidity = token1.totalLiquidity.plus(pair.reserve1);

  // save entities
  pair.save();
  kalyswap.save();
  token0.save();
  token1.save();
}
