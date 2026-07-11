import { useEffect, useState } from "react";
import QRCode from "qrcode";

const UPI_ID = import.meta.env.VITE_UPI_ID || "BHARATPE2U0G0A0D8G59789@unitype";
const PAYEE = import.meta.env.VITE_UPI_PAYEE || "Oasis Globe";

export default function UpiQr({ amount }) {
  const [url, setUrl] = useState("");
  // UPI spec wants the amount as a fixed 2-decimal number; a NaN/blank amount
  // produces a QR most UPI apps reject with an error, so guard it.
  const amt = Number(amount);
  const valid = Number.isFinite(amt) && amt > 0;
  useEffect(() => {
    if (!valid) { setUrl(""); return; }
    const intent = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(PAYEE)}&am=${amt.toFixed(2)}&cu=INR`;
    QRCode.toDataURL(intent, { width: 240, margin: 1 }).then(setUrl).catch(() => {});
  }, [amt, valid]);

  return (
    <div className="flex flex-col items-center">
      {!valid
        ? <div className="grid h-56 w-56 place-items-center px-4 text-center text-sm text-danger">Invalid amount — cannot generate QR.</div>
        : url
          ? <img src={url} alt="UPI QR" className="h-56 w-56" />
          : <div className="grid h-56 w-56 place-items-center text-sm text-slate-400">Generating QR…</div>}
      <div className="mt-1 text-xs text-slate-500">Scan with any UPI app · {UPI_ID}</div>
    </div>
  );
}
