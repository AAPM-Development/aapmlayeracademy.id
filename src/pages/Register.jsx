import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/AuthLayout";
import AapmIcon from "@/components/icons/AapmIcon";
import PasswordField from "@/components/PasswordField";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
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
    if (password !== confirmPassword) {
      setError("Konfirmasi password belum sama.");
      return;
    }
    setLoading(true);
    try {
      await nativeApi.auth.register({ email, password });
      window.location.href = safeReturnTo();
    } catch (err) {
      setError(err.message || "Pendaftaran belum berhasil.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Buat akun Academy"
      subtitle="Mulai jalur belajar yang terukur untuk keputusan farm Anda."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link
            to={"/login" + (safeReturnTo() !== "/" ? "?returnTo=" + encodeURIComponent(safeReturnTo()) : "")}
            className="text-primary font-medium hover:underline"
          >
            Masuk
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AapmIcon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-semibold text-foreground">Alamat email</Label>
          <div className="aapm-field relative rounded-xl">
            <AapmIcon name="mail" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
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
        <PasswordField
          id="password"
           label="Kata sandi"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
        />
        <p className="-mt-2 text-xs text-muted-foreground">Minimal 8 karakter dan harus memuat huruf serta angka.</p>
        <PasswordField
          id="confirm"
           label="Konfirmasi kata sandi"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
        />
        <Button type="submit" className="h-12 w-full shadow-[var(--card-shadow)]" disabled={loading}>
          {loading ? (
            <>
              <AapmIcon name="loading" className="mr-2 h-4 w-4 animate-spin" />
              Membuat akun…
            </>
          ) : (
            "Buat akun"
          )}
        </Button>
      </form>
      {googleAvailable && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>atau</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl bg-surface-subtle font-medium shadow-none hover:bg-surface-hover"
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
