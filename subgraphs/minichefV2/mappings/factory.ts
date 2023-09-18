/* eslint-disable prefer-const */
import {log} from "@graphprotocol/graph-ts";
import {KalyswapFactory, Pair, PairLookup, Token, Bundle} from "../generated/schema";
import { PairCreated } from "../generated/Factory/Factory";
import { Pair as PairTemplate } from '../generated/templates'
import {
  _fetchTokenSymbol,
  _fetchTokenName,
  _fetchTokenDecimals
} from './helpers'
import {BD_0, BI_0} from './constants'

export function handleNewPair(event: PairCreated): void {
  // load factory (create if first exchange)
  let factory = KalyswapFactory.load('1')
  if (factory === null) {
      factory = new KalyswapFactory('1')
      factory.pairCount = 0
      factory.totalVolumeKLC = BD_0
      factory.totalLiquidityKLC = BD_0
      factory.totalVolumeUSD = BD_0
      factory.untrackedVolumeUSD = BD_0
      factory.totalLiquidityUSD = BD_0
      factory.txCount = BI_0

      let bundle = new Bundle('1')
      bundle.klcPrice = BD_0
      bundle.save()
  }
  factory.pairCount = factory.pairCount + 1
  factory.save()

  // fetch info if null
  let token0 = Token.load(event.params.token0.toHexString())
  if (token0 === null) {
      token0 = new Token(event.params.token0.toHexString())
      token0.symbol = _fetchTokenSymbol(event.params.token0)
      token0.name = _fetchTokenName(event.params.token0)

      let decimals = _fetchTokenDecimals(event.params.token0)
      if (decimals === null) {
          log.debug('null decimals for token0', [])
          return
      }

      token0.decimals = decimals
      token0.derivedKLC = BD_0
      token0.derivedUSD = BD_0
      token0.tradeVolume = BD_0
      token0.tradeVolumeUSD = BD_0
      token0.untrackedVolumeUSD = BD_0
      token0.totalLiquidity = BD_0
      token0.txCount = BI_0

      token0.save()
  }

  // fetch info if null
  let token1 = Token.load(event.params.token1.toHexString())
  if (token1 === null) {
      token1 = new Token(event.params.token1.toHexString())
      token1.symbol = _fetchTokenSymbol(event.params.token1)
      token1.name = _fetchTokenName(event.params.token1)

      let decimals = _fetchTokenDecimals(event.params.token1)
      if (decimals === null) {
          log.debug('null decimals for token1', [])
          return
      }

      token1.decimals = decimals
      token1.derivedKLC = BD_0
      token1.derivedUSD = BD_0
      token1.tradeVolume = BD_0
      token1.tradeVolumeUSD = BD_0
      token1.untrackedVolumeUSD = BD_0
      token1.totalLiquidity = BD_0
      token1.txCount = BI_0

      token1.save()
  }

  let pair = new Pair(event.params.pair.toHexString()) as Pair
  pair.token0 = token0.id
  pair.token1 = token1.id
  pair.createdAtTimestamp = event.block.timestamp
  pair.createdAtBlockNumber = event.block.number
  pair.txCount = BI_0
  pair.reserve0 = BD_0
  pair.reserve1 = BD_0
  pair.trackedReserveKLC = BD_0
  pair.reserveKLC = BD_0
  pair.reserveUSD = BD_0
  pair.totalSupply = BI_0
  pair.volumeToken0 = BD_0
  pair.volumeToken1 = BD_0
  pair.volumeUSD = BD_0
  pair.untrackedVolumeUSD = BD_0
  pair.token0Price = BD_0
  pair.token1Price = BD_0
  pair.save()

  // create pair lookup and reverse lookup
  let pairLookupIdAB = event.params.token0.toHexString().concat('-').concat(event.params.token1.toHexString())
  let pairLookupAB = new PairLookup(pairLookupIdAB)
  pairLookupAB.pairAddress = event.params.pair
  pairLookupAB.save()
  let pairLookupIdBA = event.params.token1.toHexString().concat('-').concat(event.params.token0.toHexString())
  let pairLookupBA = new PairLookup(pairLookupIdBA)
  pairLookupBA.pairAddress = event.params.pair
  pairLookupBA.save()

  // create the tracked contract based on the template
  PairTemplate.create(event.params.pair)
}
