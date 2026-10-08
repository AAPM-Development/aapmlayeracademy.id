import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { useAuth } from "@/lib/AuthContext";
import { Button, Alert } from "@/components/primitives";
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
        setMessage("Verifikasi belum berhasil karena gangguan jaringan atau server. Coba lagi.");
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

  return (
    <AuthLayout
      title="Verifikasi email"
      subtitle="Konfirmasi alamat email untuk mengaktifkan akun Academy Anda."
      footer={
        <Link to="/login" className="aapm-link">
          Kembali ke masuk
        </Link>
      }
    >
      {status === "verifying" && <p className="aapm-text-caption">Memverifikasi email Anda…</p>}
      {status === "success" && (
        <Alert tone="success" description="Email Anda sudah terverifikasi. Anda akan diarahkan ke beranda." className="aapm-auth__alert" />
      )}
      {(status === "invalid" || status === "failed") && (
        <Alert tone="danger" description={message} className="aapm-auth__alert" />
      )}
      {status === "failed" && (
        <Button type="button" variant="secondary" size="lg" block onClick={submit}>
          Coba lagi
        </Button>
      )}
    </AuthLayout>
  );
}
