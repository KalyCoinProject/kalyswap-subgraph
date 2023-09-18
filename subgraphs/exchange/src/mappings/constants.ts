import {BigDecimal, BigInt} from '@graphprotocol/graph-ts'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

// BigInt
export let BI_0 = BigInt.fromI32(0)
export let BI_1 = BigInt.fromI32(1)
export let BI_18 = BigInt.fromI32(18)
export let BI_1000 = BigInt.fromI32(1000)

// BigDecimal
export let BD_0 = BigDecimal.zero()
export let BD_1 = BigDecimal.fromString('1')
export let BD_2 = BigDecimal.fromString('2')
export let BD_10 = BigDecimal.fromString('10')