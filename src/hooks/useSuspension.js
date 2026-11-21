import { useCallback, useEffect, useState } from "react";
import { getToken } from "../services/http.js";
import { getSuspension } from "../services/sellerApi.js";

// Whether the seller's current shop is suspended, asked from the server and refreshed now and then.
export default function useSuspension(shopId) {
  const [state, setState] = useState({ loading: true, suspended: false });

  const refresh = useCallback(async () => {
    if (!shopId || !getToken("seller")) return;
    try {
      const data = await getSuspension(shopId);
      setState({ loading: false, ...data });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [shopId]);

  useEffect(() => {
    setState({ loading: true, suspended: false });
    refresh();
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  return { ...state, refresh };
}
