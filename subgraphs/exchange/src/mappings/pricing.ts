/* eslint-disable prefer-const */
import {BigDecimal} from '@graphprotocol/graph-ts'
import {Pair, Token, Bundle, PairLookup} from '../types/schema'
import {WKLC_ADDRESS} from './helpers'
import {ADDRESS_ZERO, BD_0, BD_1, BD_2} from './constants'

export function getKLCPriceInUSD(): BigDecimal {
  let pair: Pair | null

  // StablePairs KLC/USDT and KLC/DAI
  let usdtPair = "0x37eA64bB4D58b6513C80bEFA5Dc777080AD62EB9";
  let daiPair = "0xd8AaCB9a2084f73c53C4Edb5633bfA01124669F6";

  // Check the first address
  pair = Pair.load(usdtPair);
  if (pair != null) {
      return pair.token0 == WKLC_ADDRESS ? pair.token1Price : pair.token0Price;
  }

  // Check the second address
  pair = Pair.load(daiPair);
  if (pair != null) {
      return pair.token0 == WKLC_ADDRESS ? pair.token1Price : pair.token0Price;
  }

  return BD_0;
}

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  "0x069255299Bb729399f3CECaBdc73d15d3D10a2A3", // WKLC
  "0xCC93b84cEed74Dc28c746b7697d6fA477ffFf65a", // KSWAP
  "0xFF97974fcEfD3C6E04C7a6f3C4FA971c4A18F762", // USDC
  "0x37540F0cC489088c01631138Da2E32cF406B83B8", // USDt
  "0xC2AFb6EFca0F6b10f3da80bEc20Dc8DE0DdB689D", // DAI
]

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_KLC = BigDecimal.fromString('1')

/**
 * Search through graph to find derived Klc per token.
 * @todo update to be derived KLC (add stablecoin estimates)
 **/
export function findKlcPerToken(token: Token): BigDecimal {
    if (token.id == WKLC_ADDRESS) {
        return BD_1
    }
    // loop through whitelist and check if paired with any
    for (let i = 0; i < WHITELIST.length; ++i) {
        let pairLookup = PairLookup.load(token.id.concat('-').concat(WHITELIST[i]))
        let pairAddress = pairLookup == null ? ADDRESS_ZERO : pairLookup.pairAddress.toHexString()

        if (pairAddress != ADDRESS_ZERO) {
            let pair = Pair.load(pairAddress)!
            if (pair.token0 == token.id && pair.reserveKLC.gt(MINIMUM_LIQUIDITY_THRESHOLD_KLC)) {
                let token1 = Token.load(pair.token1)!
                return pair.token1Price.times(token1.derivedKLC as BigDecimal) // return token1 per our token * Klc per token 1
            }
            if (pair.token1 == token.id && pair.reserveKLC.gt(MINIMUM_LIQUIDITY_THRESHOLD_KLC)) {
                let token0 = Token.load(pair.token0)!
                return pair.token0Price.times(token0.derivedKLC as BigDecimal) // return token0 per our token * KLC per token 0
            }
        }
    }
    return BD_0 // nothing was found return 0
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
    token1: Token
): BigDecimal {
    let price0 = token0.derivedUSD as BigDecimal
    let price1 = token1.derivedUSD as BigDecimal

    // both are whitelist tokens, take average of both amounts
    if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
        return tokenAmount0
            .times(price0)
            .plus(tokenAmount1.times(price1))
            .div(BD_2)
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
    return BD_0
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
    let bundle = Bundle.load('1')!
    let price0 = token0.derivedKLC.times(bundle.klcPrice)
    let price1 = token1.derivedKLC.times(bundle.klcPrice)

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
    return BD_0
}
