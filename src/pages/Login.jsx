import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
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
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      variant="login"
      title="Sign in"
      subtitle="Continue your learning journey."
      footer={
        <>
          New to the Academy?{" "}
          <Link
            to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
            className="font-medium text-[var(--brand-aapm-green)] underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      {error && (
        <div
          className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <LoginLabel htmlFor="email" className="text-xs font-semibold text-foreground">Email address</LoginLabel>
          <LoginInput
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl border-border/80 bg-surface-subtle px-3 shadow-none placeholder:text-muted-foreground/60 focus:bg-card"
            required
          />
        </div>

        <div className="space-y-2">
          <PasswordField
            id="password"
            label="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex justify-end pt-1">
            <Link
              to="/forgot-password"
              className="text-sm text-[var(--brand-aapm-green)] underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-[var(--brand-aapm-green)] font-semibold text-white shadow-[var(--card-shadow)] hover:-translate-y-0.5 hover:bg-[#286b2f]"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
      {googleAvailable && (
        <>
          <div className="my-7 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>or continue with</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl bg-surface-subtle font-medium shadow-none hover:bg-surface-hover"
            onClick={() => { window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`; }}
          >
            <GoogleIcon />
            Continue with Google
          </Button>
        </>
      )}
    </AuthLayout>
  );
}
