import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { useAuth } from "@/lib/AuthContext";
import { Button, Alert, Field, InputGroup } from "@/components/primitives";
import AuthLayout from "@/components/AuthLayout";
import PasswordField from "@/components/PasswordField";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";
import {
  NEW_PASSWORD_HINT,
  collectErrors,
  confirmPasswordError,
  emailError,
  focusFirstError,
  newPasswordError,
} from "@/lib/authValidation";

// Development builds may receive a verification token so the flow can be exercised
// locally. Deployed responses never include one, and this link is never rendered for them.
function devVerificationLink(token) {
  return token ? `${window.location.origin}/verify-email#token=${encodeURIComponent(token)}` : "";
}

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devLink, setDevLink] = useState("");
  const [resendNote, setResendNote] = useState("");

  useEffect(() => {
    nativeApi.auth.providers().then((providers) => {
      setGoogleAvailable(Boolean(providers?.google));
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const errors = collectErrors({
      email: emailError(email),
      password: newPasswordError(password),
      confirm: confirmPasswordError(confirmPassword, password),
    });
    setFieldErrors(errors || {});
    if (errors) {
      focusFirstError(errors);
      return;
    }
    setLoading(true);
    try {
      // The server acknowledges every valid request the same way and never signs the browser in.
      const result = await nativeApi.auth.register({ email: email.trim(), password });
      setDevLink(devVerificationLink(result?.devVerificationToken));
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Pendaftaran belum berhasil.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendNote("");
    try {
      const result = await nativeApi.auth.resendVerification({ email: email.trim(), password });
      setDevLink(devVerificationLink(result?.devVerificationToken) || devLink);
      setResendNote("Jika akun tersebut menunggu verifikasi, instruksi baru akan dikirim.");
    } catch {
      setResendNote("Instruksi belum dapat dikirim. Coba lagi.");
    }
  };

  const clearError = (field) => setFieldErrors((current) => ({ ...current, [field]: "" }));

  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (!isLoadingAuth && isAuthenticated) return <Navigate to={"/"} replace />;

  if (submitted) {
    return (
      <AuthLayout
        title="Periksa email Anda"
        subtitle="Jika alamat email dapat digunakan, instruksi verifikasi akan dikirim."
        footer={
          <Link to="/login" className="aapm-link">
            Kembali ke masuk
          </Link>
        }
      >
        <Alert tone="info" description="Buka tautan di email untuk mengaktifkan akun. Tautan berlaku 24 jam dan hanya dapat dipakai sekali." className="aapm-auth__alert" />
        {devLink && (
          <p className="aapm-text-caption">
            Mode pengembangan: <a className="aapm-link" href={devLink}>buka tautan verifikasi</a>
          </p>
        )}
        {resendNote && <p className="aapm-text-caption">{resendNote}</p>}
        <Button type="button" variant="secondary" size="lg" block onClick={handleResend}>
          Kirim ulang instruksi
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Buat akun Academy"
      subtitle="Mulai jalur belajar yang terukur untuk keputusan farm Anda."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link
            to={"/login" + (safeReturnTo() !== "/" ? "?returnTo=" + encodeURIComponent(safeReturnTo()) : "")}
            className="aapm-link"
          >
            Masuk
          </Link>
        </>
      }
    >
      {error && <Alert tone="danger" description={error} className="aapm-auth__alert" />}

      <form onSubmit={handleSubmit} noValidate>
        <Field id="email" label="Alamat email" error={fieldErrors.email}>
          <InputGroup
            leadingIcon="mail"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="nama@perusahaan.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
            required
          />
        </Field>
        <PasswordField
          id="password"
          label="Kata sandi"
          autoComplete="new-password"
          placeholder="Minimal 8 karakter"
          hint={NEW_PASSWORD_HINT}
          error={fieldErrors.password}
          value={password}
          onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
          minLength={8}
        />
        <PasswordField
          id="confirm"
          label="Konfirmasi kata sandi"
          autoComplete="new-password"
          placeholder="Ulangi kata sandi"
          error={fieldErrors.confirm}
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); clearError("confirm"); }}
          minLength={8}
        />
        <Button type="submit" size="lg" block loading={loading}>
          {loading ? "Membuat akun…" : "Buat akun"}
        </Button>
      </form>
      {googleAvailable && (
        <>
          <div className="aapm-auth__divider">atau</div>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            block
            onClick={() => { window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(safeReturnTo())}`; }}
          >
            <GoogleIcon />
            Daftar dengan Google
          </Button>
        </>
      )}
    </AuthLayout>
  );
}
