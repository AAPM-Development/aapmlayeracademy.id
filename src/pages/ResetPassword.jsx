import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/AuthLayout";
import AapmIcon from "@/components/icons/AapmIcon";
import PasswordField from "@/components/PasswordField";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password belum sama.");
      return;
    }
    setLoading(true);
    try {
      await nativeApi.auth.resetPassword(resetToken, newPassword);
      window.location.href = "/login";
    } catch (err) {
      setError(err.message || "Password belum berhasil diperbarui.");
    } finally {
      setLoading(false);
    }
  };

  if (!resetToken) {
    return (
      <AuthLayout
        title="Tautan reset tidak valid"
        subtitle="Tautan password ini tidak lengkap atau sudah tidak berlaku."
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            Minta tautan baru
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          Tautan yang digunakan tidak lengkap. Minta tautan reset baru untuk melanjutkan.
        </p>
      </AuthLayout>
    );
  }

  return (
      <AuthLayout title="Buat password baru" subtitle="Gunakan password baru untuk mengamankan akun Academy.">
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AapmIcon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordField
          id="password"
          label="Password baru"
          autoComplete="new-password"
          autoFocus
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
        />
        <p className="-mt-2 text-xs text-muted-foreground">Minimal 8 karakter dan harus memuat huruf serta angka.</p>
        <PasswordField
          id="confirm"
          label="Konfirmasi password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
        />
        <Button type="submit" className="h-12 w-full shadow-[var(--card-shadow)]" disabled={loading}>
          {loading ? (
            <>
              <AapmIcon name="loading" className="mr-2 h-4 w-4 animate-spin" />
              Menyimpan password…
            </>
          ) : (
            "Simpan password"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
