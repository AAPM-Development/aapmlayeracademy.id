import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { useAuth } from "@/lib/AuthContext";
import { Button, Field, InputGroup } from "@/components/primitives";
import AuthLayout from "@/components/AuthLayout";
import { Ic } from "@/design-system/canvas";
import { emailError } from "@/lib/authValidation";
import { hasFinePointer } from "@/lib/utils";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetLink, setDevResetLink] = useState("");
  const [fieldError, setFieldError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const invalid = emailError(email);
    setFieldError(invalid);
    if (invalid) {
      document.getElementById("email")?.focus();
      return;
    }
    setLoading(true);
    try {
      const result = await nativeApi.auth.requestPasswordReset(email.trim());
      if (result?.devResetToken) {
        setDevResetLink(`${window.location.origin}/reset-password?token=${encodeURIComponent(result.devResetToken)}`);
      }
    } catch {
      // Keep the response generic to avoid revealing whether an email exists.
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (!isLoadingAuth && isAuthenticated) return <Navigate to={"/"} replace />;

  // Once sent, the header itself carries the new state; the only next step
  // in the app is back to sign-in.
  if (sent) {
    return (
      <AuthLayout
        icon="check-circle"
        tone="success"
        title="Periksa email Anda"
        subtitle="Jika akun dengan email tersebut tersedia, tautan reset sudah kami kirim."
        back={{ to: "/login" }}
      >
        <div className="inset row gap-3" style={{ padding: "var(--s-2) var(--s-2) var(--s-2) var(--s-4)" }}>
          <Ic name="mail" className="t-muted" />
          <span className="grow t-clamp-1 t-medium">{email.trim()}</span>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Ubah alamat email" onClick={() => setSent(false)}>Ubah</button>
        </div>
        <div className="alert alert-info" role="note"><Ic name="clock" /><div>Tautan berlaku 60 menit dan hanya dapat dipakai sekali.</div></div>
        <Button type="button" variant="secondary" size="lg" block loading={loading} onClick={handleSubmit}>
          <Ic name="refresh" />Kirim ulang
        </Button>
        {devResetLink && (
          <a className="btn btn-link" href={devResetLink} style={{ alignSelf: "flex-start" }}>
            Buka tautan reset
          </a>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon="mail"
      title="Atur ulang kata sandi"
      subtitle="Kami akan mengirim tautan untuk membuat kata sandi baru."
      back={{ to: "/login" }}
    >
      <form onSubmit={handleSubmit} noValidate>
        <Field id="email" label="Alamat email" error={fieldError}>
          <InputGroup
            leadingIcon="mail"
            type="email"
            autoComplete="email"
            autoFocus={hasFinePointer()}
            placeholder="nama@perusahaan.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFieldError(""); }}
            required
          />
        </Field>
        <div className="alert" role="note">
          <Ic name="info" className="t-muted" />
          <div>Mendaftar dengan Google? Masuk lewat tombol Google, tanpa kata sandi.</div>
        </div>
        <Button type="submit" size="lg" block loading={loading}>
          {loading ? "Mengirim tautan…" : "Kirim tautan reset"}
        </Button>
      </form>
    </AuthLayout>
  );
}
