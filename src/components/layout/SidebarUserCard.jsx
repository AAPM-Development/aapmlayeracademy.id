import React from "react";
import ProfileAvatar from "@/components/ProfileAvatar";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";

/**
 * Compact account row for the sidebar footer.
 *
 * Identity is navigation context, not another panel. Keep it as one quiet
 * row so the sidebar does not introduce a card inside the shell's surface.
 */
export default function SidebarUserCard({
  user = null,
  name = "",
  context = "Peserta Layer Farm",
  collapsed = false,
  active = false,
  onClick = () => {},
  className = "",
} = {}) {
  const displayName = name || user?.full_name || user?.email || "Peserta";
  const secondary = user?.email && user.email !== displayName ? user.email : context;

  return (
    <button
      type="button"
      className={cn(
        // MobileSidebar closes canonical nav actions by this marker.
        "t7-nav-item aapm-sidebar-profile-row",
        collapsed && "aapm-sidebar-profile-row--collapsed",
        className,
      )}
      data-t7-region="sidebar-account"
      data-active={active ? "true" : "false"}
      aria-current={active ? "page" : undefined}
      aria-label={`Buka profil ${displayName}`}
      onClick={onClick}
    >
      <ProfileAvatar
        user={user}
        name={displayName}
        className="aapm-sidebar-profile-row__avatar"
        fallbackClassName="bg-tint-green text-brand-green"
      />
      {!collapsed && (
        <span className="aapm-sidebar-profile-row__copy">
          <span className="aapm-sidebar-profile-row__name">{displayName}</span>
          <span className="aapm-sidebar-profile-row__meta">{secondary}</span>
        </span>
      )}
      {!collapsed && <AapmIcon name="chevronRight" className="aapm-sidebar-profile-row__chevron" aria-hidden="true" />}
    </button>
  );
}
