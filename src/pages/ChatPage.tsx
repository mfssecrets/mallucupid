import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, MoreVertical, Send, Plus, Smile, Loader2, X,
  Trash2, Ban, Flag, AlertCircle, Eye, CheckCheck, Check, ImagePlus,
} from "lucide-react";
import {
  getMessages, sendMessage, getChatUploadUrl, uploadFileWithProgress, viewOnceMessage,
  deleteMessages, deleteChat, blockChatUser, reportChatUser, acceptConversation,
  REPORT_REASONS,
  type ChatConversation, type ChatMessage,
} from "../lib/auth";
import { useAuth } from "../lib/useAuth";
import { CaptureShield, SecureImage, SecureVideo, useCaptureDeterrent } from "../components/SecureMedia";

const EMOJIS = [
  '😀', '😂', '🤣', '😊', '😍', '😘', '😜', '🤗', '🤩', '😎',
  '🥰', '😇', '🙃', '😉', '😌', '🤔', '😴', '🥺', '😢', '😭',
  '😡', '🤯', '🥳', '😷', '👍', '👎', '👏', '🙏', '💪', '🤝',
  '❤️', '💖', '💕', '🔥', '✨', '🎉', '🌹', '💯', '😻', '🫶',
];

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const dayLabel = (iso: string) => {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
};

