import { Client, Wallet } from 'xrpl'

const HOOK_ADDRESS = process.env.NEXT_PUBLIC_HOOK_ADDRESS!
const XAHAU_WSS = 'wss://xahau.network'

// Read tournament state from hook
export async function getTournamentState(tournamentId: string) {
  const client = new Client(XAHAU_WSS)
  await client.connect()
  
  const response = await client.request({
    command: 'account_namespace',
    account: HOOK_ADDRESS,
    namespace_id: hashTournamentId(tournamentId)
  })
  
  await client.disconnect()
  return decodeTournamentState(response)
}

// Send signal to hook
export async function joinTournamentOnChain(
  playerWallet: Wallet,
  paymentHash: string,
  tournamentSize: number
) {
  const client = new Client(XAHAU_WSS)
  await client.connect()
  
  const tx = {
    TransactionType: 'Payment',
    Account: playerWallet.address,
    Destination: HOOK_ADDRESS,
    Amount: '1', // 1 drop signal
    Memos: [{
      Memo: {
        MemoType: Buffer.from('join_tournament').toString('hex'),
        MemoData: Buffer.from(JSON.stringify({
          payment_hash: paymentHash,
          tournament_size: tournamentSize
        })).toString('hex')
      }
    }]
  }
  
  const signed = playerWallet.sign(tx)
  const result = await client.submitAndWait(signed.tx_blob)
  
  await client.disconnect()
  return result
}