import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { useAuth } from "@/lib/AuthContext";
import { Button, Alert, Field, InputGroup } from "@/components/primitives";
import AuthLayout, { AuthDivider, GoogleButton } from "@/components/AuthLayout";
import PasswordField from "@/components/PasswordField";
import { safeReturnTo } from "@/lib/authReturnTo";
import { collectErrors, emailError, focusFirstError, passwordError } from "@/lib/authValidation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  // A refused sign-in marks both fields: the API cannot say which one is wrong.
  const [credentialsRejected, setCredentialsRejected] = useState(false);
  // A correct password on a pending account: no session, offer a fresh verification email.
  const [verificationPending, setVerificationPending] = useState(false);
  const [resendNote, setResendNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const returnTo = safeReturnTo();

  useEffect(() => {
    nativeApi.auth.providers().then((providers) => {
      setGoogleAvailable(Boolean(providers?.google));
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setCredentialsRejected(false);
    setVerificationPending(false);
    setResendNote("");
    const errors = collectErrors({ email: emailError(email), password: passwordError(password) });
    setFieldErrors(errors || {});
    if (errors) {
      focusFirstError(errors);
      return;
    }
    setLoading(true);
    try {
      await nativeApi.auth.login(email.trim(), password);
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Email atau kata sandi tidak sesuai.");
      if (err.code === "email_verification_required") {
        setVerificationPending(true);
      }
      if (err.code === "invalid_credentials") {
        setCredentialsRejected(true);
        setPassword("");
        document.getElementById("password")?.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendNote("");
    try {
      await nativeApi.auth.resendVerification({ email: email.trim(), password });
      setResendNote("Jika akun tersebut menunggu verifikasi, instruksi baru akan dikirim.");
    } catch {
      setResendNote("Instruksi belum dapat dikirim. Coba lagi.");
    }
  };

  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (!isLoadingAuth && isAuthenticated) return <Navigate to={returnTo} replace />;

  return (
    <AuthLayout
      title="Masuk ke Academy"
      subtitle="Lanjutkan ritme belajar Anda di farm."
      footer={
        <>
          Belum punya akun?{" "}
          <Link
            to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
            className="btn btn-link"
          >
            Buat akun
          </Link>
        </>
      }
    >
      {error && <Alert tone="danger" description={error} />}
      {verificationPending && (
        <div className="stack gap-3">
          <Alert tone="info" description="Verifikasi alamat email Anda untuk masuk. Periksa kotak masuk atau minta instruksi baru." />
          <Button type="button" variant="secondary" size="lg" block onClick={handleResend}>
            Kirim ulang instruksi verifikasi
          </Button>
          {resendNote && <p className="t-caption t-muted" aria-live="polite">{resendNote}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Field id="email" label="Alamat email" error={fieldErrors.email}>
          <InputGroup
            leadingIcon="mail"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="nama@perusahaan.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((current) => ({ ...current, email: "" }));
              setCredentialsRejected(false);
            }}
            aria-invalid={credentialsRejected || undefined}
            required
          />
        </Field>
        <PasswordField
          id="password"
          label="Kata sandi"
          autoComplete="current-password"
          placeholder="Masukkan kata sandi"
          value={password}
          error={fieldErrors.password}
          invalid={credentialsRejected}
          onChange={(e) => {
            setPassword(e.target.value);
            setFieldErrors((current) => ({ ...current, password: "" }));
            setCredentialsRejected(false);
          }}
          labelAction={<Link to="/forgot-password" className="btn btn-sm btn-link">Lupa kata sandi?</Link>}
        />
        <Button type="submit" size="lg" block loading={loading}>
          {loading ? "Memeriksa akun…" : "Masuk"}
        </Button>
      </form>
      {googleAvailable && (
        <>
          <AuthDivider />
          <GoogleButton label="Lanjutkan dengan Google" onClick={() => { window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`; }} />
        </>
      )}
    </AuthLayout>
  );
}
