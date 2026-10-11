import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function initialsOf(name = "") {
  const words = String(name).replace(/@.*/, "").trim().split(/[\s._-]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "P").slice(0, 2);
  return letters.toUpperCase();
}

/** Canvas avatar (`.avatar`): the profile photo, or two initials on a hue disc. */
export default function ProfileAvatar({
  user = null,
  name = "",
  className = "avatar-sm",
  hue = "green",
  alt,
}) {
  const displayName = name || user?.full_name || user?.email || "Peserta";
  const source = user?.avatar || user?.avatarData || "";
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);

  return (
    <span className={cn("avatar", className)} data-hue={hue}>
      {source && !failed ? (
        <img src={source} alt={alt || `Foto profil ${displayName}`} onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span aria-hidden="true">{initialsOf(displayName)}</span>
      )}
    </span>
  );
}
