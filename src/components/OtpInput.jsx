import { useRef } from "react";
import { cx } from "./ui.jsx";

// Six single-digit boxes — auto-advance, backspace, and full-code paste.
export default function OtpInput({ length = 6, value = "", onChange, disabled }) {
  const refs = useRef([]);

  const setAt = (idx, ch) => {
    const arr = value.split("");
    while (arr.length < length) arr.push("");
    arr[idx] = ch;
    onChange(arr.join("").slice(0, length));
  };

  const focus = (i) => refs.current[i]?.focus();

  const onKey = (i, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[i]) setAt(i, "");
      else if (i > 0) { setAt(i - 1, ""); focus(i - 1); }
      return;
    }
    if (!/^\d$/.test(e.key)) return;
    e.preventDefault();
    setAt(i, e.key);
    if (i < length - 1) focus(i + 1);
  };

  const onPaste = (e) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (digits) onChange(digits);
    focus(Math.min(digits.length, length - 1));
  };

  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={value[i] || ""}
          onChange={() => {}}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          className={cx(
            "h-12 w-10 rounded-xl border-2 bg-white text-center text-lg font-bold outline-none transition",
            value[i] ? "border-brand text-brand-dark" : "border-slate-200 text-slate-800",
            "focus:border-brand focus:ring-2 focus:ring-brand-50",
            disabled && "opacity-50"
          )}
        />
      ))}
    </div>
  );
}
