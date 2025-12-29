// lib/xahau-payload.ts
import { XummTypes } from "xumm-sdk"

/**
 * Build a standardized Xaman payment payload for the Xahau network.
 *
 * Although the SDK class is still named `XummSdk`, Xaman is the correct
 * branding for all developer-facing code and environment variables.
 *
 * @param amount - Amount in XAH (float or integer)
 * @param destination - Destination wallet address (rAddress)
 * @param memo - Optional memo string (appears in transaction metadata)
 *
 * @returns Typed payload body for `xaman.payload.create()`
 */
export function buildXahauPaymentPayload(
  amount: number,
  destination: string,
  memo: string = "xMerch Payment"
): XummTypes.XummPostPayloadBodyJson {
  if (!destination) {
    throw new Error("Destination address is required to create a payment payload.")
  }

  const drops = Math.round(Number(amount) * 1_000_000)
  if (Number.isNaN(drops)) {
    throw new Error("Amount must be a valid number.")
  }

  const networkId = Number.parseInt(
    process.env.NEXT_PUBLIC_XAHAU_NETWORK_ID || "21337",
    10
  )

  return {
    txjson: {
      TransactionType: "Payment",
      Destination: destination,
      Amount: String(drops), // XAH → drops
      NetworkID: networkId,
      Memos: [
        {
          Memo: {
            MemoData: Buffer.from(memo, "utf8").toString("hex"),
          },
        },
      ],
    },
    options: {
      submit: true,
      expire: 300, // 5 mins
    },
    custom_meta: {
      instruction: memo,
      identifier: "xmerch_xahau_payment",
    },
  }
}
