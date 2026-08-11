import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LogOut, LayoutDashboard, Users, CreditCard, Heart, Grid, PlaySquare, Play, Menu, X, Bell, ShieldCheck, BadgeCheck, Wallet, MoreVertical, Edit2, Trash2, Plus, Copy, Check, Inbox, Link2, ImagePlus, Radio, TrendingUp, Sparkles, UploadCloud, FileImage, FileVideo, Eye, LockKeyhole, Video, Layers, HelpCircle, ChevronDown, Calendar } from "lucide-react";
import { getProfile, publicProfileSlug, createLiveStream, type CreatorPost, type Profile, type ProfileStats, type ExclusiveRoom } from "../lib/auth";
import { ExclusiveHighlightsRow } from "../components/ExclusiveHighlightsRow";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { useAuth } from "../lib/useAuth";
import { BrandIcon } from "../components/BrandMark";
import ScheduleStreamModal from "../components/ScheduleStreamModal";

export default function DashboardPage() {
  const { username: routeUsername } = useParams<{ username: string }>();
  const base = `/${routeUsername}`;
  const { signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats>({ posts: 0, followers: 0, following: 0 });
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewPostMenuOpen, setIsNewPostMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'video'>('grid');
  const navigate = useNavigate();

  const [posts, setPosts] = useState<CreatorPost[]>([]);
  const [rooms, setRooms] = useState<ExclusiveRoom[]>([]);

  // ── Live streaming dropdown + schedule modal ─────────────────────────────
  const [liveMenuOpen, setLiveMenuOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const filteredPosts = posts.filter(post => activeTab === 'grid' ? post.media_type === 'image' : post.media_type === 'video');

  useEffect(() => {
    (async () => {
      const response = await getProfile();
      if (response.profile) setProfile(response.profile);
      if (response.stats) setStats(response.stats);
      setPosts(response.posts || []);
      setRooms(response.rooms || []);
      setIsLoading(false);
    })();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setIsSignOutModalOpen(false);
    navigate("/login", { replace: true });
  };

  const badgeActive =
    profile?.is_verified === true &&
    (profile.verification_status == null || profile.verification_status === "verified");

  // The shareable link is the public creator page (/<username><serial>)
  const publicUrl = profile ? `${window.location.origin}/${publicProfileSlug(profile)}` : '';

  const handleCopyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const SidebarContent = ({ isExpanded = false }: { isExpanded?: boolean }) => (
    <div className={`flex flex-col h-full bg-white border-r border-zinc-200 py-6 w-full ${isExpanded ? 'px-6 items-start' : 'items-center'}`}>
      <div className={`mb-8 ${isExpanded ? 'flex items-center gap-3 w-full' : ''}`}>
        <BrandIcon size="md" />
        {isExpanded && <span className="font-display font-bold text-lg text-zinc-900">Creator Hub</span>}
      </div>
      <div className={`flex-grow flex flex-col space-y-4 w-full ${isExpanded ? 'items-stretch' : 'items-center'}`}>
        <Link to={base} className={`p-3 bg-zinc-100 text-zinc-900 rounded-xl transition-colors group relative ${isExpanded ? 'flex items-center gap-3' : ''}`}>
          <LayoutDashboard className="w-6 h-6 shrink-0" />
          {isExpanded ? <span className="font-semibold">Dashboard</span> : <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">Dashboard</span>}
        </Link>
        <Link to={`${base}/inbox`} className={`p-3 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 rounded-xl transition-colors group relative ${isExpanded ? 'flex items-center gap-3' : ''}`}>
          <div className="relative shrink-0">
            <Inbox className="w-6 h-6" />
          </div>
          {isExpanded ? <span className="font-semibold">Inbox</span> : <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">Inbox</span>}
        </Link>
        <Link to={`${base}/notifications`} className={`p-3 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 rounded-xl transition-colors group relative ${isExpanded ? 'flex items-center gap-3' : ''}`}>
          <Bell className="w-6 h-6 shrink-0" />
          {isExpanded ? <span className="font-semibold">Notifications</span> : <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">Notifications</span>}
        </Link>
        <Link to={`${base}/wallet`} className={`p-3 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 rounded-xl transition-colors group relative ${isExpanded ? 'flex items-center gap-3' : ''}`}>
          <Wallet className="w-6 h-6 shrink-0" />
          {isExpanded ? <span className="font-semibold">Wallet</span> : <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">Wallet</span>}
        </Link>
        <Link to={`${base}/verification`} className={`p-3 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 rounded-xl transition-colors group relative ${isExpanded ? 'flex items-center gap-3' : ''}`}>
          <ShieldCheck className="w-6 h-6 shrink-0" />
          {isExpanded ? <span className="font-semibold">Verification</span> : <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">Verification</span>}
        </Link>
        <Link to={`${base}/help`} className={`p-3 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 rounded-xl transition-colors group relative ${isExpanded ? 'flex items-center gap-3' : ''}`}>
          <HelpCircle className="w-6 h-6 shrink-0" />
          {isExpanded ? <span className="font-semibold">Help</span> : <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">Help</span>}
        </Link>
      </div>
      <div className={`mt-auto pb-4 w-full ${isExpanded ? 'flex flex-col items-stretch' : 'flex flex-col items-center'}`}>
        <button 
          onClick={() => setIsSignOutModalOpen(true)}
          className={`p-3 text-zinc-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors group relative ${isExpanded ? 'flex items-center gap-3' : ''}`}
        >
          <LogOut className="w-6 h-6 shrink-0" />
          {isExpanded ? <span className="font-semibold">Sign out</span> : <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-20 fixed inset-y-0 left-0 z-50">
        <SidebarContent />
      </aside>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="relative w-64 max-w-[80vw] h-full bg-white flex flex-col z-50 shadow-2xl"
            >
              <SidebarContent isExpanded={true} />
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 -right-12 p-2 text-white bg-zinc-900/50 hover:bg-zinc-900 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 md:ml-20 flex flex-col min-h-screen pt-14 pb-14 md:pt-0 md:pb-0">
        <main className="flex-grow container mx-auto px-4 sm:px-8 pt-0 pb-8 md:py-8 max-w-4xl">
          {isLoading ? (
            // Skeleton Loading State
            <div className="animate-pulse">
              <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-10 mb-8 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-12">
                  <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-zinc-200 flex-shrink-0" />
                  <div className="flex-grow w-full">
                    <div className="h-8 bg-zinc-200 rounded-lg w-48 mb-6" />
                    <div className="flex items-center gap-8 mb-6">
                      <div className="h-6 bg-zinc-200 rounded-lg w-20" />
                      <div className="h-6 bg-zinc-200 rounded-lg w-24" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-zinc-200 rounded-lg w-32" />
                      <div className="h-4 bg-zinc-200 rounded-lg w-full max-w-md" />
                      <div className="h-4 bg-zinc-200 rounded-lg w-3/4 max-w-sm" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-center gap-12 border-t border-zinc-200 pt-4 mb-2">
                <div className="h-6 w-6 bg-zinc-200 rounded" />
                <div className="h-6 w-6 bg-zinc-200 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="aspect-[4/5] bg-zinc-200 rounded-xl" />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Instagram-style Profile Header */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 md:mb-8 px-1 sm:px-0 max-w-[600px] mx-auto w-full pt-4 md:pt-4"
              >
                <div className="flex items-center gap-6 sm:gap-12 mb-5">
                  {/* Profile Image */}
                  <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-full overflow-hidden flex-shrink-0 relative border border-zinc-200">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-zinc-200 flex items-center justify-center text-2xl font-bold text-zinc-500">
                        {profile?.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    {/* Note bubble */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded-full whitespace-nowrap shadow-sm border border-zinc-700 hidden sm:block">
                      Note...
                    </div>
                  </div>
                  
                  <div className="flex flex-col flex-grow">
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-xl sm:text-2xl font-bold text-zinc-900">{profile?.username || ''}</h2>
                      <VerifiedBadge verified={badgeActive} />
                    </div>

                    {/* Stats Desktop */}
                    <div className="flex items-center gap-6 sm:gap-10">
                      <div className="flex flex-col items-center sm:items-start"><span className="font-bold text-zinc-900 text-lg">{stats.posts}</span> <span className="text-zinc-900 text-sm">posts</span></div>
                      <div className="flex flex-col items-center sm:items-start"><span className="font-bold text-zinc-900 text-lg">{stats.followers}</span> <span className="text-zinc-900 text-sm">subscribers</span></div>
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <div className="mb-6 text-sm">
                  <h3 className="font-bold text-zinc-900 mb-0.5 text-base">{profile?.full_name || ''}</h3>
                  <p className="text-zinc-500 mb-1">Creator</p>
                  <p className="text-zinc-900 whitespace-pre-line leading-relaxed mb-1">
                    {profile?.bio || ''}
                  </p>
                  {profile?.location && <p className="text-zinc-600 mb-1">📍 {profile.location}</p>}
                  <a
                    href={publicUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-900 font-semibold inline-flex items-center gap-1 flex-wrap break-all"
                  >
                    <Link2 className="w-4 h-4 shrink-0"/> <span className="break-all">{window.location.host}/{profile ? publicProfileSlug(profile) : ''}</span>
                  </a>
                </div>

                {/* Action Buttons */}
                {!badgeActive && (
                  <div className="mb-4 w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {profile?.verification_status === 'pending'
                      ? 'Your badge request is on preview. Posts and Exclusive Rooms stay locked for fans until admin approval.'
                      : 'Complete identity verification to publish posts and create Exclusive Rooms.'}{' '}
                    <button
                      type="button"
                      onClick={() => navigate(`${base}/verification`)}
                      className="font-semibold text-rose-600 underline underline-offset-2"
                    >
                      {profile?.verification_status === 'pending' ? 'View status' : 'Verify now'}
                    </button>
                  </div>
                )}
                <div className="flex gap-2 w-full">
                  <button 
                    onClick={() => navigate(`${base}/edit-profile`)}
                    className="flex-1 py-1.5 px-4 bg-zinc-200 hover:bg-zinc-300 text-zinc-900 font-semibold rounded-lg text-sm transition-colors text-center"
                  >
                    Edit profile
                  </button>
                  <button 
                    onClick={() => setIsShareModalOpen(true)}
                    className="flex-1 py-1.5 px-4 bg-zinc-200 hover:bg-zinc-300 text-zinc-900 font-semibold rounded-lg text-sm transition-colors text-center"
                  >
                    Share profile
                  </button>
                  {/* Live streaming dropdown (desktop) */}
                  <div className="relative hidden md:block">
                    <button
                      onClick={() => {
                        if (!badgeActive) {
                          navigate(`${base}/verification`);
                          return;
                        }
                        setLiveMenuOpen((open) => !open);
                      }}
                      className="py-1.5 px-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-1.5 shadow-md shadow-rose-500/20"
                    >
                      <Radio className="w-4 h-4" />
                      Live
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${liveMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {liveMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setLiveMenuOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                            className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-50"
                          >
                            <button
                              onClick={async () => {
                                setLiveMenuOpen(false);
                                if (!badgeActive) { navigate(`${base}/verification`); return; }
                                // "Start Live Now" creates an instant scheduled stream starting now (15 min) and opens the live page.
                                const res = await createLiveStream({
                                  title: `${profile?.username || 'Live'} — ${new Date().toLocaleString()}`,
                                  scheduled_start: new Date().toISOString(),
                                  duration_minutes: 15,
                                  is_paid: false,
                                });
                                if (res.stream) navigate(`/live/${res.stream.public_id}`);
                                else alert(res.error || 'Could not start live');
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3.5 text-zinc-900 hover:bg-rose-50 transition-colors text-left"
                            >
                              <span className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                                <Radio className="w-4 h-4" />
                              </span>
                              <span className="font-semibold text-sm">Start Live Now</span>
                            </button>
                            <div className="h-px bg-zinc-100" />
                            <button
                              onClick={() => { setLiveMenuOpen(false); setScheduleOpen(true); }}
                              className="w-full flex items-center gap-3 px-4 py-3.5 text-zinc-900 hover:bg-rose-50 transition-colors text-left"
                            >
                              <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                                <Calendar className="w-4 h-4" />
                              </span>
                              <span className="font-semibold text-sm">Schedule My Live</span>
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                  {/* New post (desktop) */}
                  <div className="relative hidden md:block">
                    <button
                      onClick={() => {
                        if (!badgeActive) {
                          navigate(`${base}/verification`);
                          return;
                        }
                        setIsNewPostMenuOpen((open) => !open);
                      }}
                      className="py-1.5 px-4 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-1.5 shadow-md shadow-rose-500/20"
                    >
                      <Plus className={`w-4 h-4 transition-transform ${isNewPostMenuOpen ? 'rotate-45' : ''}`} />
                      New post
                    </button>
                    <AnimatePresence>
                      {isNewPostMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsNewPostMenuOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                            className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-50"
                          >
                            <button
                              onClick={() => { setIsNewPostMenuOpen(false); navigate(`${base}/create-post?type=photo`); }}
                              className="w-full flex items-center gap-3 px-4 py-3.5 text-zinc-900 hover:bg-rose-50 transition-colors text-left"
                            >
                              <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                                <ImagePlus className="w-4 h-4" />
                              </span>
                              <span className="font-semibold text-sm">Photo</span>
                            </button>
                            <div className="h-px bg-zinc-100" />
                            <button
                              onClick={() => { setIsNewPostMenuOpen(false); navigate(`${base}/create-post?type=video`); }}
                              className="w-full flex items-center gap-3 px-4 py-3.5 text-zinc-900 hover:bg-rose-50 transition-colors text-left"
                            >
                              <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                                <Video className="w-4 h-4" />
                              </span>
                              <span className="font-semibold text-sm">Video</span>
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>

              {/* Exclusive Rooms — Instagram highlights style */}
              <div className="mb-6">
                <ExclusiveHighlightsRow
                  rooms={rooms}
                  canManage
                  onAddRoom={() => {
                    if (!badgeActive) {
                      navigate(`${base}/verification`);
                      return;
                    }
                    navigate(`${base}/exclusive/new`);
                  }}
                  onOpenRoom={(room) => navigate(`${base}/exclusive/${room.id}`)}
                />
              </div>

              {/* Content Tabs */}
              <div className="flex items-center justify-center gap-12 border-t border-zinc-200 pt-4 mb-2">
                <button 
                  onClick={() => setActiveTab('grid')}
                  className={`flex items-center justify-center p-2 -mt-[18px] transition-colors border-t-2 ${activeTab === 'grid' ? 'text-zinc-900 border-zinc-900' : 'text-zinc-400 hover:text-zinc-900 border-transparent'}`}
                >
                  <Grid className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => setActiveTab('video')}
                  className={`flex items-center justify-center p-2 -mt-[18px] transition-colors border-t-2 ${activeTab === 'video' ? 'text-zinc-900 border-zinc-900' : 'text-zinc-400 hover:text-zinc-900 border-transparent'}`}
                >
                  <PlaySquare className="w-6 h-6" />
                </button>
              </div>

              {/* Gallery Grid */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-2 gap-2 sm:gap-4"
              >
                {filteredPosts.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => navigate(`${base}/post/${post.public_id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`${base}/post/${post.public_id}`); }}
                    className="relative bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm flex flex-col group cursor-pointer"
                  >
                    <div className={`relative ${post.media_type === 'video' ? 'aspect-[9/16]' : 'aspect-[4/5]'} bg-black overflow-hidden shrink-0`}>
                      {post.media_type === 'video' ? (
                        <video src={post.media_url} className={`w-full h-full object-contain bg-black pointer-events-none ${post.is_paid ? 'blur-[40px] scale-110' : ''}`} playsInline muted preload="metadata" />
                      ) : (
                        <img src={post.media_url} alt={`Post ${post.id}`} className={`w-full h-full object-cover transition-transform duration-500 ${post.is_paid ? 'blur-[40px] scale-110' : 'group-hover:scale-105'}`} />
                      )}

                      {post.media_type === 'video' && !post.is_paid && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white">
                            <Play className="w-5 h-5 fill-white" />
                          </div>
                        </div>
                      )}

                      {post.media_type === 'image' && post.media_count > 1 && !post.is_paid && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-black/40 backdrop-blur-md rounded-full text-white flex items-center gap-1 text-[10px] font-bold">
                          <Layers className="w-3.5 h-3.5" /> {post.media_count}
                        </div>
                      )}

                      {/* Paid: 95% blur + unlock */}
                      {post.is_paid && (
                        <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center z-10 p-4 text-center">
                          <div className="bg-white p-3.5 rounded-full mb-3 shadow-lg">
                            <LockKeyhole className="w-6 h-6 text-zinc-900" />
                          </div>
                          <span className="text-white font-bold text-sm sm:text-base drop-shadow-md mb-1">Exclusive Content</span>
                          <span className="text-white/80 text-xs drop-shadow-md mb-4">Unlock this post to view the content</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`${base}/post/${post.public_id}`); }}
                            className="px-5 py-2 bg-white hover:bg-zinc-100 text-zinc-900 rounded-full text-xs sm:text-sm font-bold transition-colors shadow-lg"
                          >
                            Unlock for ₹{post.price}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="px-3 py-2.5 bg-white flex items-center justify-between gap-2">
                      <p className="text-zinc-700 text-xs line-clamp-1 leading-relaxed flex-1">
                        {post.caption || 'No caption'}
                      </p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${post.is_paid ? 'bg-rose-50 text-rose-500' : 'bg-zinc-100 text-zinc-500'}`}>
                        {post.is_paid ? `₹${post.price}` : 'Free'}
                      </span>
                    </div>
                  </div>
                ))}
                {!filteredPosts.length && (
                  <div className="col-span-2 py-16 text-center text-zinc-500">
                    No {activeTab === 'video' ? 'video' : 'image'} posts yet.
                  </div>
                )}
              </motion.div>
            </>
          )}
        </main>
      </div>

      {/* Share Profile Modal */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShareModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-xl border border-zinc-100 p-6 sm:p-8 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-zinc-900">Share Profile</h3>
                <button onClick={() => setIsShareModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex items-center justify-between gap-4">
                <span className="text-zinc-700 text-sm truncate flex-1 font-medium select-all">
                  {publicUrl}
                </span>
                <button 
                  onClick={handleCopyLink}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${copied ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'}`}
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              {copied && <p className="text-emerald-500 text-sm mt-2 font-medium text-center">Link copied to clipboard!</p>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sign Out Confirmation Modal */}
      <AnimatePresence>
        {isSignOutModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSignOutModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-xl border border-zinc-100 p-6 sm:p-8 overflow-hidden"
            >
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4 text-rose-500">
                <LogOut className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">Sign out of your account?</h3>
              <p className="text-zinc-500 mb-6">You will need to log back in to access your creator dashboard.</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsSignOutModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSignOut}
                  className="flex-1 py-3 px-4 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl transition-colors shadow-md shadow-rose-500/20"
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ScheduleStreamModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onCreated={(stream) => {
          setScheduleOpen(false);
          navigate(`/live/${stream.public_id}`);
        }}
      />
    </div>
  );
}
