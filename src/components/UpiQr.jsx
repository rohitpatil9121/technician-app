import { useEffect, useState } from "react";
import QRCode from "qrcode";

// TODO(owner): set the real business UPI ID here.
const UPI_ID = "oasisglobe@upi";
const PAYEE = "Oasis Globe";

// A scannable UPI QR for the amount due, rendered in-app (customer scans it with
// any UPI app). The QR encodes a standard upi://pay intent.
export default function UpiQr({ amount }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const intent = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(PAYEE)}&am=${amount}&cu=INR`;
    QRCode.toDataURL(intent, { width: 240, margin: 1 }).then(setUrl).catch(() => {});
  }, [amount]);

  return (
    <div className="flex flex-col items-center">
      {url
        ? <img src={url} alt="UPI QR" className="h-56 w-56" />
        : <div className="grid h-56 w-56 place-items-center text-sm text-slate-400">Generating QR…</div>}
      <div className="mt-1 text-xs text-slate-500">Scan with any UPI app · {UPI_ID}</div>
    </div>
  );
}
