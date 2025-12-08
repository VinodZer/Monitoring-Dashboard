export type DepthSide = { price: number; quantity?: number; orders?: number }
export type Depth = { buy?: DepthSide[]; sell?: DepthSide[] }

export type TickLike = {
  last_price?: number
  average_price?: number
  depth?: Depth
}

const DEPTH_VALUE_DIVISOR = 30

function extractLevelNumbers(side?: DepthSide[]): number[] {
  if (!side || side.length === 0) return []
  const numbers: number[] = []
  for (const level of side) {
    if (!level) continue
    const { price, orders, quantity } = level
    if (typeof price === "number" && Number.isFinite(price)) numbers.push(price)
    if (typeof orders === "number" && Number.isFinite(orders)) numbers.push(orders)
    if (typeof quantity === "number" && Number.isFinite(quantity)) numbers.push(quantity)
  }
  return numbers
}

function collectDepthNumbers(depth?: Depth): number[] {
  if (!depth) return []
  return [...extractLevelNumbers(depth.buy), ...extractLevelNumbers(depth.sell)]
}

export function calculateDepthAverage(depth?: Depth): number | null {
  const values = collectDepthNumbers(depth)
  if (values.length === 0) return null
  const sum = values.reduce((acc, value) => acc + value, 0)
  const average = sum / DEPTH_VALUE_DIVISOR
  return Number.isFinite(average) ? average : null
}

export function depthPlusLtp(tick: TickLike): number {
  const depthAverage = calculateDepthAverage(tick?.depth)
  if (depthAverage !== null) {
    return depthAverage
  }
  if (typeof tick?.last_price === "number" && Number.isFinite(tick.last_price)) {
    return tick.last_price
  }
  if (typeof tick?.average_price === "number" && Number.isFinite(tick.average_price)) {
    return tick.average_price
  }
  return 0
}
