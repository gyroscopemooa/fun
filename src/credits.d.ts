interface Window {
  manytoolCreditCheckout?: (url: string, init: RequestInit) => Promise<Response>;
  manytoolAiUnavailable?: boolean;
  manytoolShowPaymentChoices?: () => void;
}
