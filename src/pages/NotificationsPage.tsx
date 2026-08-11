import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Bell, Check, Heart, IndianRupee, Plus, Loader2, UserPlus } from "lucide-react";
import {
  getNotifications,
  markNotificationsRead,
  type NotificationItem,
} from "../lib/auth";

const timeAgo = (iso: string): string => {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const isToday = (iso: string): boolean => {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
};

const BADGE: Record<
  NotificationItem["type"],
  { icon: React.ElementType; className: string }
> = {
  like: { icon: Heart, className: "bg-rose-500" },
  purchase: { icon: IndianRupee, className: "bg-amber-500" },
  follow: { icon: UserPlus, className: "bg-violet-500" },
  request: { icon: Plus, className: "bg-sky-500" },
  accept: { icon: Check, className: "bg-emerald-500" },
};

const messageFor = (n: NotificationItem): React.ReactNode => {
  const name = n.actor.full_name || n.actor.username || "Someone";
  const caption = n.post_caption
    ? ` \u201C${n.post_caption.length > 34 ? `${n.post_caption.slice(0, 34)}\u2026` : n.post_caption}\u201D`
    : "";
  switch (n.type) {
    case "like":
      return (
        <>
          <span className="font-semibold">{name}</span> liked your post{caption ? <>{" "}<span className="text-zinc-600">{caption}</span></> : "."}
        </>
      );
    case "purchase":
      return (
        <>
          <span className="font-semibold">{name}</span> unlocked your paid post{caption ? <>{" "}<span className="text-zinc-600">{caption}</span></> : "."}
        </>
      );
    case "follow":
      return (
        <>
          <span className="font-semibold">{name}</span> started following you.
        </>
      );
    case "request":
      return (
        <>
          <span className="font-semibold">{name}</span> sent you a message request.
        </>
      );
    case "accept":
      return (
        <>
          <span className="font-semibold">{name}</span> accepted your message request.
        </>
      );
  }
};

function NotificationRow({
  item,
  unread,
  onOpen,
}: {
  key?: React.Key;
  item: NotificationItem;
  unread: boolean;
  onOpen: (n: NotificationItem) => void;
}) {
  const badge = BADGE[item.type];
  const BadgeIcon = badge.icon;
  const initial = (item.actor.full_name || item.actor.username || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <button
      onClick={() => onOpen(item)}
      className="w-full flex items-start gap-3.5 px-4 py-3.5 text-left hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
    >
      <div className="relative shrink-0">
        {item.actor.avatar_url ? (
          <img
            src={item.actor.avatar_url}
            alt={item.actor.username}
            className="w-12 h-12 rounded-full object-cover bg-zinc-100"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center font-bold text-lg">
            {initial}
          </div>
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full ${badge.className} ring-2 ring-white flex items-center justify-center`}
        >
          <BadgeIcon className="w-2.5 h-2.5 text-white" strokeWidth={3} />
        </span>
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-[14px] leading-snug text-zinc-900">{messageFor(item)}</p>
        <p className="text-xs text-zinc-400 mt-1">{timeAgo(item.created_at)}</p>
      </div>

      {unread && (
        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-2.5" aria-label="Unread" />
      )}
    </button>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();
  const homePath = username ? `/${username}` : "/user-inbox";
  const loginPath = username ? "/login" : "/userlogin";
  const notifRedirect = username ? `${username}/notifications` : "user-notifications";

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  // Ids that were unread when the page loaded — they stay in "New" for this
  // visit even after we mark them read on the server.
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const markedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await getNotifications();
      if (cancelled) return;
      setIsLoading(false);
      if (response.error && /unauthorized|login/i.test(response.error)) {
        navigate(`${loginPath}?redirect=${encodeURIComponent(notifRedirect)}`, { replace: true });
        return;
      }
      if (response.error || !Array.isArray(response.notifications)) {
        setError(response.error || "Failed to load notifications.");
        return;
      }
      setItems(response.notifications);
      setNewIds(new Set(response.notifications.filter((n) => !n.read).map((n) => n.id)));
      if (!markedRef.current && response.notifications.some((n) => !n.read)) {
        markedRef.current = true;
        markNotificationsRead();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, loginPath, notifRedirect]);

  const groups = useMemo(() => {
    const fresh: NotificationItem[] = [];
    const today: NotificationItem[] = [];
    const earlier: NotificationItem[] = [];
    for (const n of items) {
      if (newIds.has(n.id)) fresh.push(n);
      else if (isToday(n.created_at)) today.push(n);
      else earlier.push(n);
    }
    return [
      { label: "New", rows: fresh },
      { label: "Today", rows: today },
      { label: "Earlier", rows: earlier },
    ].filter((g) => g.rows.length > 0);
  }, [items, newIds]);

  const openNotification = (n: NotificationItem) => {
    if ((n.type === "like" || n.type === "purchase") && n.post_public_id) {
      navigate(username ? `/${username}/post/${n.post_public_id}` : `/view/${n.post_public_id}`);
    } else if (n.type === "follow") {
      navigate(username ? `/${username}/inbox` : "/user-inbox");
    } else if ((n.type === "request" || n.type === "accept") && n.conversation_id) {
      navigate(username ? `/${username}/chat/${n.conversation_id}` : `/user-chat/${n.conversation_id}`);
    }
  };

  return (
    <div className={`min-h-screen bg-zinc-50 ${username ? "pt-14 pb-16 md:py-10" : "pt-6 pb-8"}`}>
      <div className="max-w-xl mx-auto px-4 md:px-0 pt-3 md:pt-0">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(homePath)}
            className="p-2 -ml-2 rounded-full hover:bg-zinc-100 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-900" />
          </button>
          <h1 className="text-xl font-bold text-zinc-900">Notifications</h1>
        </div>

        {isLoading && (
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm py-16 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-rose-400 animate-spin" />
          </div>
        )}

        {!isLoading && error && (
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm py-12 px-6 text-center">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-zinc-200 shadow-sm py-16 flex flex-col items-center text-center px-6"
          >
            <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center mb-4 text-rose-400">
              <Bell className="w-8 h-8" />
            </div>
            <p className="text-zinc-900 font-semibold mb-1">No notifications yet</p>
            <p className="text-zinc-500 text-sm max-w-[260px]">
              Follows, paid unlocks, likes, and message requests will show up here.
            </p>
          </motion.div>
        )}

        {!isLoading && !error && items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden"
          >
            {groups.map((group, gi) => (
              <div key={group.label} className={gi > 0 ? "border-t border-zinc-100" : ""}>
                <h2 className="px-4 pt-4 pb-1 text-[15px] font-bold text-zinc-900">
                  {group.label}
                </h2>
                <div className="divide-y divide-zinc-50">
                  {group.rows.map((n) => (
                    <NotificationRow
                      key={n.id}
                      item={n}
                      unread={newIds.has(n.id)}
                      onOpen={openNotification}
                    />
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
