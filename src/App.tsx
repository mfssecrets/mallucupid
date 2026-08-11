import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { HowItWorks } from "./components/HowItWorks";
import { CommunityCTA } from "./components/CommunityCTA";
import { SeoSection } from "./components/SeoSection";
import { Footer } from "./components/Footer";

import { AuthProvider, RequireAuth, useAuth } from "./lib/useAuth";
import CreatorLayout from "./components/CreatorLayout";
import { useAntiDebug, DevtoolsBlocker } from "./lib/antiDebug";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import VerifyOtpPage from "./pages/VerifyOtpPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import VerificationPage from "./pages/VerificationPage";
import EditProfilePage from "./pages/EditProfilePage";
import CreatorOnboardingPage from "./pages/CreatorOnboardingPage";
import CreatePostPage from "./pages/CreatePostPage";
import MediaViewerPage from "./pages/MediaViewerPage";
import EditPostPage from "./pages/EditPostPage";
import ReportPostPage from "./pages/ReportPostPage";
import WalletPage from "./pages/WalletPage";
import HelpPage from "./pages/HelpPage";
import NotificationsPage from "./pages/NotificationsPage";
import InboxPage from "./pages/InboxPage";
import ChatPage from "./pages/ChatPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import RefundPolicyPage from "./pages/RefundPolicyPage";
import ContactUsPage from "./pages/ContactUsPage";
import PublicProfilePage from "./pages/PublicProfilePage";
import UserLogin from "./pages/UserLogin";
import UserSignup from "./pages/UserSignup";
import UserOtpVerify from "./pages/UserOtpVerify";
import UserPasswordReset from "./pages/UserPasswordReset";
import PaymentConfirmationPage from "./pages/PaymentConfirmationPage";
import ExclusiveRoomPage from "./pages/ExclusiveRoomPage";
import ExclusiveRoomFormPage from "./pages/ExclusiveRoomFormPage";
import ExclusiveRoomCreatePostPage from "./pages/ExclusiveRoomCreatePostPage";
import ExclusiveMediaViewerPage from "./pages/ExclusiveMediaViewerPage";
import LiveStreamPage from "./pages/LiveStreamPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";

function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <CommunityCTA />
        <SeoSection />
      </main>
      <Footer />
    </>
  );
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-24 pb-12 bg-zinc-50 flex items-start sm:items-center justify-center p-6">
        {children}
      </main>
    </>
  );
}

/** Redirects legacy paths like /dashboard to the username-based URL /<username>/<page>. */
function LegacyRedirect({ page = "" }: { page?: string }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="rounded-3xl bg-white p-8 shadow-lg border border-zinc-200 text-center">
          <p className="text-zinc-700 font-medium">Loading your session…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const username = user.user_metadata?.username;
  if (!username) return <Navigate to="/login" replace />;

  return <Navigate to={`/${username}${page ? `/${page}` : ""}${location.search}`} replace />;
}

/**
 * Distinguishes public creator pages (/<username><5-digit serial>, e.g.
 * /founder00151) from the logged-in creator app (/<username>). A slug ending
 * in exactly 5 digits routes to the public page — unless it is the logged-in
 * user's own username, which keeps their dashboard working even if their
 * username happens to end in digits.
 */
function UsernameRouteSwitch() {
  const { username: slug } = useParams<{ username: string }>();
  const { user, loading } = useAuth();

  // /admin<uuid> is caught by /:username in React Router 7 (no mid-segment params).
  const adminId = slug?.match(
    /^admin([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
  )?.[1];
  if (adminId) return <AdminDashboardPage />;

  const looksLikePublicSlug = /^.+\d{5}$/.test(slug || "");

  // Wait for session before routing so consumers aren't bounced through
  // CreatorLayout → /userlogin when they hit /:username without a serial.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-7 h-7 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!looksLikePublicSlug) {
    if (user?.user_metadata?.role === "admin") {
      return <Navigate to={`/admin${user.id}`} replace />;
    }
    if (user?.user_metadata?.role === "user") {
      return <Navigate to="/user-inbox" replace />;
    }
    return <CreatorLayout />;
  }

  const ownUsername = user?.user_metadata?.username;
  if (slug === ownUsername) return <CreatorLayout />;
  return <PublicProfilePage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AntiDebugShell />
      </AuthProvider>
    </BrowserRouter>
  );
}

