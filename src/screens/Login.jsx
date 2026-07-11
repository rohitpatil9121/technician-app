import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useJobs } from "../store/JobsContext.jsx";
import { api } from "../lib/api.js";
import OtpInput from "../components/OtpInput.jsx";
import { Icon, PrimaryButton, input, cx } from "../components/ui.jsx";

const RESEND_SEC = 30;

export default function Login() {
  const { startLive, startDemo } = useJobs();
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const tapRef = useRef(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const secretTap = () => {
    tapRef.current += 1;
    if (tapRef.current >= 5) { tapRef.current = 0; startDemo(); nav("/home"); }
  };

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

  const fmtPhone = (p) => p.length >= 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p;

  return (
    <div className="safe-top safe-x mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-white shadow-pop">
      <div className="bg-gradient-to-br from-brand-light to-brand-dark px-6 pb-10 pt-12 text-white">
        <div className="flex items-center gap-3">
          <img
            onClick={secretTap}
            src="/logo.png"
            alt="Oasis Globe"
            className="h-12 w-auto cursor-pointer select-none rounded-xl bg-white p-1.5 object-contain"
          />
          <div className="text-sm font-medium text-white/85">Technician App</div>
        </div>
        <h1 className="mt-8 text-3xl font-extrabold">Technician Login</h1>
        <p className="mt-1 text-white/85">Login with your registered mobile number</p>
      </div>

      <div className="-mt-6 flex-1 rounded-t-3xl bg-white px-6 pt-6 safe-bottom">
        {!otpSent ? (
          <>
            <label className="text-sm font-medium text-slate-600">Mobile Number</label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-50">
              <Icon.phone width={18} height={18} className="text-slate-400" />
              <span className="text-[15px] font-medium text-slate-500">+91</span>
              <input
                className="w-full bg-transparent py-3.5 text-[15px] outline-none"
                placeholder="98220 11223"
                inputMode="numeric"
                maxLength={10}
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            </div>
          </>
        ) : (
          <div className="animate-in">
            <div className="text-center">
              <div className="text-sm font-medium text-slate-600">Enter OTP</div>
              <div className="mt-1 text-xs text-slate-400">
                Sent to WhatsApp · <span className="font-semibold text-slate-600">+91 {fmtPhone(phone)}</span>
              </div>
            </div>
            <div className="mt-5">
              <OtpInput value={otp} onChange={setOtp} disabled={busy} />
            </div>
            <div className="mt-3 text-center">
              {resendIn > 0 ? (
                <span className="text-xs text-slate-400">Resend OTP in {resendIn}s</span>
              ) : (
                <button type="button" onClick={sendOtp} disabled={busy} className="text-xs font-semibold text-brand">
                  Resend OTP
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setOtpSent(false); setOtp(""); setErr(""); }}
              className="mt-2 w-full text-center text-xs text-slate-400"
            >
              Change number
            </button>
          </div>
        )}

        {err && <div className="mt-3 rounded-xl bg-danger-light px-3 py-2.5 text-sm text-danger">{err}</div>}

        <div className="mt-6">
          {!otpSent ? (
            <PrimaryButton onClick={sendOtp} disabled={phone.length < 10 || busy}>
              {busy ? "Sending…" : "Send OTP on WhatsApp"}
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={verify} disabled={otp.length < 6 || busy}>
              {busy ? "Verifying…" : "Verify & Continue"}
            </PrimaryButton>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          OTP is sent to your registered WhatsApp number
        </p>
      </div>
    </div>
  );
}
