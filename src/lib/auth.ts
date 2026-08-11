export const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL;
if (!AUTH_API_URL) throw new Error('Missing VITE_AUTH_API_URL');

const defaultHeaders = {
  'Content-Type': 'application/json',
};

export async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${AUTH_API_URL}${path}`, {
    method: 'POST',
    headers: defaultHeaders,
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function apiGet(path: string) {
  const res = await fetch(`${AUTH_API_URL}${path}`, {
    method: 'GET',
    credentials: 'include',
  });
  return res.json();
}

export async function login(email: string, password: string) {
  return apiPost('/login', { email, password });
}

export async function userLogin(email: string, password: string) {
  return apiPost('/user-login', { email, password });
}

export async function userSignup(email: string, name: string, password: string, redirectSlug: string) {
  return apiPost('/user-signup', {
    email,
    name,
    password,
    redirect_slug: redirectSlug,
  });
}

export async function userVerify(email: string, token: string) {
  return apiPost('/user-verify', { email, token });
}

export async function userResend(email: string) {
  return apiPost('/user-resend', { email });
}

export async function userForgot(email: string, redirectSlug: string) {
  return apiPost('/user-forgot', { email, redirect_slug: redirectSlug });
}

export async function userReset(email: string, token: string, password: string) {
  return apiPost('/user-reset', { email, token, password });
}

export async function logout() {
  return apiPost('/logout', {});
}

export async function signup(email: string, password: string, username: string) {
  return apiPost('/signup', { email, password, username });
}

export const USERNAME_REGEX = /^[A-Za-z0-9._-]{6,25}$/;

export async function checkUsername(username: string): Promise<{
  available?: boolean;
  reason?: 'invalid' | 'taken';
  error?: string;
}> {
  return apiGet(`/username-check?u=${encodeURIComponent(username)}`);
}

export async function verifyOtp(email: string, token: string) {
  return apiPost('/verify', { email, token });
}

export async function resendOtp(email: string) {
  return apiPost('/resend', { email });
}

export async function forgotPassword(email: string) {
  return apiPost('/forgot', { email });
}

export async function resetPassword(email: string, token: string, password: string) {
  return apiPost('/reset', { email, token, password });
}

export async function getSession() {
  return apiGet('/session');
}

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string;
  instagram_url: string;
  facebook_url: string;
  gender: 'Prefer not to say' | 'Male' | 'Female' | 'Transgender';
  public_serial: number;
  is_verified?: boolean;
  verification_public_id?: string | null;
  verification_status?: 'unverified' | 'pending' | 'verified' | 'suspended' | 'rejected';
}

/** Public creator page slug for a profile: <username><5-digit serial>. */
export function publicProfileSlug(profile: Pick<Profile, 'username' | 'public_serial'>): string {
  return `${profile.username}${String(profile.public_serial).padStart(5, '0')}`;
}

export interface ProfileStats {
  posts: number;
  followers: number;
  following: number;
}

export interface CreatorPost {
  id: string;
  public_id: string;
  caption: string;
  media_type: 'image' | 'video';
  media_url: string;
  media_urls: string[];
  media_count: number;
  is_paid: boolean;
  price: number;
  like_count: number;
  view_count: number;
  created_at: string;
}

export interface PayoutAccount {
  account_holder: string;
  account_number_last4: string;
  account_number_masked: string;
  ifsc: string;
  upi_id: string;
  updated_at: string | null;
  has_account: boolean;
}

export async function getPayoutAccount(): Promise<{ account?: PayoutAccount | null; error?: string }> {
  return apiGet('/payout-account');
}

export type CreatorVerificationStatus = {
  status: 'unverified' | 'pending' | 'verified' | 'suspended' | 'rejected';
  badge_active: boolean;
  public_id: string | null;
  legal_full_name?: string | null;
  date_of_birth?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  admin_note?: string | null;
  auto_reverify_count?: number;
  auto_reverifies_remaining?: number;
  needs_admin_approval?: boolean;
  content_locked?: boolean;
};

export async function getCreatorVerification(): Promise<{
  verification?: CreatorVerificationStatus;
  error?: string;
}> {
  return apiGet('/creator-verification');
}

export async function requestVerificationUploadUrls(
  files: { side: 'front' | 'back'; content_type: string; size: number }[],
): Promise<{
  uploads?: { side: 'front' | 'back'; path: string; upload_url: string; content_type: string }[];
  error?: string;
}> {
  return apiPost('/creator-verification/upload-urls', { files });
}

export async function submitCreatorVerification(data: {
  legal_full_name: string;
  date_of_birth: string;
  id_front_path: string;
  id_back_path: string;
  terms_accepted: boolean;
}): Promise<{ verification?: CreatorVerificationStatus; error?: string }> {
  return apiPost('/creator-verification/submit', data);
}

export async function savePayoutAccount(data: {
  account_holder: string;
  account_number: string;
  ifsc: string;
  upi_id: string;
}): Promise<{ account?: PayoutAccount; error?: string }> {
  return apiPost('/payout-account', data);
}

export interface WalletSale {
  id: string;
  amount: number;
  amount_paise: number;
  paid_at: string;
  post_public_id: string;
  caption: string;
}

export interface WalletWithdrawal {
  id: string;
  amount: number;
  amount_paise: number;
  platform_fee?: number;
  platform_fee_paise?: number;
  net_payout?: number;
  net_payout_paise?: number;
  fee_bps?: number;
  fee_percent?: number;
  status: 'pending' | 'paid' | 'rejected' | 'accepted';
  account_holder: string;
  account_number_last4: string;
  ifsc: string;
  created_at: string;
  processed_at: string | null;
}

export interface WalletWithdrawPreview {
  gross: number;
  platform_fee: number;
  net_payout: number;
  fee_bps: number;
  fee_percent: number;
}

export interface WalletSummary {
  available_balance: number;
  lifetime_earnings: number;
  held_balance?: number;
  sales_count: number;
  min_withdraw: number;
  withdraw_hold_hours?: number;
  platform_fee_bps?: number;
  platform_fee_percent?: number;
  withdraw_preview?: WalletWithdrawPreview;
  sales?: WalletSale[];
  withdrawals?: WalletWithdrawal[];
  account?: PayoutAccount | null;
  error?: string;
}

export async function getWallet(): Promise<WalletSummary> {
  return apiGet('/wallet');
}

export async function requestWithdraw(amount: number): Promise<{ status?: string; withdrawal?: WalletWithdrawal; error?: string }> {
  return apiPost('/wallet-withdraw', { amount });
}

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  admin_reply: string;
  created_at: string;
}

export async function getSupportTickets(): Promise<{ tickets?: SupportTicket[]; error?: string }> {
  return apiGet('/support-tickets');
}

export async function createSupportTicket(
  subject: string,
  message: string,
): Promise<{ ticket?: SupportTicket; error?: string }> {
  return apiPost('/support-tickets', { subject, message });
}

export interface PostUpload {
  path: string;
  upload_url: string;
  content_type: string;
}

export async function createPostUploadUrls(
  mediaType: 'image' | 'video',
  files: { content_type: string; size: number }[],
): Promise<{ post_public_id?: string; uploads?: PostUpload[]; error?: string }> {
  return apiPost('/post-upload-urls', { media_type: mediaType, files });
}

export async function createPost(data: {
  public_id: string;
  caption: string;
  media_type: 'image' | 'video';
  media_paths: string[];
  is_paid: boolean;
  price: number;
}): Promise<{ status?: string; post?: CreatorPost; error?: string }> {
  return apiPost('/posts', data);
}

export function uploadFileWithProgress(
  uploadUrl: string,
  file: Blob,
  contentType: string,
  onProgress?: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(file.size);
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(file);
  });
}

export const REPORT_REASONS = [
  'Nudity or sexual content',
  'Harassment or bullying',
  'Spam or scam',
  'Violence or dangerous content',
  'Hate speech',
  'Intellectual property violation',
  'Impersonation',
  'Other',
] as const;

export interface PostDetail {
  public_id: string;
  caption: string;
  media_type: 'image' | 'video';
  media_urls: string[];
  media_count: number;
  is_paid: boolean;
  price: number;
  created_at: string;
  is_owner: boolean;
  has_access: boolean;
  like_count: number;
  view_count: number;
  liked_by_me: boolean;
  owner: { username: string; full_name: string | null; avatar_url: string | null } | null;
}

export async function getPost(publicId: string): Promise<{ post?: PostDetail; error?: string }> {
  return apiGet(`/post?id=${encodeURIComponent(publicId)}`);
}

export async function togglePostLike(
  publicId: string,
): Promise<{ liked?: boolean; like_count?: number; error?: string }> {
  return apiPost('/post-like', { public_id: publicId });
}

export async function updatePost(data: {
  public_id: string;
  caption: string;
  is_paid: boolean;
  price: number;
}): Promise<{ status?: string; post?: CreatorPost; error?: string }> {
  return apiPost('/post-update', data);
}

export async function deletePost(publicId: string): Promise<{ status?: string; error?: string }> {
  return apiPost('/post-delete', { public_id: publicId });
}

export async function reportPost(
  publicId: string,
  reason: string,
  details: string,
): Promise<{ status?: string; error?: string }> {
  return apiPost('/post-report', { public_id: publicId, reason, details });
}

export interface PostCheckout {
  key_id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  post_public_id?: string;
  already_unlocked?: boolean;
  error?: string;
  // Server-issued breakdown (added with platform-fee migration 027).
  content_name?: string;
  content_type?: 'paid' | 'exclusive' | 'live_stream_booking' | 'live_stream_gift';
  content_amount_paise?: number;
  platform_fee_percent?: number;
  platform_fee_paise?: number;
  final_amount_paise?: number;
}

export async function checkoutPost(publicId: string): Promise<PostCheckout> {
  return apiPost('/post-checkout', { public_id: publicId });
}

export async function verifyPostPayment(data: {
  public_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ status?: string; error?: string }> {
  return apiPost('/post-verify-payment', data);
}

export async function getPostPaymentStatus(
  publicId: string,
  orderId = '',
): Promise<{ status?: 'paid' | 'processing' | 'unpaid'; has_access?: boolean; error?: string }> {
  const query = new URLSearchParams({ public_id: publicId });
  if (orderId) query.set('order_id', orderId);
  return apiGet(`/post-payment-status?${query.toString()}`);
}

/* ── Payment dialog breakdown (server-issued, never trusted from frontend) ── */

export interface PaymentBreakdown {
  key_id?: string;
  order_id?: string;
  amount?: number;                  // final amount (paise) Razorpay charges
  currency?: string;
  post_public_id?: string;
  content_name?: string;
  content_type?: 'paid' | 'exclusive' | 'live_stream_booking' | 'live_stream_gift';
  content_amount_paise?: number;    // creator's price
  platform_fee_percent?: number;    // always 3
  platform_fee_paise?: number;      // 3% of content amount
  final_amount_paise?: number;      // content + 3% — what the user pays
  already_unlocked?: boolean;
  already_booked?: boolean;
  error?: string;
}

/* ── Live Streams ─────────────────────────────────────────────────────────── */

export interface LiveStream {
  id: string;
  public_id: string;
  creator_id: string;
  creator_username: string;
  creator_avatar_url: string | null;
  creator_full_name: string | null;
  title: string;
  scheduled_start: string;
  duration_minutes: 15 | 30 | 45 | 60;
  is_paid: boolean;
  entry_fee_paise: number;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  join_token: string;
  started_at: string | null;
  ended_at: string | null;
  active_viewers: number;
  peak_viewers: number;
  total_earnings_paise: number;
  comments_enabled: boolean;
  created_at: string;
  has_booked: boolean;
}

export interface LiveStreamGift {
  id: string;
  code: string;
  name: string;
  emoji: string;
  amount_paise: number;
  sort_order: number;
}

export interface LiveStreamChatMessage {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  body: string;
  created_at: string;
}

export interface LiveStreamStats {
  active_viewers: number;
  peak_viewers: number;
  total_earnings_paise: number;
  gifts_gross_paise: number;
  gifts_final_paise: number;
  gifts_net_to_creator_paise: number;
  bookings_count: number;
  bookings_final_paise: number;
  bookings_net_to_creator_paise: number;
  comments_enabled: boolean;
  status: string;
}

export async function createLiveStream(data: {
  title: string;
  scheduled_start: string;       // ISO datetime
  duration_minutes: 15 | 30 | 45 | 60;
  is_paid: boolean;
  entry_fee?: number;            // rupees, only when is_paid
}): Promise<{ stream?: LiveStream; error?: string }> {
  return apiPost('/live-streams', data);
}

export async function listMyLiveStreams(): Promise<{ streams?: LiveStream[]; error?: string }> {
  return apiGet('/live-streams/mine');
}

export async function getLiveStream(publicId: string): Promise<{ stream?: LiveStream; error?: string }> {
  return apiGet(`/live-stream?id=${encodeURIComponent(publicId)}`);
}

export async function startLiveStream(publicId: string): Promise<{ stream?: LiveStream; error?: string }> {
  return apiPost('/live-stream/start', { public_id: publicId });
}

export async function endLiveStream(publicId: string): Promise<{ stream?: LiveStream; error?: string }> {
  return apiPost('/live-stream/end', { public_id: publicId });
}

export async function updateLiveStreamSettings(publicId: string, settings: { comments_enabled?: boolean }): Promise<{ stream?: LiveStream; error?: string }> {
  return apiPost('/live-stream/settings', { public_id: publicId, ...settings });
}

export async function checkoutLiveStreamBooking(publicId: string): Promise<PaymentBreakdown> {
  return apiPost('/live-stream/book-checkout', { public_id: publicId });
}

export async function verifyLiveStreamBooking(data: {
  public_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ status?: string; error?: string }> {
  return apiPost('/live-stream/book-verify', data);
}

export async function getLiveStreamBookingStatus(publicId: string, orderId = ''): Promise<{ status?: 'paid' | 'processing' | 'unpaid'; has_access?: boolean; error?: string }> {
  const q = new URLSearchParams({ id: publicId });
  if (orderId) q.set('order_id', orderId);
  return apiGet(`/live-stream/book-status?${q.toString()}`);
}

export async function getLiveStreamGiftCatalog(): Promise<{ gifts?: LiveStreamGift[]; error?: string }> {
  return apiGet('/live-stream/gift-catalog');
}

export async function checkoutLiveStreamGift(publicId: string, giftCode: string): Promise<PaymentBreakdown> {
  return apiPost('/live-stream/gift-checkout', { public_id: publicId, gift_code: giftCode });
}

export async function verifyLiveStreamGift(data: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ status?: string; gift?: { code: string; name: string; amount_paise: number }; error?: string }> {
  return apiPost('/live-stream/gift-verify', data);
}

export async function heartbeatLiveStream(publicId: string): Promise<{ active_viewers?: number; peak_viewers?: number; status?: string; error?: string }> {
  return apiPost('/live-stream/heartbeat', { public_id: publicId });
}

export async function getLiveStreamChat(publicId: string): Promise<{ messages?: LiveStreamChatMessage[]; comments_enabled?: boolean; error?: string }> {
  return apiGet(`/live-stream/chat?id=${encodeURIComponent(publicId)}`);
}

export async function sendLiveStreamChat(publicId: string, body: string): Promise<{ message?: LiveStreamChatMessage; error?: string }> {
  return apiPost('/live-stream/chat', { public_id: publicId, body });
}

export async function getLiveStreamStats(publicId: string): Promise<{ stats?: LiveStreamStats; error?: string }> {
  return apiGet(`/live-stream/stats?id=${encodeURIComponent(publicId)}`);
}

export interface ConversationItem {
  id: string;
  status: 'pending' | 'accepted';
  is_request: boolean;
  other: { username: string; full_name: string; avatar_url: string };
  last_message: { preview: string; created_at: string };
  unread: number;
  last_message_at: string;
}

export interface ChatMessage {
  id: string;
  sender_is_me: boolean;
  body: string;
  media_type: '' | 'image' | 'video';
  media_url: string;
  is_once: boolean;
  once_state: 'none' | 'available' | 'opened' | 'sent';
  seen_at: string | null;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  status: 'pending' | 'accepted';
  is_request: boolean;
  blocked_by_me: boolean;
  can_send: boolean;
  other: { username: string; full_name: string | null; avatar_url: string | null };
}

export async function getConversations(): Promise<{ conversations?: ConversationItem[]; error?: string }> {
  return apiGet('/conversations');
}

export interface PublicProfilePost {
  public_id: string;
  media_type: 'image' | 'video';
  is_paid: boolean;
  price: number;
  media_url: string;
  media_count: number;
  like_count: number;
  view_count: number;
}

export interface PublicProfileData {
  profile: {
    username: string;
    full_name: string;
    avatar_url: string;
    bio: string;
    serial: string;
    is_verified?: boolean;
  };
  stats: { posts: number; followers: number };
  viewer: {
    authenticated: boolean;
    role: 'creator' | 'user' | '';
    is_following: boolean;
  };
  posts: PublicProfilePost[];
  rooms?: ExclusiveRoom[];
  content_locked?: boolean;
}

/** Guest endpoint: no auth required. Slug is <username><5-digit serial>. */
export async function getPublicProfile(slug: string): Promise<Partial<PublicProfileData> & { error?: string }> {
  return apiGet(`/public-profile?slug=${encodeURIComponent(slug)}`);
}

export async function togglePublicFollow(slug: string): Promise<{ following?: boolean; error?: string }> {
  return apiPost('/public-follow', { slug });
}

export interface NotificationItem {
  id: string;
  type: 'like' | 'purchase' | 'request' | 'accept' | 'follow';
  read: boolean;
  created_at: string;
  actor: { username: string; full_name: string | null; avatar_url: string | null };
  post_public_id: string | null;
  post_caption: string | null;
  conversation_id: string | null;
}

export async function getNotifications(): Promise<{
  notifications?: NotificationItem[];
  unread_count?: number;
  error?: string;
}> {
  return apiGet('/notifications');
}

export async function markNotificationsRead(): Promise<{ status?: string; error?: string }> {
  return apiPost('/notifications-read', {});
}

export async function searchUsers(q: string): Promise<{ users?: { username: string; full_name: string; avatar_url: string }[]; error?: string }> {
  return apiGet(`/user-search?q=${encodeURIComponent(q)}`);
}

export async function startConversation(username: string): Promise<{ conversation_id?: string; existing?: boolean; error?: string }> {
  return apiPost('/conversations', { username });
}

export async function acceptConversation(conversationId: string): Promise<{ status?: string; error?: string }> {
  return apiPost('/conversation-accept', { conversation_id: conversationId });
}

export async function getMessages(conversationId: string): Promise<{
  conversation?: ChatConversation;
  messages?: ChatMessage[];
  error?: string;
}> {
  return apiGet(`/messages?conversation_id=${encodeURIComponent(conversationId)}`);
}

export async function sendMessage(data: {
  conversation_id: string;
  body: string;
  media_path?: string;
  media_type?: 'image' | 'video' | '';
  is_once?: boolean;
}): Promise<{ status?: string; message?: ChatMessage; error?: string }> {
  return apiPost('/messages', data);
}

export async function getChatUploadUrl(
  conversationId: string,
  contentType: string,
  size: number,
): Promise<{ path?: string; upload_url?: string; media_type?: 'image' | 'video'; error?: string }> {
  return apiPost('/chat-upload-url', { conversation_id: conversationId, content_type: contentType, size });
}

export async function viewOnceMessage(messageId: string): Promise<{ media_url?: string; media_type?: string; error?: string }> {
  return apiPost('/message-view-once', { message_id: messageId });
}

export async function deleteMessages(
  conversationId: string,
  messageIds: string[],
  mode: 'me' | 'both',
): Promise<{ status?: string; error?: string }> {
  return apiPost('/message-delete', { conversation_id: conversationId, message_ids: messageIds, mode });
}

export async function deleteChat(conversationId: string, mode: 'me' | 'both'): Promise<{ status?: string; error?: string }> {
  return apiPost('/chat-delete', { conversation_id: conversationId, mode });
}

export async function blockChatUser(conversationId: string, block: boolean): Promise<{ status?: string; error?: string }> {
  return apiPost('/chat-block', { conversation_id: conversationId, block });
}

export async function reportChatUser(
  conversationId: string,
  reason: string,
  details: string,
): Promise<{ status?: string; error?: string }> {
  return apiPost('/chat-report', { conversation_id: conversationId, reason, details });
}

export async function getProfile(): Promise<{
  profile?: Profile;
  stats?: ProfileStats;
  posts?: CreatorPost[];
  rooms?: ExclusiveRoom[];
  error?: string;
}> {
  return apiGet('/profile');
}

// Note: username is intentionally not accepted — it is permanent after signup
export async function updateProfile(data: {
  full_name?: string;
  bio?: string;
  location?: string;
  instagram_url?: string;
  facebook_url?: string;
  gender?: Profile['gender'];
  avatar_url?: string;
  avatar_base64?: string;
  avatar_content_type?: string;
}) {
  return apiPost('/profile', data);
}

/* ── Exclusive Rooms ─────────────────────────────────────────── */

export interface ExclusiveRoom {
  id: string;
  name: string;
  thumbnail_url: string;
  entry_fee: number;
  entry_fee_paise: number;
  sort_order: number;
  has_access?: boolean;
  expires_at?: string | null;
  creator_slug?: string;
  creator_id?: string;
}

export interface ExclusiveRoomPost {
  id: string;
  public_id: string;
  room_id: string;
  room_name?: string;
  caption: string;
  media_type: 'image' | 'video';
  media_url: string;
  media_urls?: string[];
  media_count: number;
  created_at: string;
}

export async function getExclusiveRooms(): Promise<{ rooms?: ExclusiveRoom[]; error?: string }> {
  return apiGet('/exclusive-rooms');
}

export async function createExclusiveRoom(data: {
  name: string;
  entry_fee: number;
}): Promise<{ room?: ExclusiveRoom; error?: string }> {
  return apiPost('/exclusive-rooms', data);
}

export async function updateExclusiveRoom(data: {
  room_id: string;
  name?: string;
  entry_fee?: number;
}): Promise<{ room?: ExclusiveRoom; error?: string }> {
  return apiPost('/exclusive-rooms/update', data);
}

export async function uploadExclusiveThumbnail(
  roomId: string,
  file: File,
): Promise<{ room?: ExclusiveRoom; error?: string }> {
  const urls = await apiPost('/exclusive-rooms/thumbnail-upload', {
    room_id: roomId,
    content_type: file.type || 'image/jpeg',
    size: file.size,
  }) as { upload_url?: string; path?: string; error?: string };
  if (urls.error || !urls.upload_url || !urls.path) {
    return { error: urls.error || 'Failed to prepare thumbnail upload' };
  }
  await uploadFileWithProgress(urls.upload_url, file, file.type || 'image/jpeg');
  return apiPost('/exclusive-rooms/thumbnail-confirm', {
    room_id: roomId,
    path: urls.path,
  });
}

export async function getExclusiveRoom(roomId: string): Promise<{
  room?: ExclusiveRoom;
  posts?: ExclusiveRoomPost[];
  has_access?: boolean;
  is_owner?: boolean;
  error?: string;
}> {
  return apiGet(`/exclusive-room?id=${encodeURIComponent(roomId)}`);
}

export async function createExclusiveRoomUploadUrls(
  roomId: string,
  mediaType: 'image' | 'video',
  files: Array<{ content_type: string; size: number }>,
): Promise<{
  post_public_id?: string;
  uploads?: Array<{ path: string; upload_url: string }>;
  error?: string;
}> {
  return apiPost('/exclusive-room-upload-urls', {
    room_id: roomId,
    media_type: mediaType,
    files,
  });
}

export async function createExclusiveRoomPost(data: {
  room_id: string;
  public_id: string;
  caption: string;
  media_type: 'image' | 'video';
  media_paths: string[];
}): Promise<{ post?: ExclusiveRoomPost; error?: string }> {
  return apiPost('/exclusive-room-posts', data);
}

export async function deleteExclusiveRoomPost(publicId: string): Promise<{ status?: string; error?: string }> {
  return apiPost('/exclusive-room-posts/delete', { public_id: publicId });
}

export async function deleteExclusiveRoom(roomId: string): Promise<{ status?: string; error?: string }> {
  return apiPost('/exclusive-rooms/delete', { room_id: roomId });
}

export async function getExclusiveRoomPaymentStatus(
  roomId: string,
  orderId?: string,
): Promise<{ status?: string; has_access?: boolean; expires_at?: string; error?: string }> {
  const q = new URLSearchParams({ room_id: roomId });
  if (orderId) q.set('order_id', orderId);
  return apiGet(`/exclusive-room-payment-status?${q.toString()}`);
}

export async function getExclusiveRoomPost(publicId: string): Promise<{
  post?: ExclusiveRoomPost;
  error?: string;
}> {
  return apiGet(`/exclusive-room-post?id=${encodeURIComponent(publicId)}`);
}

export async function checkoutExclusiveRoom(roomId: string): Promise<{
  already_unlocked?: boolean;
  order_id?: string;
  key_id?: string;
  amount?: number;
  currency?: string;
  error?: string;
}> {
  return apiPost('/exclusive-room-checkout', { room_id: roomId });
}

export async function verifyExclusiveRoomPayment(data: {
  room_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ status?: string; expires_at?: string; error?: string }> {
  return apiPost('/exclusive-room-verify-payment', data);
}