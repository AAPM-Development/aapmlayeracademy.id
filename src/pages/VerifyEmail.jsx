import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { useAuth } from "@/lib/AuthContext";
import AppiMascot, { appiAsset } from "@/components/appi/AppiMascot";
import { Ic } from "@/design-system/canvas";
import AuthLayout from "@/components/AuthLayout";

// The token travels in the URL fragment, which browsers never send to the server.
// It is read once, removed from the address bar, and then submitted with CSRF protection.
function readTokenFromFragment() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  return new URLSearchParams(hash).get("token") || "";
}

export default function VerifyEmail() {
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("");
  const token = useRef("");
  const attempted = useRef(false);
  const { isAuthenticated, isLoadingAuth, checkUserAuth } = useAuth();

  const submit = () => {
    setStatus("verifying");
    setMessage("");
    nativeApi.auth
      .verifyEmail(token.current)
      .then(async () => {
        setStatus("success");
        await checkUserAuth();
      })
      .catch((error) => {
        if (error.code === "invalid_verification_token") {
          setStatus("invalid");
          setMessage("Tautan verifikasi tidak valid atau sudah kedaluwarsa. Minta instruksi baru dari halaman masuk.");
          return;
        }
        setStatus("failed");
        setMessage("Gangguan jaringan atau server. Coba lagi.");
      });
  };

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    token.current = readTokenFromFragment();
    window.history.replaceState(null, "", window.location.pathname);
    if (!token.current) {
      setStatus("invalid");
      setMessage("Tautan verifikasi tidak lengkap. Buka tautan terbaru dari email Anda.");
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
        <Link className="btn btn-primary btn-lg btn-block" to="/login">Minta instruksi baru</Link>
      )}
    </AuthLayout>
  );
}
