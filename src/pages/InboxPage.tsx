import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { Search, MessageCircle, Loader2, UserPlus, Bell } from "lucide-react";
import {
  getConversations, searchUsers, startConversation,
  type ConversationItem,
} from "../lib/auth";

type Tab = 'all' | 'unread' | 'requests';

export function chatListTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (dayDiff <= 0) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return `${dayDiff}d`;
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export default function InboxPage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const chatPath = (conversationId: string) =>
    username ? `/${username}/chat/${conversationId}` : `/user-chat/${conversationId}`;
  const loginPath = username ? "/login" : "/userlogin";
  const inboxRedirect = username ? `${username}/inbox` : "user-inbox";

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [startError, setStartError] = useState("");
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState("");
  const [foundUsers, setFoundUsers] = useState<{ username: string; full_name: string; avatar_url: string }[]>([]);
  const [isStarting, setIsStarting] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const response = await getConversations();
      if (cancelled) return;
      if (response.error && /unauthorized|login/i.test(response.error)) {
        navigate(`${loginPath}?redirect=${encodeURIComponent(inboxRedirect)}`, { replace: true });
        return;
      }
      if (response.error) {
        setLoadError(response.error);
        setConversations([]);
      } else {
        setLoadError("");
        setConversations(response.conversations || []);
      }
      setIsLoading(false);
    };
    load();
    const interval = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [navigate, loginPath, inboxRedirect]);

  // Username lookup when the search text matches no existing chats
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      setFoundUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      const response = await searchUsers(q);
      setFoundUsers(response.users || []);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const requests = conversations.filter((c) => c.is_request);
  const nonRequests = conversations.filter((c) => !c.is_request);
  const unreadCount = nonRequests.filter((c) => c.unread > 0).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = tab === 'requests' ? requests : nonRequests;
    if (tab === 'unread') list = list.filter((c) => c.unread > 0);
    if (q) {
      list = list.filter((c) =>
        c.other.username.toLowerCase().includes(q) || (c.other.full_name || '').toLowerCase().includes(q));
    }
    return list;
  }, [conversations, tab, query]);

  const existingUsernames = new Set(conversations.map((c) => c.other.username));
  const newUsers = query.trim().length >= 2
    ? foundUsers.filter((u) => !existingUsernames.has(u.username))
    : [];

  const handleStartChat = async (targetUsername: string) => {
    if (isStarting) return;
    setStartError("");
    setIsStarting(targetUsername);
    const response = await startConversation(targetUsername);
    setIsStarting("");
    if (response.error && /unauthorized|login/i.test(response.error)) {
      navigate(`${loginPath}?redirect=${encodeURIComponent(inboxRedirect)}`, { replace: true });
      return;
    }
    if (response.conversation_id) {
      navigate(chatPath(response.conversation_id));
      return;
    }
    setStartError(response.error || "Could not start chat. Try again.");
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: 'All chats' },
    { id: 'unread', label: unreadCount ? `Unread (${unreadCount})` : 'Unread' },
    { id: 'requests', label: requests.length ? `Requests (${requests.length})` : 'Requests' },
  ];

  return (
    <div className={`min-h-screen bg-white ${username ? "pt-14 pb-16 md:pt-8 md:pb-8" : "pt-6 pb-8"}`}>
      <main className="container mx-auto px-4 max-w-2xl py-4">
        <div className={`flex items-center justify-between mb-4 ${username ? "hidden md:flex" : ""}`}>
          <h1 className="text-xl font-bold text-zinc-900">Inbox</h1>
          {!username && (
            <button
              onClick={() => navigate("/user-notifications")}
              className="p-2 rounded-full hover:bg-zinc-100 text-zinc-700"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-full text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-400"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                tab === t.id ? 'bg-rose-50 text-rose-600' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'requests' && requests.length > 0 && (
          <p className="text-xs text-zinc-400 mb-3 px-1">
            First messages from new people land here. Accept or reply to move a chat to All chats.
          </p>
        )}

        {(loadError || startError) && (
          <p className="text-sm text-red-500 mb-3 px-1" role="alert">
            {startError || loadError}
          </p>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 text-rose-500 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {visible.map((convo) => (
              <motion.button
                key={convo.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => navigate(chatPath(convo.id))}
                className="w-full flex items-center gap-3 py-3 px-1 text-left hover:bg-zinc-50 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-200 shrink-0">
                  {convo.other.avatar_url ? (
                    <img src={convo.other.avatar_url} alt={convo.other.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold">
                      {convo.other.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${convo.unread ? 'font-bold text-zinc-900' : 'font-semibold text-zinc-900'}`}>
                    {convo.other.full_name || convo.other.username}
                  </p>
                  <p className={`text-sm truncate ${convo.unread ? 'text-zinc-900 font-medium' : 'text-zinc-500'}`}>
                    {convo.last_message.preview || 'Say hi 👋'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-[11px] text-zinc-400">{chatListTime(convo.last_message.created_at)}</span>
                  {convo.unread > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 bg-rose-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                      {convo.unread}
                    </span>
                  )}
                </div>
              </motion.button>
            ))}

            {/* Start new chats from user search */}
            {newUsers.length > 0 && (
              <div className="pt-3">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide px-1 mb-1.5">New chat</p>
                {newUsers.map((u) => (
                  <button
                    key={u.username}
                    onClick={() => handleStartChat(u.username)}
                    disabled={Boolean(isStarting)}
                    className="w-full flex items-center gap-3 py-3 px-1 text-left hover:bg-zinc-50 rounded-xl transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-200 shrink-0">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{u.full_name || u.username}</p>
                      <p className="text-sm text-zinc-500 truncate">@{u.username}</p>
                    </div>
                    <span className="shrink-0 text-rose-500">
                      {isStarting === u.username ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {!visible.length && !newUsers.length && (
              <div className="py-20 text-center">
                <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-7 h-7 text-rose-500" />
                </div>
                <p className="font-semibold text-zinc-900 mb-1">
                  {tab === 'requests' ? 'No requests' : tab === 'unread' ? 'No unread chats' : 'No messages yet'}
                </p>
                <p className="text-sm text-zinc-500">
                  {tab === 'requests'
                    ? 'Message requests from new people will show up here.'
                    : 'Search a username above to start a conversation.'}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
