import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useJobs } from "../store/JobsContext.jsx";
import { api } from "../lib/api.js";
import OtpInput from "../components/OtpInput.jsx";
import { Icon, Card, FLabel, PrimaryButton, cx } from "../components/ui.jsx";

const RESEND_SEC = 30;

/* WhatsApp info card (mockup .wacard) — shared by both login steps. */
const WaCard = ({ lead, children }) => (
  <div className="rounded-2xl border border-[#93E2B4] bg-gradient-to-br from-[#DCF7E6] to-[#B7EDCB] px-4 py-3.5">
    <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#0E8049]">
      <Icon.whatsapp width={16} height={16} className="text-wa" /> {lead}
    </div>
    <div className="mt-0.5 text-[15px] font-medium leading-snug text-wa-dark">{children}</div>
  </div>
);

export default function Login() {
  const { startLive } = useJobs();
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendOtp = async () => {
    setErr(""); setBusy(true);
    try {
      await api.requestOtp("+91" + phone);
      setOtpSent(true);
      setOtp("");
      setResendIn(RESEND_SEC);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    setErr(""); setBusy(true);
    try {
      const { token, user } = await api.verifyOtp("+91" + phone, otp);
      await startLive(token, user);
      nav("/home");
    } catch (e) { setErr(e.message || "Invalid or expired code"); }
    finally { setBusy(false); }
  };

  const fmtPhone = (p) => (p.length >= 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p);

  return (
    <div className="safe-top safe-x mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-sunken">
      <main className="flex-1 overflow-y-auto px-4 pb-4 pt-8">
        {!otpSent ? (
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3.5 grid h-[78px] w-[78px] place-items-center rounded-[20px] bg-gradient-to-br from-brand to-brand-dark text-white shadow-[0_10px_24px_rgba(11,87,208,.3)]">
                <Icon.drop width={40} height={40} />
              </div>
              <h1 className="text-[28px] font-extrabold tracking-tight text-strong">Oasis Technician</h1>
              <p className="mt-0.5 text-[16px] text-muted">Login with your mobile number</p>
            </div>
            <Card>
              <FLabel icon={Icon.phone}>Mobile Number</FLabel>
              <div className="flex gap-2.5">
                <div className="grid w-[74px] place-items-center rounded-t-lg border-b-2 border-subtle bg-tonal text-[17px] font-medium text-muted">+91</div>
                <input
                  id="phone" name="tel" type="tel" autoComplete="tel-national"
                  className="tnum min-h-[52px] flex-1 rounded-t-lg border-b-2 border-subtle bg-tonal px-4 text-[17px] font-medium tracking-wide text-strong outline-none placeholder:text-subtle focus:border-brand"
                  placeholder="98220 11223" inputMode="numeric" maxLength={10} autoFocus
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                />
              </div>
              <p className="mt-2 text-xs text-subtle">
                {phone.length === 0 ? "10 digits, without the +91"
                  : phone.length < 10 ? `${10 - phone.length} more digit${10 - phone.length === 1 ? "" : "s"}`
                  : "Ready to send"}
              </p>
            </Card>
            <div className="mt-3">
              <WaCard lead="WhatsApp">We send your code on <b>WhatsApp</b></WaCard>
            </div>
          </>
        ) : (
          <div className="animate-in pt-2">
            <h1 className="mb-4 text-center text-[28px] font-extrabold tracking-tight text-strong">Enter Code</h1>
            <WaCard lead="Sent on WhatsApp">To <b className="tnum">+91 {fmtPhone(phone)}</b></WaCard>
            <div className="mt-5">
              <OtpInput value={otp} onChange={setOtp} disabled={busy} />
            </div>
            <div className="mt-3 flex min-h-[44px] items-center justify-center">
              {resendIn > 0 ? (
                <span className="tnum text-sm font-medium text-subtle">Resend code in {resendIn}s</span>
              ) : (
                <button type="button" onClick={sendOtp} disabled={busy} className="px-3 py-2 text-sm font-semibold text-brand">
                  Resend code
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setOtpSent(false); setOtp(""); setErr(""); }}
              className="min-h-[44px] w-full text-center text-sm text-subtle"
            >
              Change number
            </button>
          </div>
        )}

        {err && (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-2xl bg-danger-tint px-3.5 py-3 text-sm font-medium text-danger-fg">
            <Icon.alert width={16} height={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{err}</span>
          </div>
        )}
      </main>

      <div className="safe-bottom px-4 pb-4 pt-2">
        {!otpSent ? (
          <PrimaryButton onClick={sendOtp} disabled={phone.length < 10} loading={busy}>
            {busy ? "Sending…" : "Send Code"} {!busy && <Icon.chevron width={19} height={19} />}
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={verify} disabled={otp.length < 6} loading={busy}>
            {busy ? "Verifying…" : "Verify"} {!busy && <Icon.chevron width={19} height={19} />}
          </PrimaryButton>
        )}
        <p className="tnum mt-3 text-center text-[11px] text-subtle/80">v{__APP_VERSION__}</p>
      </div>
    </div>
  );
}