/** Mounts anti-debug protection and renders the route tree. */
function AntiDebugShell() {
  const { devtoolsOpen } = useAntiDebug();
  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900 antialiased selection:bg-rose-500/30">
      <DevtoolsBlocker open={devtoolsOpen} />
      <Routes>
            <Route path="/" element={<LandingPage />} />

            <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
            <Route path="/signup" element={<AuthLayout><SignupPage /></AuthLayout>} />
            <Route path="/verify-otp" element={<AuthLayout><VerifyOtpPage /></AuthLayout>} />
            <Route path="/forgot-password" element={<AuthLayout><ForgotPasswordPage /></AuthLayout>} />
            <Route path="/onboarding" element={<AuthLayout><CreatorOnboardingPage /></AuthLayout>} />
            <Route path="/terms-and-conditions" element={<AuthLayout><TermsPage /></AuthLayout>} />
            <Route path="/privacy-policy" element={<AuthLayout><PrivacyPolicyPage /></AuthLayout>} />
            <Route path="/refund-policy" element={<AuthLayout><RefundPolicyPage /></AuthLayout>} />
            <Route path="/contact-us" element={<AuthLayout><ContactUsPage /></AuthLayout>} />
            <Route path="/adminlogin" element={<AdminLoginPage />} />
            <Route path="/userlogin" element={<UserLogin />} />
            <Route path="/usersignup" element={<UserSignup />} />
            <Route path="/userotpverify" element={<UserOtpVerify />} />
            <Route path="/userpasswordreset" element={<UserPasswordReset />} />
            <Route path="/view/exclusive/:postId" element={<RequireAuth><ExclusiveMediaViewerPage /></RequireAuth>} />
            <Route path="/view/:postId" element={<RequireAuth><MediaViewerPage /></RequireAuth>} />
            <Route path="/exclusive/:roomId" element={<RequireAuth><ExclusiveRoomPage /></RequireAuth>} />
            <Route path="/live/:publicId" element={<RequireAuth><LiveStreamPage /></RequireAuth>} />
            <Route path="/report/:postId" element={<RequireAuth><ReportPostPage /></RequireAuth>} />
            <Route path="/payment-confirmation" element={<RequireAuth><PaymentConfirmationPage /></RequireAuth>} />
            <Route path="/user-inbox" element={<RequireAuth><InboxPage /></RequireAuth>} />
            <Route path="/user-notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
            <Route path="/user-chat/:conversationId" element={<RequireAuth><ChatPage /></RequireAuth>} />

            {/* Legacy paths redirect to /<username>/... */}
            <Route path="/dashboard" element={<LegacyRedirect />} />
            <Route path="/edit-profile" element={<LegacyRedirect page="edit-profile" />} />
            <Route path="/create-post" element={<LegacyRedirect page="create-post" />} />
            <Route path="/verification" element={<LegacyRedirect page="verification" />} />

            {/* Username-based creator routes with persistent mobile header + navbar.
                Slugs ending in a 5-digit serial render the public creator page instead. */}
            <Route path="/:username" element={<UsernameRouteSwitch />}>
              <Route index element={<DashboardPage />} />
              <Route path="edit-profile" element={<EditProfilePage />} />
              <Route path="create-post" element={<CreatePostPage />} />
              <Route path="exclusive/new" element={<ExclusiveRoomFormPage />} />
              <Route path="exclusive/:roomId/edit" element={<ExclusiveRoomFormPage />} />
              <Route path="exclusive/:roomId/create" element={<ExclusiveRoomCreatePostPage />} />
              <Route path="exclusive/:roomId" element={<ExclusiveRoomPage />} />
              <Route path="post/:postId" element={<MediaViewerPage />} />
              <Route path="post/:postId/edit" element={<EditPostPage />} />
              <Route path="post/:postId/report" element={<ReportPostPage />} />
              <Route path="verification" element={<VerificationPage />} />
              <Route path="wallet" element={<WalletPage />} />
              <Route path="help" element={<HelpPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="inbox" element={<InboxPage />} />
              <Route path="chat/:conversationId" element={<ChatPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
    </div>
  );
}
