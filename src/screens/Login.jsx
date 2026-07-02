import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJobs } from "../store/JobsContext.jsx";
import { api } from "../lib/api.js";
import { Icon, PrimaryButton, input, cx } from "../components/ui.jsx";

export default function Login() {
  const { startLive, startDemo } = useJobs();
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const tapRef = useRef(0);

  // Hidden demo login (testing only): tap the brand logo 5 times to enter the
  // prototype/mock mode. No visible button, so customers/technicians won't see it.
  // A ref (not state) so it counts correctly even on fast, back-to-back taps.
  const secretTap = () => {
    tapRef.current += 1;
    if (tapRef.current >= 5) { tapRef.current = 0; startDemo(); nav("/home"); }
  };

  const sendOtp = async () => {
    setErr(""); setBusy(true);
    try { await api.requestOtp("+91" + phone); setOtpSent(true); }
    catch (e) { setErr(e.message); }
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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-white shadow-pop">
      {/* Brand header */}
      <div className="bg-gradient-to-br from-brand-light to-brand-dark px-6 pb-10 pt-12 text-white">
        <div className="flex items-center gap-3">
          <div onClick={secretTap} className="grid h-12 w-12 cursor-pointer place-items-center rounded-2xl bg-white/15 select-none">
            <Icon.wrench width={26} height={26} />
          </div>
          <div>
            <div className="text-xl font-extrabold leading-none">Oasis Globe</div>
            <div className="text-sm text-white/80">Technician App</div>
          </div>
        </div>
        <h1 className="mt-8 text-3xl font-extrabold">Technician Login</h1>
        <p className="mt-1 text-white/85">Login with your registered mobile number</p>
      </div>

      <div className="-mt-6 flex-1 rounded-t-3xl bg-white px-6 pt-6">
        <label className="text-sm font-medium text-slate-600">Mobile Number</label>
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3">
          <Icon.phone width={18} height={18} className="text-slate-400" />
          <span className="text-[15px] font-medium text-slate-500">+91</span>
          <input
            className="w-full bg-transparent py-3 text-[15px] outline-none"
            placeholder="98220 11223"
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          />
        </div>

        {otpSent && (
          <div className="mt-4 animate-in">
            <label className="text-sm font-medium text-slate-600">Enter OTP</label>
            <input
              className={cx(input, "mt-1 tracking-[0.4em]")}
              placeholder="••••••"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <div className="mt-1 text-xs text-slate-400">Sent to your WhatsApp.</div>
          </div>
        )}

        {err && <div className="mt-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{err}</div>}

        <div className="mt-5">
          {!otpSent ? (
            <PrimaryButton onClick={sendOtp} disabled={phone.length < 10 || busy}>
              {busy ? "Sending…" : "Send OTP"}
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={verify} disabled={otp.length < 6 || busy}>
              {busy ? "Verifying…" : "Verify & Continue"}
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}
