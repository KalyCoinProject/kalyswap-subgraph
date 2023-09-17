/* eslint-disable prefer-const */
import { Pair, Token, Bundle } from '../types/schema'
import { BigDecimal, Address, BigInt } from '@graphprotocol/graph-ts/index'
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD } from './helpers'

const WKLC_ADDRESS = '0x069255299Bb729399f3CECaBdc73d15d3D10a2A3'
const USDT_WKLC_PAIR = '0x37eA64bB4D58b6513C80bEFA5Dc777080AD62EB9' // created block 7,227,954
const DAI_WKLC_PAIR = '0xd8AaCB9a2084f73c53C4Edb5633bfA01124669F6' // created block 7,243,398

let AVERAGE_KLC_PRICE_PRE_STABLES = BigDecimal.fromString('30')
let USDT_WKLC_PAIR_BLOCK = BigInt.fromI32(7227954);
let DAI_WKLC_PAIR_BLOCK = BigInt.fromI32(7243398);

export function getKLCPriceInUSD(blockNumber: BigInt): BigDecimal {

  if (blockNumber.gt(DAI_WKLC_PAIR_BLOCK)) { // WKLC-DAI & WKLC-USDT exist

    let daiPair = Pair.load(DAI_WKLC_PAIR) // DAI is token1
    let usdtPair = Pair.load(USDT_WKLC_PAIR) // USDT is token1

    let totalLiquidityWKLC = daiPair.reserve0.plus(usdtPair.reserve0)
    let daiWeight = daiPair.reserve0.div(totalLiquidityWKLC)
    let usdtWeight = usdtPair.reserve0.div(totalLiquidityWKLC)

    return daiPair.token1Price.times(daiWeight).plus(usdtPair.token1Price.times(usdtWeight))

  } else if (blockNumber.gt(USDT_WKLC_PAIR_BLOCK)) { // WKLC-USDT & WKLC-DAI exist

    let usdtPair = Pair.load(USDT_WKLC_PAIR) // USDT is token1

    return usdtPair.token1Price

  } else { /* No stable pairs exist */

    return AVERAGE_KLC_PRICE_PRE_STABLES

  }

}

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  WKLC_ADDRESS, // WKLC
  '0xcc93b84ceed74dc28c746b7697d6fa477ffff65a', // KSWAP
  '0x37540f0cc489088c01631138da2e32cf406b83b8', // USDT
  '0xc2afb6efca0f6b10f3da80bec20dc8de0ddb689d', // DAI
  '0xad89ea57db2092b66641e732f51adf483ac18c21', // ETH
  '0xd0731970ccfec3eb25c16e956f0b6902fba75b69', // WBTC
  '0xff97974fcefd3c6e04c7a6f3c4fa971c4a18f762', // USDC (native)
]

// minimum liquidity required to count towards tracked volume for pairs with small # of Lps
let MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal.fromString('1000')

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_ETH = BigDecimal.fromString('1')

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WKLC_ADDRESS) {
    return ONE_BD
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]))
    if (pairAddress.toHexString() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHexString())
      if (pair.token0 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token1 = Token.load(pair.token1)
        return pair.token1Price.times(token1.derivedETH as BigDecimal) // return token1 per our token * Eth per token 1
      }
      if (pair.token1 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token0 = Token.load(pair.token0)
        return pair.token0Price.times(token0.derivedETH as BigDecimal) // return token0 per our token * ETH per token 0
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

  // if less than 5 LPs, require high minimum reserve amount amount or return 0
  if (pair.liquidityProviderCount.lt(BigInt.fromI32(5))) {
    let reserve0USD = pair.reserve0.times(price0)
    let reserve1USD = pair.reserve1.times(price1)
    if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve0USD.plus(reserve1USD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
    if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
      if (reserve0USD.times(BigDecimal.fromString('2')).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
    if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve1USD.times(BigDecimal.fromString('2')).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
  }

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0
      .times(price0)
      .plus(tokenAmount1.times(price1))
      .div(BigDecimal.fromString('2'))
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
  token1: Token
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedETH.times(bundle.ethPrice)
  let price1 = token1.derivedETH.times(bundle.ethPrice)

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1))
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString('2'))
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString('2'))
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}
