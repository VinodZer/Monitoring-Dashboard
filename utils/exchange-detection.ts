export type ExchangeCode = "NSE" | "BSE" | "NFO" | "BFO" | "CDS" | "BCD" | "MCX"

export function getDefaultDpltpDuration(exchange: ExchangeCode): number {
  switch (exchange) {
    case "NSE":
    case "BSE":
    case "NFO":
    case "BFO":
      return 15
    case "MCX":
      return 180
    case "CDS":
    case "BCD":
      return 300
    default:
      return 60
  }
}

export function getExchangeFromName(instrumentName: string): ExchangeCode {
  const name = instrumentName.toUpperCase()

  if (
    name.includes("USD") ||
    name.includes("EUR") ||
    name.includes("GBP") ||
    name.includes("JPY") ||
    name.includes("INR")
  ) {
    return "CDS"
  }

  if (
    name.includes("CRUDE") ||
    name.includes("GOLD") ||
    name.includes("SILVER") ||
    name.includes("COPPER") ||
    name.includes("ZINC") ||
    name.includes("ALUMINIUM") ||
    name.includes("LEAD") ||
    name.includes("NICKEL") ||
    name.includes("NATURALGAS")
  ) {
    return "MCX"
  }

  const isDerivative =
    name.includes("FUT") || /(?:^|[^A-Z])(CE|PE)(?:$)/.test(name) || /\d{2}[A-Z]{3}(FUT|CE|PE)/.test(name)
  if (isDerivative) {
    return name.includes("SENSEX") ? "BFO" : "NFO"
  }

  if (name.includes("SENSEX")) return "BSE"
  if (name.includes("NIFTY")) return "NSE"

  if (name.includes("BSE")) return "BSE"
  if (name.includes("BFO")) return "BFO"
  if (name.includes("NFO")) return "NFO"

  return "NSE"
}
