import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { Button, Alert } from "@/components/primitives";
import AuthLayout from "@/components/AuthLayout";
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
         subtitle="Tautan kata sandi ini tidak lengkap atau sudah tidak berlaku."
        footer={
          <Link to="/forgot-password" className="aapm-auth__link">
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
      <AuthLayout title="Buat kata sandi baru" subtitle="Gunakan kata sandi baru untuk mengamankan akun Academy.">
      {error && <Alert tone="danger" description={error} className="mb-5" />}
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordField
          id="password"
          label="Kata sandi baru"
          autoComplete="new-password"
          autoFocus
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
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
          {loading ? "Menyimpan password…" : "Simpan password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
