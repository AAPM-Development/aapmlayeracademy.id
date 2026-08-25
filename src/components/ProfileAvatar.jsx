import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export default function ProfileAvatar({
  user = null,
  name = "",
  className = "h-9 w-9",
  fallbackClassName = "bg-tint-green text-brand-green",
  alt,
}) {
  const displayName = name || user?.full_name || user?.email || "Peserta";
  const initial = displayName.trim().slice(0, 1).toUpperCase() || "P";
  const source = user?.avatar || user?.avatarData || "";

  return (
    <Avatar className={cn("shrink-0", className)}>
      {source && <AvatarImage src={source} alt={alt || `Foto profil ${displayName}`} className="object-cover" />}
      <AvatarFallback className={cn("text-xs font-semibold", fallbackClassName)}>
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
