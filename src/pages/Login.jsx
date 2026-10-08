import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { useAuth } from "@/lib/AuthContext";
import { Button, Alert, Field, InputGroup } from "@/components/primitives";
import AuthLayout from "@/components/AuthLayout";
import PasswordField from "@/components/PasswordField";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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
    setLoading(true);
    try {
      await nativeApi.auth.login(email, password);
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Email atau password belum sesuai.");
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
            className="aapm-auth__link"
          >
            Buat akun
          </Link>
        </>
      }
    >
      {error && <Alert tone="danger" description={error} className="mb-5" />}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Field id="email" label="Alamat email">
            <InputGroup
              leadingIcon="mail"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="nama@perusahaan.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>

        <div className="space-y-2">
          <PasswordField
            id="password"
             label="Kata sandi"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex justify-end pt-1">
            <Link
              to="/forgot-password"
              className="aapm-auth__link"
            >
               Lupa kata sandi?
            </Link>
          </div>
        </div>

        <Button type="submit" size="lg" block loading={loading}>
          {loading ? "Memeriksa akun…" : "Masuk"}
        </Button>
      </form>
      {googleAvailable && (
        <>
          <div className="aapm-auth__divider my-6">atau lanjutkan dengan</div>
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
