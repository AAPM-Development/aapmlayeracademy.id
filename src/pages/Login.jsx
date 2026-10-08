import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { useAuth } from "@/lib/AuthContext";
import { Button, Alert, Field, InputGroup } from "@/components/primitives";
import AuthLayout from "@/components/AuthLayout";
import PasswordField from "@/components/PasswordField";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";
import { collectErrors, emailError, focusFirstError, passwordError } from "@/lib/authValidation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  // A refused sign-in marks both fields: the API cannot say which one is wrong.
  const [credentialsRejected, setCredentialsRejected] = useState(false);
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
      if (err.code === "invalid_credentials") {
        setCredentialsRejected(true);
        setPassword("");
        document.getElementById("password")?.focus();
      }
    } finally {
      setLoading(false);
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
            className="aapm-link"
          >
            Buat akun
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
          labelAction={<Link to="/forgot-password" className="aapm-link">Lupa kata sandi?</Link>}
        />
        <Button type="submit" size="lg" block loading={loading}>
          {loading ? "Memeriksa akun…" : "Masuk"}
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
            onClick={() => { window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`; }}
          >
            <GoogleIcon />
            Lanjutkan dengan Google
          </Button>
        </>
      )}
    </AuthLayout>
  );
}
