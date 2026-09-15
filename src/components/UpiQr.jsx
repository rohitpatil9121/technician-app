import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Build-time fallbacks. The live id comes from the dashboard (Settings → UPI
// ID) via /api/tech/config, so changing the bank account no longer means
// rebuilding and redistributing the APK.
const FALLBACK_UPI_ID = import.meta.env.VITE_UPI_ID || "BHARATPE2U0G0A0D8G59789@unitype";
const FALLBACK_PAYEE = import.meta.env.VITE_UPI_PAYEE || "Oasis Globe";

export default function UpiQr({ amount, upiId, payee }) {
  const UPI_ID = upiId || FALLBACK_UPI_ID;
  const PAYEE = payee || FALLBACK_PAYEE;
  const [url, setUrl] = useState("");
  // UPI spec wants the amount as a fixed 2-decimal number; a NaN/blank amount
  // produces a QR most UPI apps reject with an error, so guard it.
  const amt = Number(amount);
  const valid = Number.isFinite(amt) && amt > 0;
  useEffect(() => {
    if (!valid) { setUrl(""); return; }
    const intent = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(PAYEE)}&am=${amt.toFixed(2)}&cu=INR`;
    QRCode.toDataURL(intent, { width: 240, margin: 1 }).then(setUrl).catch(() => {});
  }, [amt, valid, UPI_ID, PAYEE]);

  return (
    <div className="flex flex-col items-center">
      {!valid
        ? <div className="grid h-56 w-56 place-items-center px-4 text-center text-sm text-danger-fg">Invalid amount — cannot generate QR.</div>
        : url
          ? <img src={url} alt="UPI QR" className="h-56 w-56" />
          : <div className="grid h-56 w-56 place-items-center text-sm text-subtle">Generating QR…</div>}
      <div className="mt-1 text-xs text-muted">Scan with any UPI app · {UPI_ID}</div>
    </div>
  );
}
