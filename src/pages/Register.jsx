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

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);

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
      await nativeApi.auth.register({ email: email.trim(), password });
      window.location.href = safeReturnTo();
    } catch (err) {
      setError(err.message || "Pendaftaran belum berhasil.");
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field) => setFieldErrors((current) => ({ ...current, [field]: "" }));

  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (!isLoadingAuth && isAuthenticated) return <Navigate to={"/"} replace />;

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
