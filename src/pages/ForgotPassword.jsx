import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { useAuth } from "@/lib/AuthContext";
import { Button, Field, InputGroup } from "@/components/primitives";
import AuthLayout from "@/components/AuthLayout";
import AapmIcon from "@/components/icons/AapmIcon";
import { emailError } from "@/lib/authValidation";

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

  const backToLogin = (
    <Link to="/login" className="aapm-link">
      <AapmIcon name="arrowLeft" />Kembali ke halaman masuk
    </Link>
  );

  // Once sent, the header itself carries the new state; the only next step
  // in the app is back to sign-in.
  if (sent) {
    return (
      <AuthLayout
        iconName="success"
        title="Periksa email Anda"
        subtitle="Jika akun dengan email tersebut tersedia, tautan reset sudah kami kirim."
      >
        <div className="aapm-auth__stack">
          <Button asChild variant="secondary" size="lg" block>
            <Link to="/login"><AapmIcon name="arrowLeft" />Kembali ke halaman masuk</Link>
          </Button>
          {devResetLink && (
            <a className="aapm-link" href={devResetLink}>
              Buka tautan reset
            </a>
          )}
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      iconName="mail"
      title="Atur ulang kata sandi"
      subtitle="Kami akan mengirim tautan untuk membuat kata sandi baru."
      footer={backToLogin}
    >
      <form onSubmit={handleSubmit} noValidate>
        <Field id="email" label="Alamat email" error={fieldError}>
          <InputGroup
            leadingIcon="mail"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="nama@perusahaan.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFieldError(""); }}
            required
          />
        </Field>
        <Button type="submit" size="lg" block loading={loading}>
          {loading ? "Mengirim tautan…" : "Kirim tautan reset"}
        </Button>
      </form>
    </AuthLayout>
  );
}
