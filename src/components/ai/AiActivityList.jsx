import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";

const activityMeta = {
  question: {
    icon: "solar:chat-round-line-bold-duotone",
    className: "bg-tint-blue text-tint-blue-foreground",
  },
  response: {
    icon: "solar:check-circle-bold-duotone",
    className: "bg-tint-green text-tint-green-foreground",
  },
  fallback: {
    icon: "solar:info-circle-bold-duotone",
    className: "bg-tint-orange text-tint-orange-foreground",
  },
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value) {
  if (!value) return "Baru saja";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "Baru saja" : dateFormatter.format(date);
}

export default function AiActivityList({ activity = [], loading = false }) {
  if (loading)
    return (
      <p className="px-2 py-5 text-xs text-muted-foreground">
        Memuat aktivitas APPI…
      </p>
    );

  if (!activity.length)
    return (
      <p className="px-2 py-5 text-xs leading-5 text-muted-foreground">
        Aktivitas akan tercatat setelah APPI menerima pertanyaan pertama Anda.
      </p>
    );

  return (
    <ol className="relative ml-3 border-l border-border/80 pl-4">
      {activity.map((item) => {
        const meta = activityMeta[item.type] || activityMeta.response;
        return (
          <li key={item.id} className="relative pb-5 last:pb-1">
            <span
              className={`absolute -left-[1.73rem] top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background ${meta.className}`}
              aria-hidden="true"
            >
              <AapmIcon name={meta.icon} className="h-3.5 w-3.5" />
            </span>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <p className="min-w-0 text-xs font-semibold text-foreground">
                {item.label}
              </p>
              <time className="shrink-0 text-[9px] text-muted-foreground">
                {formatDate(item.createdAt)}
              </time>
            </div>
            {item.detail && (
              <p className="mt-1 line-clamp-2 break-words text-[10px] leading-4 text-muted-foreground">
                {item.detail}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function AiHistoryTabs({ value, onChange }) {
  return (
    <div className="mx-3 grid grid-cols-2 rounded-lg bg-surface-subtle p-1">
      {[
        ["chats", "Percakapan"],
        ["activity", "Aktivitas"],
      ].map(([option, label]) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition-colors ${value === option ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          aria-pressed={value === option}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
