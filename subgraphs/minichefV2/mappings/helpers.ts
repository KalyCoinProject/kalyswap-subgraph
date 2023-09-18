/* eslint-disable prefer-const */
import {BigInt, BigDecimal, Address} from '@graphprotocol/graph-ts'
import {ERC20} from '../generated/Factory/ERC20'
import {ERC20SymbolBytes} from '../generated/Factory/ERC20SymbolBytes'
import {ERC20NameBytes} from '../generated/Factory/ERC20NameBytes'
import {BI_0, BI_1, BD_1, BD_10} from './constants'

export const ROUTER_ADDRESS = "0x183F288BF7EEBe1A3f318F4681dF4a70ef32B2f3";
export const WKLC_ADDRESS = "0x069255299Bb729399f3CECaBdc73d15d3D10a2A3";
export const KSWAP_ADDRESS = "0xCC93b84cEed74Dc28c746b7697d6fA477ffFf65a";
export const WKLC_DECIMALS = 18;
export const KSWAP_DECIMALS = 18;
export let BI_MINIMUM_LIQUIDITY = BigInt.fromI32(1000)

export let STAKING_DESTINATIONS = "0xDbfD50b15cE8249AE736cEB259927E77fEc231bF";

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BD_1
  for (let i = BI_0; i.lt(decimals as BigInt); i = i.plus(BI_1)) {
      bd = bd.times(BD_10)
  }
  return bd
}

export function convertTokenToDecimal(
  tokenAmount: BigInt,
  exchangeDecimals: BigInt
): BigDecimal {
  if (exchangeDecimals == BI_0) {
      return tokenAmount.toBigDecimal()
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals))
}

export function isNullEthValue(value: string): boolean {
  return (
      value ==
      '0x0000000000000000000000000000000000000000000000000000000000000001'
  )
}

export function _fetchTokenSymbol(tokenAddress: Address): string {
 
  if (tokenAddress.toHexString() == WKLC_ADDRESS) return 'WKLC'; 
  if (tokenAddress.toHexString() == KSWAP_ADDRESS) return 'KSWAP';

  let contract = ERC20.bind(tokenAddress)
  let contractSymbolBytes = ERC20SymbolBytes.bind(tokenAddress)

  // try types string and bytes32 for symbol
  let symbolValue = 'unknown'
  let symbolResult = contract.try_symbol()
  if (symbolResult.reverted) {
      let symbolResultBytes = contractSymbolBytes.try_symbol()
      if (!symbolResultBytes.reverted) {
          // for broken pairs that have no symbol function exposed
          if (!isNullEthValue(symbolResultBytes.value.toHexString())) {
              symbolValue = symbolResultBytes.value.toString()
          }
      }
  } else {
      symbolValue = symbolResult.value
  }

  return symbolValue
}

export function _fetchTokenName(tokenAddress: Address): string {

  if (tokenAddress.toHexString() == WKLC_ADDRESS) return 'WKLC';
  if (tokenAddress.toHexString() == KSWAP_ADDRESS) return 'KSWAP';

  let contract = ERC20.bind(tokenAddress)
  let contractNameBytes = ERC20NameBytes.bind(tokenAddress)

  // try types string and bytes32 for name
  let nameValue = 'unknown'
  let nameResult = contract.try_name()
  if (nameResult.reverted) {
      let nameResultBytes = contractNameBytes.try_name()
      if (!nameResultBytes.reverted) {
          // for broken exchanges that have no name function exposed
          if (!isNullEthValue(nameResultBytes.value.toHexString())) {
              nameValue = nameResultBytes.value.toString()
          }
      }
  } else {
      nameValue = nameResult.value
  }

  return nameValue
}

export function _fetchTokenDecimals(tokenAddress: Address): BigInt | null {

  if (tokenAddress.toHexString() == WKLC_ADDRESS) return BigInt.fromI32(WKLC_DECIMALS);
  if (tokenAddress.toHexString() == KSWAP_ADDRESS) return BigInt.fromI32(KSWAP_DECIMALS);

  let contract = ERC20.bind(tokenAddress)
  // try types uint8 for decimals
  let decimalResult = contract.try_decimals()
  if (decimalResult.reverted) {
      return null
  } else {
      return BigInt.fromI32(decimalResult.value)
  }
}

