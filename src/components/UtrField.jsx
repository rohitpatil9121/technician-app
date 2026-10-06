import { Card, FLabel, Icon, input, cx } from "./ui.jsx";

/* The UPI reference number (UTR) from the customer's success screen.

   Twelve digits, shown by every UPI app after a payment as "UPI Ref No", "UTR"
   or "Transaction ID". It is the one thing that appears both on the customer's
   phone and in the company's bank statement, so it is how the office ties this
   bill to the money that actually arrived. Some apps bury it; "not shown" lets
   the job finish, and the bill is marked so the office knows to look. */
export const utrOk = (utr, skipped) => /^\d{12}$/.test(utr) || skipped;

export default function UtrField({ value, onChange, skipped, onSkip, className }) {
  const n = value.length;
  return (
    <Card className={cx("mt-3", className)}>
      <FLabel icon={Icon.receipt} must>UPI reference number</FLabel>
      <div className="-mt-1 mb-2.5 text-sm text-muted">
        12 digits on their payment success screen — &ldquo;UPI Ref No&rdquo; or &ldquo;UTR&rdquo;.
      </div>
      <input className={cx(input, "tnum w-full tracking-widest")} inputMode="numeric" autoComplete="off"
        placeholder="12-digit number" maxLength={12} disabled={skipped}
        value={skipped ? "" : value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 12))} />
      <div className="mt-2 flex items-center justify-between gap-3 text-[12.5px]">
        <span className={n === 12 && !skipped ? "font-semibold text-ok-fg" : "text-subtle"}>
          {skipped ? "Marked as not shown — the office will check this payment."
            : n === 0 ? "Type it exactly as shown."
            : n < 12 ? `${12 - n} more digit${12 - n === 1 ? "" : "s"}`
            : "Looks right."}
        </span>
        <button type="button" onClick={() => onSkip(!skipped)} className="shrink-0 font-semibold text-brand">
          {skipped ? "I can see it" : "Not shown on their phone"}
        </button>
      </div>
    </Card>
  );
}
