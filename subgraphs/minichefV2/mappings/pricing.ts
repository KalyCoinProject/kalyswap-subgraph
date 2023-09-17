/* eslint-disable prefer-const */
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { Pair, Token, Bundle, PairCache } from '../generated/schema'
import { ZERO_BD, ONE_BD, TWO_BD } from './helpers'

const WKLC_ADDRESS = '0x069255299Bb729399f3CECaBdc73d15d3D10a2A3'
const USDT_WKLC_PAIR = '0x37eA64bB4D58b6513C80bEFA5Dc777080AD62EB9' // created block 7,227,954
const DAI_WKLC_PAIR = '0xd8AaCB9a2084f73c53C4Edb5633bfA01124669F6' // created block 7,243,398

let AVERAGE_KLC_PRICE_PRE_STABLES = BigDecimal.fromString('30')
let USDT_WKLC_PAIR_BLOCK = BigInt.fromI32(7227954);
let DAI_WKLC_PAIR_BLOCK = BigInt.fromI32(7243398);

export function getKLCPriceInUSD(blockNumber: BigInt): BigDecimal {

  if (blockNumber.gt(DAI_WKLC_PAIR_BLOCK)) { // WKLC-USDT & WKLC-DAI exist

    let usdtPair = Pair.load(USDT_WKLC_PAIR) // USDT is token1
    let daiPair = Pair.load(DAI_WKLC_PAIR) // DAI is token1

    let totalLiquidityWKLC = usdtPair.reserve0.plus(daiPair.reserve0)
    let usdtWeight = usdtPair.reserve0.div(totalLiquidityWKLC)
    let daiWeight = daiPair.reserve0.div(totalLiquidityWKLC)

    return usdtPair.token1Price.times(usdtWeight).plus(daiPair.token1Price.times(daiWeight))

  } else if (blockNumber.gt(USDT_WKLC_PAIR_BLOCK)) { // WKLC-USDT exists

    let usdtPair = Pair.load(USDT_WKLC_PAIR) // USDT is token1

    return usdtPair.token1Price

  } else { /* No stable pairs exist */

    return AVERAGE_KLC_PRICE_PRE_STABLES

  }

}

// token where amounts should contribute to tracked volume and liquidity
// tokens listed earlier take precedence for selecting a pair for valuation
// all addresses MUST be lowercase
let WHITELIST: string[] = [
  WKLC_ADDRESS, // WKLC
  '0xcc93b84ceed74dc28c746b7697d6fa477ffff65a', // KSWAP
  '0xff97974fcefd3c6e04c7a6f3c4fa971c4a18f762', // USDC (native)
  '0x37540f0cc489088c01631138da2e32cf406b83b8', // USDT
  '0xc2afb6efca0f6b10f3da80bec20dc8de0ddb689d', // DAI
  '0xad89ea57db2092b66641e732f51adf483ac18c21', // ETH
  '0xd0731970ccfec3eb25c16e956f0b6902fba75b69', // WBTC
]

// minimum liquidity required to count towards tracked volume for pairs with small # of Lps
let MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal.fromString('1000')

// minimum liquidity for price to get tracked
let MINIMUM_USD_LIQUIDITY_THRESHOLD = BigDecimal.fromString('1000')

/**
 * Search through graph to find derived Eth per token.
 **/
export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WKLC_ADDRESS) {
    return ONE_BD
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairCache = PairCache.load(token.id + WHITELIST[i])
    if (pairCache !== null) {
      let pair = Pair.load(pairCache.pair)
      if (pair.reserveUSD.gt(MINIMUM_USD_LIQUIDITY_THRESHOLD)) {
        if (pair.token0 == token.id) {
          let token1 = Token.load(pair.token1)
          return pair.token1Price.times(token1.derivedETH as BigDecimal) // return token1 per our token * KLC per token 1
        }
        if (pair.token1 == token.id) {
          let token0 = Token.load(pair.token0)
          return pair.token0Price.times(token0.derivedETH as BigDecimal) // return token0 per our token * KLC per token 0
        }
      }
    }
  }
  return ZERO_BD // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  pair: Pair
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedETH.times(bundle.ethPrice)
  let price1 = token1.derivedETH.times(bundle.ethPrice)

  // if less than 5 LPs, require high minimum reserve amount or return 0
  if (pair.liquidityProviderCount.lt(BigInt.fromI32(5))) {
    let reserve0USD = pair.reserve0.times(price0)
    let reserve1USD = pair.reserve1.times(price1)
    if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve0USD.plus(reserve1USD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
    if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
      if (reserve0USD.times(TWO_BD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
    if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve1USD.times(TWO_BD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
  }

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0
      .times(price0)
      .plus(tokenAmount1.times(price1))
      .div(TWO_BD)
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0)
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1)
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  KLCPrice: BigDecimal
): BigDecimal {
  let price0 = token0.derivedETH.times(KLCPrice)
  let price1 = token1.derivedETH.times(KLCPrice)

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1))
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(TWO_BD)
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(TWO_BD)
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}
