import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
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
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await nativeApi.auth.resetPassword(resetToken, newPassword);
      window.location.href = "/login";
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!resetToken) {
    return (
      <AuthLayout
        title="Invalid reset link"
        subtitle="This password reset link is missing or invalid"
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            Request a new link
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          The link you used appears to be incomplete. Please request a new password reset email.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="New password" subtitle="Enter your new password below">
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordField
          id="password"
          label="New Password"
          autoComplete="new-password"
          autoFocus
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
        />
        <p className="-mt-2 text-xs text-muted-foreground">Minimal 8 karakter dan harus memuat huruf serta angka.</p>
        <PasswordField
          id="confirm"
          label="Confirm Password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
        />
        <Button type="submit" className="h-12 w-full rounded-xl font-medium shadow-[var(--card-shadow)] hover:-translate-y-0.5" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Resetting...
            </>
          ) : (
            "Reset password"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
