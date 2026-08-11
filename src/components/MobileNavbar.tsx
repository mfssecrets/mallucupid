import React, { useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Bell, Plus, Wallet, ImagePlus, Video, User, HelpCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export function MobileNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { username } = useParams<{ username: string }>();
  const base = username ? `/${username}` : '/dashboard';
  const [isPostMenuOpen, setIsPostMenuOpen] = useState(false);

  const navItems = [
    { icon: User, label: 'Profile', path: base },
    { icon: Bell, label: 'Notifications', path: `${base}/notifications` },
    { icon: Plus, label: 'New post', isPrimary: true },
    { icon: Wallet, label: 'Wallet', path: `${base}/wallet` },
    { icon: HelpCircle, label: 'Help', path: `${base}/help` },
  ];

  const goToCreatePost = (type: 'photo' | 'video') => {
    setIsPostMenuOpen(false);
    navigate(`${base}/create-post?type=${type}`);
  };

  return (
    <>
      {/* Photo / Video selection drop box */}
      <AnimatePresence>
        {isPostMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPostMenuOpen(false)}
              className="md:hidden fixed inset-0 bg-zinc-900/30 backdrop-blur-[2px] z-[101]"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="md:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-[102] w-56 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden"
            >
              <button
                onClick={() => goToCreatePost('photo')}
                className="w-full flex items-center gap-3 px-5 py-4 text-zinc-900 hover:bg-rose-50 transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                  <ImagePlus className="w-5 h-5" />
                </span>
                <span className="font-semibold text-sm">Photo</span>
              </button>
              <div className="h-px bg-zinc-100" />
              <button
                onClick={() => goToCreatePost('video')}
                className="w-full flex items-center gap-3 px-5 py-4 text-zinc-900 hover:bg-rose-50 transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5" />
                </span>
                <span className="font-semibold text-sm">Video</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-zinc-200 z-[100] flex items-center justify-around px-2 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.path ? location.pathname === item.path : false;

          if (item.isPrimary) {
            return (
              <button
                key={index}
                onClick={() => setIsPostMenuOpen((open) => !open)}
                aria-label="New post"
                className={`relative -top-5 w-12 h-12 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-rose-500/30 active:scale-95 transition-transform z-[102] ${isPostMenuOpen ? 'rotate-45' : ''}`}
                style={{ transition: 'transform 0.2s' }}
              >
                <Icon className="w-6 h-6" />
              </button>
            );
          }

          return (
            <button
              key={index}
              onClick={() => item.path && navigate(item.path)}
              aria-label={item.label}
              className={`flex flex-col items-center justify-center w-12 h-full transition-colors ${
                isActive ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'fill-zinc-900/10' : ''}`} />
            </button>
          );
        })}
      </nav>
    </>
  );
}
