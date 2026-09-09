import React from "react";
import ProfileAvatar from "@/components/ProfileAvatar";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";

/**
 * Compact account surface for the sidebar footer.
 *
 * The account is an action, but it is intentionally composed as a user card
 * instead of a third navigation row. This keeps identity, context, and the
 * destination affordance together while preserving the sidebar's canonical
 * Ten4Seven spacing and focus contract.
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
        // MobileSidebar closes canonical nav actions by this marker. Keeping
        // the marker preserves drawer behavior without changing the card
        // into a visually generic navigation row.
        "t7-nav-item aapm-sidebar-user-card",
        collapsed && "aapm-sidebar-user-card--collapsed",
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
        className="aapm-sidebar-user-card__avatar"
        fallbackClassName="bg-tint-green text-brand-green"
      />
      {!collapsed && (
        <span className="aapm-sidebar-user-card__copy">
          <span className="aapm-sidebar-user-card__name">{displayName}</span>
          <span className="aapm-sidebar-user-card__meta">{secondary}</span>
        </span>
      )}
      {!collapsed && <AapmIcon name="chevronRight" className="aapm-sidebar-user-card__chevron" aria-hidden="true" />}
    </button>
  );
}
