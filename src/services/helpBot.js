// Temporary canned answers for the help desk. We will replace getReply()
// with a call to a real AI model on the backend later.
const topics = [
  {
    keys: ["24 hours", "72", "not received", "did not arrive", "didn't arrive", "arrive late", "support", "haikufika", "haijafika", "imechelewa", "saa 24", "saa 72"],
    en: "If 24 hours pass after the seller accepts and the order is not finished, you and the seller each answer a short form about what happened. Our support team reviews it within 72 hours, often much faster. Your money stays safe in escrow until then. If it is cleared, you get your refund.",
    sw: "Saa 24 zikipita baada ya muuzaji kukubali na oda haijakamilika, wewe na muuzaji mnajaza fomu fupi kuhusu kilichotokea. Timu yetu ya msaada inakagua ndani ya saa 72, mara nyingi haraka zaidi. Pesa zako zinabaki salama kwenye escrow hadi hapo. Ikiidhinishwa, unarudishiwa pesa.",
  },
  {
    keys: ["refund", "money back", "cashback", "rudisha", "rudishiwa", "reject"],
    en: "Refunds on VibeYetu:\n- If a seller rejects your order before it leaves, you get everything back, including the delivery fee.\n- If you reject a faulty or wrong item when it arrives, return it to the shop. Once the seller confirms it is back, the item price is refunded. The delivery fee is not refunded.\nTap Request refund on your order page to start.",
    sw: "Kurudishiwa pesa VibeYetu:\n- Muuzaji akikataa oda kabla haijatoka, unarudishiwa kila kitu, pamoja na gharama ya usafirishaji.\n- Ukikataa bidhaa mbovu au isiyo sahihi ikifika, irudishe dukani. Muuzaji akithibitisha imerudi, unarudishiwa bei ya bidhaa. Gharama ya usafirishaji hairudishwi.\nBonyeza \"Request refund\" kwenye ukurasa wa oda yako.",
  },
  {
    keys: ["code", "msimbo", "receipt", "risiti"],
    en: "When the seller agrees to your order, a receipt code is created. The seller enters it when your item leaves. When it arrives, check it, then enter the same code on your order page. Only then is the seller paid. Do not enter the code before you have checked the item.",
    sw: "Muuzaji akikubali oda yako, msimbo wa risiti huundwa. Muuzaji anauingiza bidhaa inapotoka. Ikifika, ikague, kisha ingiza msimbo huo kwenye ukurasa wa oda yako. Ndipo muuzaji analipwa. Usiingize msimbo kabla ya kukagua bidhaa.",
  },
  {
    keys: ["legit", "genuine", "scam", "fake", "verify", "verified", "halali", "kuaminika", "tapeli", "feki"],
    en: "To check a shop:\n- Look for the verified mark on the shop page.\n- Read ratings and reviews from other buyers.\n- Check the shop's town and how long it has been selling.\nSellers give identity, phone and payout details before they can sell. Always pay on VibeYetu, never outside it, so escrow protects you.",
    sw: "Kuangalia duka:\n- Tafuta alama ya uthibitisho kwenye ukurasa wa duka.\n- Soma ukadiriaji na maoni ya wanunuzi wengine.\n- Angalia mji wa duka na muda lililouza.\nWauzaji hutoa vitambulisho, simu na maelezo ya malipo kabla ya kuuza. Lipa kila mara ndani ya VibeYetu, si nje, ili escrow ikulinde.",
  },
  {
    keys: ["mpesa", "m-pesa", "pay", "lipa", "stk", "card", "kadi"],
    en: "You can pay with M-Pesa or a debit/credit card. For M-Pesa, enter your number at checkout and approve the prompt on your phone with your PIN. Your money is held in escrow, not sent to the seller yet.",
    sw: "Unaweza kulipa kwa M-Pesa au kadi. Kwa M-Pesa, weka namba yako ukilipa kisha thibitisha kwenye simu yako kwa PIN. Pesa zako zinashikiliwa kwenye escrow, hazijatumwa kwa muuzaji bado.",
  },
  {
    keys: ["deliver", "delivery", "pickup", "pick up", "track", "usafirishaji", "kufikishiwa", "kuchukua"],
    en: "Each shop chooses delivery, pickup or both. You see the option on the product page and pick one at checkout. If you order from several shops, you may get separate packages.",
    sw: "Kila duka huchagua kuleta bidhaa, kuchukuliwa dukani, au vyote. Utaona chaguo kwenye ukurasa wa bidhaa na kuchagua ukilipa. Ukinunua kutoka maduka kadhaa, unaweza kupata vifurushi tofauti.",
  },
  {
    keys: ["escrow", "safe", "salama", "how it works", "inafanya", "protect"],
    en: "Escrow keeps your money safe:\n1. You pay and we hold the money.\n2. You receive and inspect the item.\n3. You and the seller both enter the receipt code.\n4. Only then is the seller paid.",
    sw: "Escrow inalinda pesa zako:\n1. Unalipa na sisi tunashikilia pesa.\n2. Unapokea na kukagua bidhaa.\n3. Wewe na muuzaji mnaingiza msimbo wa risiti.\n4. Ndipo muuzaji analipwa.",
  },
];

const fallback = {
  en: "I'm not sure about that yet. Try asking about checking a shop, refunds, payments, delivery or the receipt code.",
  sw: "Sijaelewa vizuri bado. Jaribu kuuliza kuhusu kukagua duka, kurudishiwa pesa, malipo, usafirishaji au msimbo wa risiti.",
};

export async function getReply(text, lang = "en") {
  await new Promise((resolve) => setTimeout(resolve, 600));
  const q = text.toLowerCase();
  const hit = topics.find((t) => t.keys.some((k) => q.includes(k)));
  return hit ? hit[lang] : fallback[lang];
}
