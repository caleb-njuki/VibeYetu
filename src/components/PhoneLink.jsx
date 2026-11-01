import { Phone } from "lucide-react";
import { displayPhone, telHref } from "../lib/contacts.js";

// A phone number that opens the dialler when tapped. `phone` is a normalized number like 254712345678.
export default function PhoneLink({ phone, className = "" }) {
  if (!phone) return null;
  return (
    <a
      href={telHref(phone)}
      className={`inline-flex items-center gap-1.5 font-semibold text-vibe hover:underline ${className}`}
      aria-label={`Call ${displayPhone(phone)}`}
    >
      <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
      {displayPhone(phone)}
    </a>
  );
}
