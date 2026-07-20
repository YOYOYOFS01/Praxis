export interface PurchaseIntent {
  runId: string;
  prompt: string;
  vendorName: string;
  itemDescription: string;
  quantity: number;
  unitPriceUsd: number;
  totalAmountUsd: number;
  currency: "USDC" | "USD";
  requestedAt: string; // ISO 8601
}

export interface VendorQuote {
  vendorName: string;
  itemDescription: string;
  quantity: number;
  unitPriceUsd: number;
  totalAmountUsd: number;
  quoteId: string;
  validUntil: string;
  paymentAddress: string; // EVM address
}
