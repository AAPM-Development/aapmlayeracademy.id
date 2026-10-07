import React, { useState } from "react";
import { Link } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { Alert, Button, Field, InputGroup } from "@/components/primitives";
import AuthLayout from "@/components/AuthLayout";
import AapmIcon from "@/components/icons/AapmIcon";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetLink, setDevResetLink] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await nativeApi.auth.requestPasswordReset(email);
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

  return (
    <AuthLayout
      iconName="mail"
      title="Atur ulang password"
      subtitle="Kami akan mengirim tautan untuk membuat kata sandi baru."
      footer={
          <Link to="/login" className="aapm-auth__link">
           <AapmIcon name="arrowLeft" />Kembali ke halaman masuk
        </Link>
      }
    >
      {sent ? (
        <div className="aapm-auth__stack">
          <Alert tone="success" title="Periksa email Anda" description="Jika akun dengan email tersebut tersedia, tautan reset akan segera dikirim." />
          {devResetLink && (
            <a className="aapm-auth__link" href={devResetLink}>
              Buka tautan reset
            </a>
          )}
        </div>
      ) : (
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
          <Button type="submit" size="lg" block loading={loading}>
          {loading ? "Mengirim tautan…" : "Kirim tautan reset"}
        </Button>
        </form>
      )}
    </AuthLayout>
  );
}
