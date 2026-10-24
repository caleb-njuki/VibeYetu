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
  {
    title: "9. Shop names and branches (sellers)",
    text: "A shop name works like a username, so each shop on VibeYetu has a unique name. You may not copy or imitate another shop's name or use a misleading one. One seller may open several shops, for example branches in different towns. Each branch needs its own unique name, such as the main name followed by the town. We may ask you to change a name that is misleading or abusive.",
  },
  {
    title: "10. Seller details and fraud protection (sellers)",
    text: "To open a shop you give us your full name, national ID number, phone number and, if you have them, your KRA PIN and business registration details. You confirm that these are true and belong to you. We use them to verify sellers and to respond to fraud claims and legal requests. We do not show them to buyers or other sellers. Our Privacy policy explains how we keep them and your rights.",
  },
  {
    title: "11. Your account (sellers)",
    text: "Keep your password private. You are responsible for what happens in your My Shop account and in every branch under it. Tell us at once if you think someone else has used your account.",
  },
  {
    title: "12. Answering orders on time",
    text: "A seller must agree to fulfil or reject a paid order within 1 hour. If the seller does not answer in time, the order is cancelled and the buyer is refunded in full, including the delivery fee. That order counts as unfulfilled.",
  },
  {
    title: "13. Suspension (sellers)",
    text: "An order is unfulfilled when the seller does not answer in time, rejects it after agreeing to fulfil it, or never dispatches it before the 24-hour window ends (unless support decides in the seller's favour). If 3 orders in a row are unfulfilled, the shop is suspended automatically and buyers can no longer see it. The seller is told to write a report explaining what happened. The shop stays suspended until the report is received and support has verified it. A completed order resets the count. Orders already in progress can still be completed while a shop is suspended.",
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