export default function ChatPage() {
  const { username, conversationId } = useParams<{ username: string; conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const obscured = useCaptureDeterrent();
  const watermark = user?.user_metadata?.username || user?.user_metadata?.name || "MalluCupid";
  const inboxPath = username ? `/${username}/inbox` : "/user-inbox";
  const goBack = () => navigate(inboxPath);

  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  // Attachment
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachment, setAttachment] = useState<{ file: File; previewUrl: string; kind: 'image' | 'video' } | null>(null);
  const [isOnceSend, setIsOnceSend] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  // Selection / delete
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDeleteMsgOpen, setIsDeleteMsgOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);

  // Menus & modals
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteChatOpen, setIsDeleteChatOpen] = useState(false);
  const [isBlockOpen, setIsBlockOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportDone, setReportDone] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Fullscreen media (normal + view once)
  const [mediaView, setMediaView] = useState<{ url: string; kind: 'image' | 'video'; once: boolean } | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastCountRef = useRef(0);

  const load = useCallback(async (initial = false) => {
    if (!conversationId) return;
    const response = await getMessages(conversationId);
    if (response.conversation) {
      setConversation(response.conversation);
      setMessages(response.messages || []);
      setLoadError("");
    } else if (response.error && /unauthorized|login/i.test(response.error)) {
      const loginPath = username ? "/login" : "/userlogin";
      const redirect = username ? `${username}/chat/${conversationId}` : `user-chat/${conversationId}`;
      navigate(`${loginPath}?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      return;
    } else if (initial) {
      setLoadError(response.error || "Failed to load chat");
    }
    if (initial) setIsLoading(false);
  }, [conversationId, navigate, username]);

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(false), 4000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (messages.length !== lastCountRef.current) {
      lastCountRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const selectionMode = selected.size > 0;
  const selectedMessages = messages.filter((m) => selected.has(m.id));
  const allSelectedMine = selectedMessages.length > 0 && selectedMessages.every((m) => m.sender_is_me);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startLongPress = (id: string) => {
    longPressTimer.current = window.setTimeout(() => toggleSelect(id), 450);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!conversationId || isSending || (!text && !attachment)) return;
    setIsSending(true);
    setSendError("");

    let mediaPath = "";
    let mediaType: 'image' | 'video' | '' = "";
    if (attachment) {
      const signed = await getChatUploadUrl(conversationId, attachment.file.type, attachment.file.size);
      if (!signed.upload_url || !signed.path) {
        setSendError(signed.error || "Failed to attach media");
        setIsSending(false);
        return;
      }
      try {
        setUploadPct(0);
        await uploadFileWithProgress(signed.upload_url, attachment.file, attachment.file.type, (loaded) => {
          setUploadPct(Math.min(99, Math.round((loaded / attachment.file.size) * 100)));
        });
      } catch {
        setSendError("Upload failed. Try again.");
        setIsSending(false);
        setUploadPct(null);
        return;
      }
      mediaPath = signed.path;
      mediaType = signed.media_type || attachment.kind;
      setUploadPct(null);
    }

    const response = await sendMessage({
      conversation_id: conversationId,
      body: text,
      media_path: mediaPath,
      media_type: mediaType,
      is_once: isOnceSend && Boolean(mediaPath),
    });

    if (response.status === 'sent') {
      setDraft("");
      if (attachment) URL.revokeObjectURL(attachment.previewUrl);
      setAttachment(null);
      setIsOnceSend(false);
      setIsEmojiOpen(false);
      await load(false);
    } else {
      setSendError(response.error || "Failed to send");
    }
    setIsSending(false);
  };

  const handlePickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null;
    if (!kind) {
      setSendError("Only photos and videos can be attached");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setSendError("Attachment must be 100MB or smaller");
      return;
    }
    setSendError("");
    setAttachment({ file, previewUrl: URL.createObjectURL(file), kind });
  };

  const handleViewOnce = async (msg: ChatMessage) => {
    const response = await viewOnceMessage(msg.id);
    if (response.media_url) {
      setMediaView({ url: response.media_url, kind: (response.media_type as 'image' | 'video') || 'image', once: true });
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, once_state: 'opened' } : m)));
    }
  };

  const handleDeleteSelected = async (mode: 'me' | 'both') => {
    if (!conversationId || isBusy) return;
    setIsBusy(true);
    await deleteMessages(conversationId, [...selected], mode);
    setSelected(new Set());
    setIsDeleteMsgOpen(false);
    await load(false);
    setIsBusy(false);
  };

  const handleDeleteChat = async (mode: 'me' | 'both') => {
    if (!conversationId || isBusy) return;
    setIsBusy(true);
    await deleteChat(conversationId, mode);
    navigate(inboxPath, { replace: true });
  };

  const handleBlockToggle = async () => {
    if (!conversationId || isBusy || !conversation) return;
    setIsBusy(true);
    await blockChatUser(conversationId, !conversation.blocked_by_me);
    setIsBlockOpen(false);
    await load(false);
    setIsBusy(false);
  };

  const handleReport = async () => {
    if (!conversationId || isBusy) return;
    setReportError("");
    if (!reportReason) {
      setReportError("Please select a reason");
      return;
    }
    if (reportDetails.length > 750) {
      setReportError("Additional details must be 750 characters or fewer");
      return;
    }
    setIsBusy(true);
    const response = await reportChatUser(conversationId, reportReason, reportDetails.trim());
    setIsBusy(false);
    if (response.status === 'report_submitted') {
      setReportDone(true);
    } else {
      setReportError(response.error || "Failed to submit report");
    }
  };

  const handleAccept = async () => {
    if (!conversationId || isBusy) return;
    setIsBusy(true);
    await acceptConversation(conversationId);
    await load(false);
    setIsBusy(false);
  };

  const blockMedia = (e: React.SyntheticEvent) => e.preventDefault();

  const other = conversation?.other;

  return (
    <div className="fixed inset-0 z-[110] bg-white flex flex-col" onContextMenu={blockMedia}>
      {/* Top bar */}
      <div className="h-14 shrink-0 border-b border-zinc-100 flex items-center gap-2 px-2 bg-white">
        {selectionMode ? (
          <>
            <button onClick={() => setSelected(new Set())} aria-label="Cancel selection" className="p-2 text-zinc-700 hover:bg-zinc-100 rounded-full">
              <X className="w-5 h-5" />
            </button>
            <span className="font-semibold text-zinc-900 text-sm flex-1">{selected.size} selected</span>
            <button
              onClick={() => setIsDeleteMsgOpen(true)}
              aria-label="Delete selected"
              className="p-2 text-rose-500 hover:bg-rose-50 rounded-full"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </>
        ) : (
          <>
            <button onClick={goBack} aria-label="Back" className="p-2 text-zinc-700 hover:bg-zinc-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-200 shrink-0">
                {other?.avatar_url ? (
                  <img src={other.avatar_url} alt={other.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm font-bold">
                    {other?.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-900 truncate leading-tight">{other?.full_name || other?.username || ''}</p>
                <p className="text-[11px] text-zinc-400 truncate leading-tight">@{other?.username || ''}</p>
              </div>
            </div>
            <div className="relative">
              <button onClick={() => setIsMenuOpen((o) => !o)} aria-label="Chat options" className="p-2 text-zinc-700 hover:bg-zinc-100 rounded-full">
                <MoreVertical className="w-5 h-5" />
              </button>
              <AnimatePresence>
                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      className="absolute right-0 top-full mt-1 w-48 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-50"
                    >
                      <button
                        onClick={() => { setIsMenuOpen(false); setIsBlockOpen(true); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-zinc-900 hover:bg-rose-50 text-left"
                      >
                        <Ban className="w-4 h-4 text-zinc-500" />
                        <span className="font-semibold text-sm">{conversation?.blocked_by_me ? 'Unblock user' : 'Block user'}</span>
                      </button>
                      <div className="h-px bg-zinc-100" />
                      <button
                        onClick={() => { setIsMenuOpen(false); setIsReportOpen(true); setReportDone(false); setReportReason(""); setReportDetails(""); setReportError(""); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-zinc-900 hover:bg-rose-50 text-left"
                      >
                        <Flag className="w-4 h-4 text-zinc-500" />
                        <span className="font-semibold text-sm">Report user</span>
                      </button>
                      <div className="h-px bg-zinc-100" />
                      <button
                        onClick={() => { setIsMenuOpen(false); setIsDeleteChatOpen(true); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-rose-600 hover:bg-rose-50 text-left"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="font-semibold text-sm">Delete chat</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      {/* Request banner */}
      {conversation?.is_request && (
        <div className="shrink-0 bg-rose-50 border-b border-rose-100 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-rose-700 font-medium flex-1">
            {other?.username ? `@${other.username}` : 'This user'} wants to chat with you.
          </p>
          <button
            onClick={handleAccept}
            disabled={isBusy}
            className="px-4 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-full"
          >
            Accept
          </button>
          <button
            onClick={() => setIsDeleteChatOpen(true)}
            disabled={isBusy}
            className="px-4 py-1.5 bg-white border border-zinc-200 text-zinc-700 text-xs font-bold rounded-full"
          >
            Delete
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 bg-zinc-50/50">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 text-rose-500 animate-spin" />
          </div>
        ) : loadError ? (
          <div className="text-center py-20">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
            <p className="text-zinc-700 font-medium mb-4">{loadError}</p>
            <button onClick={goBack} className="px-6 py-2.5 bg-rose-500 text-white rounded-full text-sm font-bold">
              Back to inbox
            </button>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => {
              const prev = messages[index - 1];
              const showDay = !prev || dayLabel(prev.created_at) !== dayLabel(msg.created_at);
              const isSelected = selected.has(msg.id);
              return (
                <React.Fragment key={msg.id}>
                  {showDay && (
                    <div className="flex justify-center my-4">
                      <span className="px-3 py-1 bg-zinc-100 text-zinc-500 text-[11px] font-semibold rounded-full">
                        {dayLabel(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div
                    className={`flex mb-1.5 ${msg.sender_is_me ? 'justify-end' : 'justify-start'}`}
                    onPointerDown={() => startLongPress(msg.id)}
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onClick={() => selectionMode && toggleSelect(msg.id)}
                  >
                    <div className={`max-w-[78%] ${isSelected ? 'ring-2 ring-rose-400 rounded-2xl' : ''}`}>
                      <div
                        className={`px-3.5 py-2 rounded-2xl ${
                          msg.sender_is_me
                            ? 'bg-rose-500 text-white rounded-br-md'
                            : 'bg-white border border-zinc-200 text-zinc-900 rounded-bl-md'
                        }`}
                      >
                        {/* Media */}
                        {msg.media_type && msg.is_once ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!selectionMode && msg.once_state === 'available') handleViewOnce(msg);
                            }}
                            className={`flex items-center gap-2 py-1 ${msg.once_state === 'available' ? '' : 'opacity-70'}`}
                          >
                            <span className={`p-1.5 rounded-full ${msg.sender_is_me ? 'bg-white/20' : 'bg-rose-50 text-rose-500'}`}>
                              <Eye className="w-4 h-4" />
                            </span>
                            <span className="text-sm font-semibold">
                              {msg.once_state === 'available'
                                ? `Tap to view ${msg.media_type === 'video' ? 'video' : 'photo'}`
                                : msg.once_state === 'opened'
                                  ? 'Opened'
                                  : `${msg.media_type === 'video' ? 'Video' : 'Photo'} · view once`}
                            </span>
                          </button>
                        ) : msg.media_type && msg.media_url ? (
                          msg.media_type === 'video' ? (
                            <SecureVideo
                              src={msg.media_url}
                              watermark={watermark}
                              className="rounded-xl max-w-full w-56 my-1 bg-black"
                              controls
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!selectionMode) setMediaView({ url: msg.media_url, kind: 'image', once: false });
                              }}
                              className="block"
                            >
                              <SecureImage
                                src={msg.media_url}
                                alt="attachment"
                                watermark={watermark}
                                className="rounded-xl max-w-full w-56 my-1 cursor-pointer"
                              />
                            </button>
                          )
                        ) : null}
                        {msg.body && <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>}
                      </div>
                      <div className={`flex items-center gap-1 mt-0.5 px-1 ${msg.sender_is_me ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[10px] text-zinc-400">{timeOf(msg.created_at)}</span>
                        {msg.sender_is_me && (
                          msg.seen_at
                            ? <span className="flex items-center gap-0.5 text-[10px] text-rose-500 font-semibold"><CheckCheck className="w-3 h-3" /> Seen</span>
                            : <span className="flex items-center gap-0.5 text-[10px] text-zinc-400"><Check className="w-3 h-3" /> Sent</span>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            {!messages.length && (
              <div className="text-center py-16 text-sm text-zinc-400">No messages yet. Say hi 👋</div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Blocked banner / composer */}
      {conversation?.blocked_by_me ? (
        <div className="shrink-0 border-t border-zinc-100 px-4 py-4 text-center">
          <p className="text-sm text-zinc-500 mb-2">You blocked this user.</p>
          <button onClick={handleBlockToggle} disabled={isBusy} className="px-5 py-2 bg-rose-500 text-white text-sm font-bold rounded-full">
            Unblock
          </button>
        </div>
      ) : conversation && !conversation.can_send ? (
        <div className="shrink-0 border-t border-zinc-100 px-4 py-4 text-center">
          <p className="text-sm text-zinc-500">You can't reply to this conversation.</p>
        </div>
      ) : (
        <div className="shrink-0 border-t border-zinc-100 bg-white px-3 pt-2 pb-3">
          {sendError && (
            <p className="text-rose-600 text-xs font-medium px-2 pb-1.5">{sendError}</p>
          )}

          {/* Attachment preview */}
          {attachment && (
            <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-2xl p-2.5 mb-2">
              {attachment.kind === 'video' ? (
                <video src={attachment.previewUrl} className="w-14 h-14 rounded-xl object-cover bg-black" muted />
              ) : (
                <img src={attachment.previewUrl} alt="preview" className="w-14 h-14 rounded-xl object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-900 truncate">{attachment.file.name}</p>
                <label className="flex items-center gap-1.5 mt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isOnceSend}
                    onChange={(e) => setIsOnceSend(e.target.checked)}
                    className="w-3.5 h-3.5 accent-rose-500"
                  />
                  <span className="text-xs text-zinc-600 flex items-center gap-1"><Eye className="w-3 h-3" /> View once</span>
                </label>
              </div>
              {uploadPct !== null ? (
                <span className="text-xs font-bold text-rose-500 shrink-0">{uploadPct}%</span>
              ) : (
                <button
                  onClick={() => { URL.revokeObjectURL(attachment.previewUrl); setAttachment(null); setIsOnceSend(false); }}
                  aria-label="Remove attachment"
                  className="p-1.5 text-zinc-400 hover:text-zinc-600 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Emoji picker */}
          <AnimatePresence>
            {isEmojiOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-2"
              >
                <div className="grid grid-cols-10 gap-1 bg-zinc-50 border border-zinc-200 rounded-2xl p-2">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setDraft((d) => d + emoji)}
                      className="text-xl p-1 hover:bg-white rounded-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handlePickFile}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach photo or video"
              className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-full shrink-0"
            >
              {attachment ? <ImagePlus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setIsEmojiOpen((o) => !o)}
              aria-label="Emoji"
              className={`p-2.5 rounded-full shrink-0 ${isEmojiOpen ? 'text-rose-500 bg-rose-50' : 'text-zinc-500 hover:bg-zinc-100'}`}
            >
              <Smile className="w-5 h-5" />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type a message"
              className="flex-1 px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-full text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-400 min-w-0"
            />
            <button
              onClick={handleSend}
              disabled={isSending || (!draft.trim() && !attachment)}
              aria-label="Send"
              className="p-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white rounded-full shrink-0 shadow-md shadow-rose-500/20"
            >
              {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen media viewer (no download / context menu) */}
      <AnimatePresence>
        {mediaView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] bg-black flex items-center justify-center"
            onContextMenu={blockMedia}
          >
            <button
              onClick={() => setMediaView(null)}
              aria-label="Close"
              className="absolute top-4 left-4 p-2 text-white bg-white/10 hover:bg-white/20 rounded-full z-10"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            {mediaView.once && (
              <span className="absolute top-6 right-4 px-3 py-1 bg-white/15 text-white text-xs font-bold rounded-full flex items-center gap-1.5 z-10">
                <Eye className="w-3.5 h-3.5" /> View once
              </span>
            )}
            {mediaView.kind === 'video' ? (
              <SecureVideo
                src={mediaView.url}
                watermark={watermark}
                className="max-w-full max-h-full"
                autoPlay
                controls
              />
            ) : (
              <SecureImage
                src={mediaView.url}
                alt="media"
                watermark={watermark}
                className="max-w-full max-h-full object-contain"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <CaptureShield watermark={watermark} active={obscured} />

      {/* Delete selected messages modal */}
      <AnimatePresence>
        {isDeleteMsgOpen && (
          <Modal onClose={() => !isBusy && setIsDeleteMsgOpen(false)}>
            <h3 className="text-lg font-bold text-zinc-900 mb-1.5">Delete {selected.size > 1 ? `${selected.size} messages` : 'message'}?</h3>
            <p className="text-sm text-zinc-500 mb-5">
              {allSelectedMine
                ? 'You can delete for yourself or for everyone in this chat.'
                : 'Messages from the other user can only be deleted for you.'}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleDeleteSelected('me')}
                disabled={isBusy}
                className="w-full py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold rounded-xl text-sm"
              >
                Delete for me
              </button>
              {allSelectedMine && (
                <button
                  onClick={() => handleDeleteSelected('both')}
                  disabled={isBusy}
                  className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl text-sm"
                >
                  Delete for everyone
                </button>
              )}
              <button
                onClick={() => setIsDeleteMsgOpen(false)}
                disabled={isBusy}
                className="w-full py-3 text-zinc-500 font-semibold rounded-xl text-sm"
              >
                Cancel
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Delete chat modal */}
      <AnimatePresence>
        {isDeleteChatOpen && (
          <Modal onClose={() => !isBusy && setIsDeleteChatOpen(false)}>
            <h3 className="text-lg font-bold text-zinc-900 mb-1.5">Delete this chat?</h3>
            <p className="text-sm text-zinc-500 mb-5">
              "Delete for me" clears the chat only on your side. "Delete for both" permanently removes all messages and media for both of you.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleDeleteChat('me')}
                disabled={isBusy}
                className="w-full py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold rounded-xl text-sm"
              >
                Delete for me
              </button>
              <button
                onClick={() => handleDeleteChat('both')}
                disabled={isBusy}
                className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl text-sm"
              >
                Delete for both
              </button>
              <button
                onClick={() => setIsDeleteChatOpen(false)}
                disabled={isBusy}
                className="w-full py-3 text-zinc-500 font-semibold rounded-xl text-sm"
              >
                Cancel
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Block modal */}
      <AnimatePresence>
        {isBlockOpen && (
          <Modal onClose={() => !isBusy && setIsBlockOpen(false)}>
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4 text-rose-500">
              <Ban className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-1.5">
              {conversation?.blocked_by_me ? `Unblock @${other?.username}?` : `Block @${other?.username}?`}
            </h3>
            <p className="text-sm text-zinc-500 mb-5">
              {conversation?.blocked_by_me
                ? 'They will be able to message you again.'
                : "They won't be able to message you, and you won't be able to message them."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsBlockOpen(false)}
                disabled={isBusy}
                className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockToggle}
                disabled={isBusy}
                className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2"
              >
                {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {conversation?.blocked_by_me ? 'Unblock' : 'Block'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Report modal */}
      <AnimatePresence>
        {isReportOpen && (
          <Modal onClose={() => !isBusy && setIsReportOpen(false)}>
            {reportDone ? (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
                  <Flag className="w-6 h-6 text-rose-500" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 mb-1.5">Report submitted</h3>
                <p className="text-sm text-zinc-500 mb-5">Thank you. Our team will review this user.</p>
                <button
                  onClick={() => setIsReportOpen(false)}
                  className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl text-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-zinc-900 mb-4">Report @{other?.username}</h3>
                <label className="block text-xs font-semibold text-zinc-900 mb-1.5">Select a reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 mb-3 focus:outline-none focus:ring-2 focus:ring-rose-500/40 appearance-none"
                >
                  <option value="" disabled>Choose a reason…</option>
                  {REPORT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <label className="block text-xs font-semibold text-zinc-900 mb-1.5">Additional details</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value.slice(0, 750))}
                  rows={3}
                  placeholder="Tell us more (optional)…"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                />
                <p className="text-right text-[11px] text-zinc-400 mt-1 mb-3">{reportDetails.length}/750</p>
                {reportError && (
                  <p className="text-rose-600 text-xs font-medium mb-3">{reportError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsReportOpen(false)}
                    disabled={isBusy}
                    className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold rounded-xl text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReport}
                    disabled={isBusy}
                    className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2"
                  >
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                    Submit report
                  </button>
                </div>
              </>
            )}
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-xl p-6"
      >
        {children}
      </motion.div>
    </div>
  );
}
