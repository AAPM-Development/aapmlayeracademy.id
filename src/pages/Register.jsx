import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { Button, Alert, Field, InputGroup } from "@/components/primitives";
import AuthLayout from "@/components/AuthLayout";
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
            className="aapm-auth__link"
          >
            Masuk
          </Link>
        </>
      }
    >
      {error && <Alert tone="danger" description={error} className="mb-5" />}

      <form onSubmit={handleSubmit} className="space-y-4">
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
        <Button type="submit" size="lg" block loading={loading}>
          {loading ? "Membuat akun…" : "Buat akun"}
        </Button>
      </form>
      {googleAvailable && (
        <>
          <div className="aapm-auth__divider my-6">atau</div>
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
