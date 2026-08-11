import { apiGet, apiPost } from "./auth";

export type AdminTab =
  | "overview"
  | "users"
  | "posts"
  | "payments"
  | "settlements"
  | "help"
  | "reports"
  | "withdrawals"
  | "verification";

export interface AdminStats {
  users: number;
  creators: number;
  posts: number;
  open_tickets: number;
  post_reports: number;
  user_reports: number;
  pending_withdrawals: number;
}

export interface AdminUserRow {
  id: string;
  role: string;
  name: string;
  email: string;
  username: string;
  avatar_url?: string;
  created_at: string;
}

export interface AdminUserDetail {
  id: string;
  role: string;
  name: string;
  email: string;
  username: string;
  avatar_url: string;
  bio: string;
  post_count: number;
  followers_count: number;
  joined_at: string;
  total_earnings: number;
}

export interface AdminPostRow {
  id: string;
  public_id: string;
  caption: string;
  media_type: string;
  is_paid: boolean;
  price: number;
  creator_id: string;
  creator_username: string;
  like_count: number;
  view_count: number;
  created_at: string;
}

export interface AdminPostView {
  public_id: string;
  caption: string;
  media_type: string;
  media_urls: string[];
  is_paid: boolean;
  price: number;
  like_count: number;
  view_count: number;
  created_at: string;
  creator: { id: string; username: string; full_name: string; avatar_url: string };
}

export interface AdminTicketRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  admin_reply: string;
  created_at: string;
  updated_at: string;
}

export interface AdminPostReportRow {
  id: string;
  post_public_id: string;
  owner_username: string;
  reporter_username: string;
  reason: string;
  details: string;
  created_at: string;
}

export interface AdminUserReportRow {
  id: string;
  reporter_username: string;
  reported_username: string;
  reason: string;
  details: string;
  created_at: string;
}

export interface AdminWithdrawalRow {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_email: string;
  creator_username: string;
  creator_avatar_url: string;
  amount_paise: number;
  amount: number;
  platform_fee?: number;
  platform_fee_paise?: number;
  net_payout?: number;
  net_payout_paise?: number;
  fee_bps?: number;
  fee_percent?: number;
  status: string;
  account_holder: string;
  account_number_last4: string;
  ifsc: string;
  upi_id: string;
  note: string;
  transfer_txn_id?: string;
  transfer_amount?: number | null;
  transfer_slip_url?: string;
  accepted_at?: string | null;
  created_at: string;
  processed_at: string | null;
  bank?: {
    account_holder: string;
    account_number_masked: string;
    account_number_last4: string;
    ifsc: string;
    upi_id: string;
  };
}

export interface AdminPaymentRow {
  id: string;
  amount: number;
  paid_at: string;
  withdrawable: boolean;
  unlocks_at: string | null;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  post_public_id: string;
  post_caption: string;
  buyer_name: string;
  creator_username: string;
  creator_id: string;
}

export interface AdminSettlementRow {
  creator_id: string;
  name: string;
  email: string;
  username: string;
  avatar_url: string;
  total_earnings: number;
  total_settled: number;
  balance_to_settle: number;
}

export async function adminLogin(email: string, password: string) {
  return apiPost("/admin-login", { email, password });
}

export async function getAdminStats(): Promise<{ stats?: AdminStats; error?: string }> {
  return apiGet("/admin/stats");
}

export async function getAdminUsers(): Promise<{ users?: AdminUserRow[]; error?: string }> {
  return apiGet("/admin/users");
}

export async function getAdminUserDetail(id: string): Promise<{ user?: AdminUserDetail; error?: string }> {
  return apiGet(`/admin/user?id=${encodeURIComponent(id)}`);
}

export async function getAdminPosts(): Promise<{ posts?: AdminPostRow[]; error?: string }> {
  return apiGet("/admin/posts");
}

export async function getAdminPostView(publicId: string): Promise<{ post?: AdminPostView; error?: string }> {
  return apiGet(`/admin/post?public_id=${encodeURIComponent(publicId)}`);
}

export async function adminDeletePost(publicId: string) {
  return apiPost("/admin/posts/delete", { public_id: publicId });
}

export async function getAdminTickets(): Promise<{ tickets?: AdminTicketRow[]; error?: string }> {
  return apiGet("/admin/support-tickets");
}

export async function adminUpdateTicket(
  id: string,
  status: AdminTicketRow["status"],
  adminReply: string,
) {
  return apiPost("/admin/support-tickets/update", { id, status, admin_reply: adminReply });
}

export async function getAdminPostReports(): Promise<{ reports?: AdminPostReportRow[]; error?: string }> {
  return apiGet("/admin/reports/posts");
}

export async function getAdminUserReports(): Promise<{ reports?: AdminUserReportRow[]; error?: string }> {
  return apiGet("/admin/reports/users");
}

export async function getAdminWithdrawals(): Promise<{ withdrawals?: AdminWithdrawalRow[]; error?: string }> {
  return apiGet("/admin/withdrawals");
}

export async function adminProcessWithdrawal(
  withdrawalId: string,
  status: "paid" | "rejected" | "accepted",
  note = "",
) {
  return apiPost("/admin-wallet-withdraw", { withdrawal_id: withdrawalId, status, note });
}

export async function adminCompleteWithdrawal(payload: {
  withdrawal_id: string;
  transfer_txn_id: string;
  transfer_amount: number;
  note?: string;
  slip_base64?: string;
  slip_content_type?: string;
}) {
  return apiPost("/admin/withdrawals/complete", payload);
}

export async function getAdminPayments(): Promise<{ payments?: AdminPaymentRow[]; error?: string }> {
  return apiGet("/admin/payments");
}

export async function getAdminSettlements(): Promise<{ settlements?: AdminSettlementRow[]; error?: string }> {
  return apiGet("/admin/settlements");
}

export interface AdminVerificationRow {
  id: string;
  user_id: string;
  public_id: string;
  legal_full_name: string;
  date_of_birth: string;
  status: "pending" | "verified" | "suspended" | "rejected";
  badge_active: boolean;
  username: string;
  email: string;
  avatar_url: string;
  submitted_at: string;
  reviewed_at: string | null;
  admin_note: string;
  auto_reverify_count?: number;
  auto_reverifies_remaining?: number;
  needs_admin_approval?: boolean;
  id_front_url?: string;
  id_back_url?: string;
}

export async function getAdminVerifications(): Promise<{
  verifications?: AdminVerificationRow[];
  error?: string;
}> {
  return apiGet("/admin/verifications");
}

export async function getAdminVerificationDetail(id: string): Promise<{
  verification?: AdminVerificationRow;
  error?: string;
}> {
  return apiGet(`/admin/verification?id=${encodeURIComponent(id)}`);
}

export async function adminUpdateVerification(
  id: string,
  action: "approve" | "suspend" | "restore" | "reject",
  note = "",
): Promise<{ verification?: AdminVerificationRow; error?: string }> {
  return apiPost("/admin/verifications/update", { id, action, note });
}
