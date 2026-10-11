import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { Button, Alert } from "@/components/primitives";
import AuthLayout from "@/components/AuthLayout";
import PasswordField from "@/components/PasswordField";
import {
  collectErrors,
  confirmPasswordError,
  focusFirstError,
  newPasswordError,
} from "@/lib/authValidation";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  // An expired or used token can never succeed: offer a new link in the Alert.
  const [tokenRejected, setTokenRejected] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const clearError = (field) => setFieldErrors((current) => ({ ...current, [field]: "" }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setTokenRejected(false);
    const errors = collectErrors({
      password: newPasswordError(newPassword),
      confirm: confirmPasswordError(confirmPassword, newPassword),
    });
    setFieldErrors(errors || {});
    if (errors) {
      focusFirstError(errors);
      return;
    }
    setLoading(true);
    try {
      await nativeApi.auth.resetPassword(resetToken, newPassword);
      window.location.href = "/login";
    } catch (err) {
      setError(err.message || "Kata sandi belum berhasil diperbarui.");
      setTokenRejected(err.code === "invalid_reset_token");
    } finally {
      setLoading(false);
    }
  };

  if (!resetToken) {
    return (
      <AuthLayout
        icon="link"
        tone="danger"
        title="Tautan reset tidak valid"
        subtitle="Tautan kata sandi ini tidak lengkap atau sudah tidak berlaku."
        back={{ to: "/login" }}
      >
        <Button asChild size="lg" block>
          <Link to="/forgot-password">Minta tautan baru</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon="lock"
      title="Buat kata sandi baru"
      subtitle="Gunakan kata sandi baru untuk mengamankan akun Academy."
      back={{ to: "/login" }}
    >
      {error && (
        <Alert
          tone="danger"
          description={error}
         
          action={tokenRejected ? (
            <Button asChild variant="secondary" size="sm">
              <Link to="/forgot-password">Minta tautan baru</Link>
            </Button>
          ) : null}
        />
      )}
      <form onSubmit={handleSubmit} noValidate>
        <PasswordField
          id="password"
          label="Kata sandi baru"
          autoComplete="new-password"
          autoFocus
          requirements
          error={fieldErrors.password}
          value={newPassword}
          onChange={(e) => { setNewPassword(e.target.value); clearError("password"); }}
          minLength={8}
        />
        <PasswordField
          id="confirm"
          label="Konfirmasi kata sandi baru"
          autoComplete="new-password"
          placeholder="Ketik ulang kata sandi"
          error={fieldErrors.confirm}
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); clearError("confirm"); }}
          minLength={8}
        />
        <Button type="submit" size="lg" block loading={loading}>
          {loading ? "Menyimpan kata sandi…" : "Simpan kata sandi"}
        </Button>
      </form>
    </AuthLayout>
  );
}
