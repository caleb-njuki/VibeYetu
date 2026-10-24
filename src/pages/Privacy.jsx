// DRAFT. Have your supervisor or a lawyer review this text, and fill in the three
// [bracketed] items, before real users sign up.
const SECTIONS = [
  {
    title: "1. Who we are",
    text: "VibeYetu is a marketplace that holds buyers' money in escrow until an order is confirmed. For questions about your data, write to [add your contact email here].",
  },
  {
    title: "2. What we collect",
    list: [
      "Buyers: your phone number, the area you shop from, and your orders and ratings.",
      "Sellers: your full name, national ID number, phone number, email, and, if you have them, your KRA PIN and business registration details. Also your shop details and, later, your payout details.",
      "How you use the site, for example orders, reports and messages to support, so we can run escrow and settle disputes.",
    ],
  },
  {
    title: "3. Why we collect it",
    list: [
      "To run escrow: hold payments, release them and send refunds.",
      "To verify sellers and protect buyers from fraud.",
      "To investigate and answer fraud claims, disputes and legal requests. This is why we keep seller identity details.",
      "To contact you about your orders and your account.",
    ],
  },
  {
    title: "4. Your consent",
    text: "We only collect what we need for the reasons above. Sellers agree to this at sign-up, with a separate tick box, and we record when and which version of our terms they accepted.",
  },
  {
    title: "5. Who can see it",
    list: [
      "Buyers and other sellers never see a seller's ID number, KRA PIN or phone number.",
      "Only authorised VibeYetu support staff can see seller verification details, and only to do their work.",
      "Payment providers receive only what they need to process a payment.",
      "We share information with the police or a court only when the law requires it.",
      "We do not sell your personal data.",
    ],
  },
  {
    title: "6. How long we keep it",
    text: "We keep your details while your account is active. After an account closes we keep seller verification details for [add the period, for example 12 months] so we can answer fraud or legal claims, then delete them.",
  },
  {
    title: "7. How we protect it",
    text: "Passwords are stored in a scrambled form, never as plain text. Identity details are kept to a small group of staff. Changes to payout details need a one-time code (OTP).",
  },
  {
    title: "8. Your rights",
    text: "Under the Data Protection Act, 2019, you may ask to see the data we hold about you, correct it, ask us to delete it, or withdraw your consent. Some seller details must be kept while a fraud or legal claim is open. If you are unhappy with how we handled your data, you may complain to the Office of the Data Protection Commissioner.",
  },
];

export default function Privacy() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pt-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold">Privacy policy</h1>
        <p className="text-ink-soft">How VibeYetu collects, uses and protects your information.</p>
        <p role="note" className="rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
          Draft for review. Replace the [bracketed] items and have it checked before launch.
        </p>
      </div>
      {SECTIONS.map((s) => (
        <section key={s.title} className="space-y-1.5 rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-lg font-extrabold">{s.title}</h2>
          {s.text && <p className="text-sm text-ink-soft">{s.text}</p>}
          {s.list && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
              {s.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
