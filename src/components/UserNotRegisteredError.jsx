import React from "react";
import { StatusPage, StatusTile } from "@/design-system/patterns/AppShell";
import { useAuth } from "@/lib/AuthContext";

/**
 * Signed in, but the account has no Academy access yet. No admin contact
 * address is configured, so the canvas "Hubungi admin" button is left out.
 */
const UserNotRegisteredError = () => {
  const { logout } = useAuth();
  return (
    <StatusPage
      visual={<StatusTile ic="user" tone="warning" />}
      title="Akun Anda belum terdaftar di Academy"
      text="Hubungi admin Academy untuk meminta akses, atau masuk dengan akun lain."
      actions={<button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => logout(true)}>Masuk dengan akun lain</button>}
    />
  );
};

export default UserNotRegisteredError;
