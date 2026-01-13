export type XahauNetwork = "mainnet" | "testnet"

export const DEFAULT_NETWORK: XahauNetwork =
  (process.env.NEXT_PUBLIC_DEFAULT_XAHAU_NETWORK as XahauNetwork) || "mainnet"

export function getXahauNetworkFromEnvOrDefault(): XahauNetwork {
  const env = (process.env.NEXT_PUBLIC_XAHAU_NETWORK as XahauNetwork | undefined) || undefined
  return env === "testnet" || env === "mainnet" ? env : DEFAULT_NETWORK
}

export function getXahauNetworkId(network: XahauNetwork): number {
  return network === "testnet" ? 21338 : 21337
}

export function getXahauRpcUrl(network: XahauNetwork): string {
  const testnet = process.env.NEXT_PUBLIC_XAHAU_TESTNET_RPC || "wss://xahau-test.net:51234"
  const mainnet = process.env.NEXT_PUBLIC_XAHAU_MAINNET_RPC || "wss://xahau.network"
  return network === "testnet" ? testnet : mainnet
}

export function getHookAddress(network: XahauNetwork): string | undefined {
  const testnet = process.env.NEXT_PUBLIC_HOOK_ADDRESS_TESTNET
  const mainnet = process.env.NEXT_PUBLIC_HOOK_ADDRESS
  return network === "testnet" ? testnet : mainnet
}

