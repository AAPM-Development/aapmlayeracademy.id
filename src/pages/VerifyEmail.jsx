import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { useAuth } from "@/lib/AuthContext";
import AppiMascot, { appiAsset } from "@/components/appi/AppiMascot";
import { Ic } from "@/design-system/canvas";
import AuthLayout from "@/components/AuthLayout";

// The token arrives in the query (new emails) or the fragment (older emails). It is read once,
// removed from the address bar, and kept in sessionStorage until the page is done with it, so a
// remount or refresh while the session loads never loses it. Then it is submitted with CSRF.
const TOKEN_KEY = "aapm.verify-email.token";

function readTokenFromUrl() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const fromUrl = new URLSearchParams(window.location.search).get("token") || new URLSearchParams(hash).get("token") || "";
  try {
    if (fromUrl) { window.sessionStorage.setItem(TOKEN_KEY, fromUrl); return fromUrl; }
    return window.sessionStorage.getItem(TOKEN_KEY) || "";
  } catch { return fromUrl; }
}

function forgetToken() {
  try { window.sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
}

export default function VerifyEmail() {
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("");
  const token = useRef("");
  const attempted = useRef(false);
  const { isAuthenticated, isLoadingAuth, checkUserAuth } = useAuth();
  const [resend, setResend] = useState({ busy: false, note: "" });
  const sendAgain = async () => {
    setResend({ busy: true, note: "" });
    try {
      await nativeApi.auth.resendVerification({});
      setResend({ busy: false, note: "Email verifikasi baru dikirim. Buka tautan terbaru di kotak masuk Anda." });
    } catch (error) {
      setResend({ busy: false, note: error?.message || "Email belum terkirim. Coba lagi sebentar lagi." });
    }
  };

  const submit = () => {
    setStatus("verifying");
    setMessage("");
    nativeApi.auth
      .verifyEmail(token.current)
      .then(async () => {
        forgetToken();
        setStatus("success");
        await checkUserAuth();
      })
      .catch((error) => {
        if (error.code === "invalid_verification_token") {
          forgetToken();
          setStatus("invalid");
          setMessage("Tautan verifikasi tidak valid, sudah dipakai, atau kedaluwarsa. Kirim ulang email verifikasi untuk tautan baru.");
          return;
        }
        setStatus("failed");
        setMessage("Gangguan jaringan atau server. Coba lagi.");
      });
  };

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    token.current = readTokenFromUrl();
    window.history.replaceState(null, "", window.location.pathname);
    if (!token.current) {
      setStatus("invalid");
      setMessage("Tautan verifikasi tidak lengkap, mungkin terpotong oleh aplikasi email. Salin seluruh tautan ke browser, atau kirim ulang email verifikasi.");
      return;
    }
    submit();
    // submit reads only refs and stable setters, so it is intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "success" && !isLoadingAuth && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (status === "success") {
    return (
      <AuthLayout
        title="Email terverifikasi"
        subtitle="Anda akan diarahkan ke beranda."
        visual={(
          <div className="appi-stage">
            <AppiMascot mood="cheer" size="lg" enter="pop" />
            <span className="medal-badge" aria-hidden="true"><Ic name="check" /></span>
            <img className="sparkle anim-twinkle" src={appiAsset(13)} alt="" style={{ right: -18, top: -4, width: 20 }} />
          </div>
        )}
      >
        <Link className="btn btn-primary btn-lg btn-block" to="/">Ke beranda</Link>
        <span className="row gap-2 t-support t-muted" role="status"><Ic name="clock" size="sm" />Mengarahkan otomatis…</span>
      </AuthLayout>
    );
  }

  if (status === "verifying") {
    return (
      <AuthLayout title="Memverifikasi email" subtitle="Konfirmasi alamat email untuk mengaktifkan akun Academy Anda." visual={<AppiMascot mood="think" size="lg" enter="pop" />}>
        <span className="row gap-2 t-support t-muted" role="status"><span className="typing" aria-hidden="true"><i /><i /><i /></span>Memverifikasi email Anda…</span>
      </AuthLayout>
    );
  }

  const failed = status === "failed";
  return (
    <AuthLayout
      icon={failed ? "alert" : "link"}
      tone={failed ? "warning" : "danger"}
      title={failed ? "Verifikasi belum berhasil" : "Tautan verifikasi tidak valid"}
      subtitle={message}
      back={{ to: "/login", label: "Kembali ke masuk" }}
    >
      {failed ? (
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={submit}><Ic name="refresh" />Coba lagi</button>
      ) : (
        <>
          {isAuthenticated ? (
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={sendAgain} disabled={resend.busy} aria-busy={resend.busy || undefined}><Ic name="mail" />{resend.busy ? "Mengirim…" : "Kirim ulang email verifikasi"}</button>
          ) : (
            <Link className="btn btn-primary btn-lg btn-block" to="/login">Masuk untuk kirim ulang</Link>
          )}
          {resend.note ? <p className="t-support t-muted" role="status" aria-live="polite">{resend.note}</p> : null}
        </>
      )}
    </AuthLayout>
  );
}
