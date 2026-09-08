import React, { useState } from "react";
import { Link } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { Button, Input, Label } from "@/components/primitives";
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
          <Link to="/login" className="text-primary font-medium hover:underline">
           <AapmIcon name="arrowLeft" className="mr-1 inline h-3 w-3" />Kembali ke halaman masuk
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-3 text-sm text-foreground text-center">
          <p>Jika akun dengan email tersebut tersedia, tautan reset akan segera dikirim.</p>
          {devResetLink && (
            <a className="text-primary font-medium hover:underline" href={devResetLink}>
              Buka tautan reset
            </a>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-semibold text-foreground">Alamat email</Label>
            <div className="aapm-field aapm-token-control relative rounded-xl">
              <AapmIcon name="mail" className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-foreground/55" />
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
          <Button type="submit" className="h-12 w-full shadow-[var(--card-shadow)]" disabled={loading}>
            {loading ? (
              <>
                <AapmIcon name="loading" className="mr-2 h-4 w-4 animate-spin" />
                Mengirim tautan…
              </>
            ) : (
              "Kirim tautan reset"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
