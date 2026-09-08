import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { Button, Input, Label } from "@/components/primitives";
import AuthLayout from "@/components/AuthLayout";
import AapmIcon from "@/components/icons/AapmIcon";
import PasswordField from "@/components/PasswordField";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

/** @type {any} */
const LoginInput = Input;
/** @type {any} */
const LoginLabel = Label;

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

  return (
    <AuthLayout
      variant="login"
      title="Masuk ke Academy"
      subtitle="Lanjutkan ritme belajar Anda di farm."
      footer={
        <>
          Belum punya akun?{" "}
          <Link
            to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
            className="font-semibold text-brand-green underline-offset-4 hover:underline"
          >
            Buat akun
          </Link>
        </>
      }
    >
      {error && (
        <div
          className="mb-6 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
          aria-live="polite"
        >
          <AapmIcon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <LoginLabel htmlFor="email" className="text-xs font-semibold text-foreground">Alamat email</LoginLabel>
          <div className="aapm-field aapm-token-control relative rounded-xl">
            <AapmIcon name="mail" className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-foreground/55" />
            <LoginInput
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="nama@perusahaan.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl border-border/80 bg-surface-subtle pl-10 shadow-none placeholder:text-muted-foreground/60 focus:bg-card"
              required
            />
          </div>
        </div>

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
              className="text-sm font-medium text-brand-green underline-offset-4 hover:underline"
            >
               Lupa kata sandi?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          className="h-12 w-full bg-brand-green text-white shadow-[var(--card-shadow)] hover:bg-brand-green/90"
          disabled={loading}
        >
          {loading ? (
            <>
              <AapmIcon name="loading" className="mr-2 h-4 w-4 animate-spin" />
              Memeriksa akun…
            </>
          ) : (
            "Masuk"
          )}
        </Button>
      </form>
      {googleAvailable && (
        <>
          <div className="my-7 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>atau lanjutkan dengan</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl bg-surface-subtle font-medium shadow-none hover:bg-surface-hover"
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
