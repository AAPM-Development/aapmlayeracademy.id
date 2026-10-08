import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { Button, Alert } from "@/components/primitives";
import AuthLayout from "@/components/AuthLayout";
import PasswordField from "@/components/PasswordField";
import AapmIcon from "@/components/icons/AapmIcon";
import {
  NEW_PASSWORD_HINT,
  collectErrors,
  confirmPasswordError,
  focusFirstError,
  newPasswordError,
} from "@/lib/authValidation";

const backToLogin = (
  <Link to="/login" className="aapm-link">
    <AapmIcon name="arrowLeft" />Kembali ke halaman masuk
  </Link>
);

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
        iconName="danger"
        iconHue="rose"
        title="Tautan reset tidak valid"
        subtitle="Tautan kata sandi ini tidak lengkap atau sudah tidak berlaku."
        footer={backToLogin}
      >
        <Button asChild size="lg" block>
          <Link to="/forgot-password"><AapmIcon name="mail" />Minta tautan baru</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      iconName="lock"
      title="Buat kata sandi baru"
      subtitle="Gunakan kata sandi baru untuk mengamankan akun Academy."
      footer={backToLogin}
    >
      {error && (
        <Alert
          tone="danger"
          description={error}
          className="aapm-auth__alert"
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
          placeholder="Minimal 8 karakter"
          hint={NEW_PASSWORD_HINT}
          error={fieldErrors.password}
          value={newPassword}
          onChange={(e) => { setNewPassword(e.target.value); clearError("password"); }}
          minLength={8}
        />
        <PasswordField
          id="confirm"
          label="Konfirmasi kata sandi"
          autoComplete="new-password"
          placeholder="Ulangi kata sandi"
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
