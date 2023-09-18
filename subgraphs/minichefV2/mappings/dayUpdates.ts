/* eslint-disable prefer-const */
import {Pair, PairHourData} from '../generated/schema'
import {BigInt, BigDecimal, ethereum} from '@graphprotocol/graph-ts'
import {Bundle, Token, KalyswapFactory, KalyswapDayData, PairDayData, TokenDayData} from '../generated/schema'
import {BI_1, BD_0, BI_0} from './constants'

export function updateKalyswapDayData(event: ethereum.Event): KalyswapDayData {
    let kalyswap = KalyswapFactory.load('1')!
    let timestamp = event.block.timestamp.toI32()
    let dayID = timestamp / 86400
    let dayStartTimestamp = dayID * 86400
    let kalyswapDayData = KalyswapDayData.load(dayID.toString())
    if (kalyswapDayData === null) {
        kalyswapDayData = new KalyswapDayData(dayID.toString())
        kalyswapDayData.date = dayStartTimestamp
        kalyswapDayData.dailyVolumeUSD = BD_0
        kalyswapDayData.dailyVolumeKLC = BD_0
        kalyswapDayData.totalVolumeUSD = BD_0
        kalyswapDayData.totalVolumeKLC = BD_0
        kalyswapDayData.dailyVolumeUntracked = BD_0
    }

    kalyswapDayData.totalLiquidityUSD = kalyswap.totalLiquidityUSD
    kalyswapDayData.totalLiquidityKLC = kalyswap.totalLiquidityKLC
    kalyswapDayData.txCount = kalyswap.txCount
    kalyswapDayData.save()

    return kalyswapDayData as KalyswapDayData
}

export function updatePairDayData(event: ethereum.Event): PairDayData {
    let timestamp = event.block.timestamp.toI32()
    let dayID = timestamp / 86400
    let dayStartTimestamp = dayID * 86400
    let dayPairID = event.address
        .toHexString()
        .concat('-')
        .concat(BigInt.fromI32(dayID).toString())
    let pair = Pair.load(event.address.toHexString())!
    let pairDayData = PairDayData.load(dayPairID)
    if (pairDayData === null) {
        pairDayData = new PairDayData(dayPairID)
        pairDayData.date = dayStartTimestamp
        pairDayData.token0 = pair.token0
        pairDayData.token1 = pair.token1
        pairDayData.pairAddress = event.address
        pairDayData.dailyVolumeToken0 = BD_0
        pairDayData.dailyVolumeToken1 = BD_0
        pairDayData.dailyVolumeUSD = BD_0
        pairDayData.dailyTxns = BI_0
    }

    pairDayData.totalSupply = pair.totalSupply
    pairDayData.reserve0 = pair.reserve0
    pairDayData.reserve1 = pair.reserve1
    pairDayData.reserveUSD = pair.reserveUSD
    pairDayData.dailyTxns = pairDayData.dailyTxns.plus(BI_1)
    pairDayData.save()

    return pairDayData as PairDayData
}

export function updatePairHourData(event: ethereum.Event): PairHourData {
    let timestamp = event.block.timestamp.toI32()
    let hourIndex = timestamp / 3600 // get unique hour within unix history
    let hourStartUnix = hourIndex * 3600 // want the rounded effect
    let hourPairID = event.address
        .toHexString()
        .concat('-')
        .concat(BigInt.fromI32(hourIndex).toString())
    let pair = Pair.load(event.address.toHexString())!
    let pairHourData = PairHourData.load(hourPairID)
    if (pairHourData === null) {
        pairHourData = new PairHourData(hourPairID)
        pairHourData.hourStartUnix = hourStartUnix
        pairHourData.pair = pair.id
        pairHourData.hourlyVolumeToken0 = BD_0
        pairHourData.hourlyVolumeToken1 = BD_0
        pairHourData.hourlyVolumeUSD = BD_0
        pairHourData.hourlyTxns = BI_0
    }

    pairHourData.reserve0 = pair.reserve0
    pairHourData.reserve1 = pair.reserve1
    pairHourData.reserveUSD = pair.reserveUSD
    pairHourData.hourlyTxns = pairHourData.hourlyTxns.plus(BI_1)
    pairHourData.save()

    return pairHourData as PairHourData
}

export function updateTokenDayData(token: Token, event: ethereum.Event): TokenDayData {
    let bundle = Bundle.load('1')!
    let timestamp = event.block.timestamp.toI32()
    let dayID = timestamp / 86400
    let dayStartTimestamp = dayID * 86400
    let tokenDayID = token.id
        .toString()
        .concat('-')
        .concat(BigInt.fromI32(dayID).toString())

    let tokenDayData = TokenDayData.load(tokenDayID)
    if (tokenDayData === null) {
        tokenDayData = new TokenDayData(tokenDayID)
        tokenDayData.date = dayStartTimestamp
        tokenDayData.token = token.id
        tokenDayData.priceUSD = token.derivedKLC.times(bundle.klcPrice)
        tokenDayData.dailyVolumeToken = BD_0
        tokenDayData.dailyVolumeKLC = BD_0
        tokenDayData.dailyVolumeUSD = BD_0
        tokenDayData.dailyTxns = BI_0
        tokenDayData.totalLiquidityUSD = BD_0
    }
    tokenDayData.priceUSD = token.derivedKLC.times(bundle.klcPrice)
    tokenDayData.totalLiquidityToken = token.totalLiquidity
    tokenDayData.totalLiquidityKLC = token.totalLiquidity.times(token.derivedKLC as BigDecimal)
    tokenDayData.totalLiquidityUSD = tokenDayData.totalLiquidityKLC.times(bundle.klcPrice)
    tokenDayData.dailyTxns = tokenDayData.dailyTxns.plus(BI_1)
    tokenDayData.save()

    return tokenDayData as TokenDayData
}
