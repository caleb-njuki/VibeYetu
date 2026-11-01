import { useEffect, useState } from "react";
import DeliveryFee from "../../components/DeliveryFee.jsx";
import PayoutMethods from "../../components/PayoutMethods.jsx";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { getShop } from "../../services/api.js";

// The Payments tab of My Shop: where the seller gets paid, and the delivery fee the shop charges.
export default function SellerPayments() {
  const { seller } = useSeller();
  const [delivers, setDelivers] = useState(null);

  useEffect(() => {
    let live = true;
    getShop(seller.shopId)
      .then((s) => {
        if (live) setDelivers(Boolean(s?.fulfillment?.includes("delivery")));
      })
      .catch(() => {
        if (live) setDelivers(true);
      });
    return () => {
      live = false;
    };
  }, [seller.shopId]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold">Payments</h1>
        <p className="text-sm text-ink-mute">How you get paid, and what you charge for delivery.</p>
      </div>
      <PayoutMethods email={seller.email} shopId={seller.shopId} />
      {delivers === null ? (
        <div className="h-48 animate-pulse rounded-2xl bg-ivory-dark" aria-busy="true" />
      ) : (
        <DeliveryFee shopId={seller.shopId} delivers={delivers} />
      )}
    </div>
  );
}
