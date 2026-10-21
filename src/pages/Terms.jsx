const SECTIONS = [
  {
    title: "1. Escrow",
    text: "When a buyer pays, VibeYetu holds the money. The seller is paid only after the buyer confirms they received the item by entering the receipt code.",
  },
  {
    title: "2. The seller's promise",
    text: "A seller must agree to fulfil an order within the time they choose before the order is accepted. Once they agree, a receipt code is created for the order.",
  },
  {
    title: "3. The receipt code",
    text: "The seller enters the code when the item leaves for delivery or pickup. The buyer then receives and inspects the item and enters the same code. The payment is released when the buyer has entered the code. Buyers must not enter the code before checking the item.",
  },
  {
    title: "4. Rejections and returns",
    text: "A seller may reject an order before dispatching it. A buyer may reject an item that is faulty, wrong, damaged or not as described when it arrives. A rejected item is returned to the seller, who confirms the return in My Shop. Stock then updates automatically.",
  },
  {
    title: "5. Refunds",
    text: "After a rejection, the buyer can request a refund to the account they paid from. If the seller rejects before dispatch, the buyer gets everything back, including the delivery fee. If the buyer rejects an item after it was dispatched, the item price is refunded once the return is confirmed. The delivery fee is not refunded.",
  },
  {
    title: "6. The 24-hour window",
    text: "From the moment the seller accepts an order, the buyer and the seller have 24 hours to complete the code steps. If this is not done in time, both must answer a short form to tell us what happened.",
  },
  {
    title: "7. Support review",
    text: "Our support team reviews the answers within 72 hours after the 24-hour window ends. Many cases are cleared within an hour or less. The money stays in escrow until the review is done. If the case is cleared in the buyer's favour, a refund is made. Otherwise the payment is released to the seller.",
  },
  {
    title: "8. Your responsibilities",
    text: "Give accurate information, keep your receipt code private until it is needed, and complete all payments and arrangements on VibeYetu. Payments made outside VibeYetu are not protected by escrow.",
  },
];

export default function Terms() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pt-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold">Terms of use</h1>
        <p className="text-ink-soft">
          These rules apply to everyone who buys or sells on VibeYetu. By signing in or creating an account, you agree to them.
        </p>
      </div>
      {SECTIONS.map((s) => (
        <section key={s.title} className="space-y-1.5 rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-lg font-extrabold">{s.title}</h2>
          <p className="text-sm text-ink-soft">{s.text}</p>
        </section>
      ))}
    </div>
  );
}
