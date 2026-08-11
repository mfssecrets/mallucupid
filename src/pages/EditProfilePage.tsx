import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Camera, Loader2, Lock } from "lucide-react";
import { getProfile, updateProfile, type Profile } from "../lib/auth";

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

type EditForm = {
  name: string;
  username: string;
  bio: string;
  location: string;
  instagram: string;
  facebook: string;
  gender: Profile["gender"];
};

export default function EditProfilePage() {
  const navigate = useNavigate();
  const { username: routeUsername } = useParams<{ username: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: '',
    username: '',
    bio: '',
    location: '',
    instagram: '',
    facebook: '',
    gender: 'Prefer not to say',
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [avatarType, setAvatarType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const response = await getProfile();
      if (response.error || !response.profile) {
        setError(response.error || 'Failed to load profile');
        setIsLoading(false);
        return;
      }
      const profile = response.profile;
      setEditForm({
        name: profile.full_name || '',
        username: profile.username,
        bio: profile.bio || '',
        location: profile.location || '',
        instagram: profile.instagram_url || '',
        facebook: profile.facebook_url || '',
        gender: profile.gender || 'Prefer not to say',
      });
      setAvatarUrl(profile.avatar_url);
      setIsLoading(false);
    })();
  }, []);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Choose a JPG, PNG, WEBP, or GIF image.');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setError('Profile image must be 5MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAvatarUrl(result);
      setAvatarBase64(result);
      setAvatarType(file.type);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!editForm.name.trim() || !editForm.bio.trim()) {
      setError('Display name and bio are required.');
      return;
    }

    setIsSaving(true);
    // Username is intentionally never sent: it is permanent after signup
    const response = await updateProfile({
      full_name: editForm.name,
      bio: editForm.bio,
      location: editForm.location,
      instagram_url: editForm.instagram,
      facebook_url: editForm.facebook,
      gender: editForm.gender,
      ...(avatarBase64 && avatarType
        ? { avatar_base64: avatarBase64, avatar_content_type: avatarType }
        : {}),
    });
    setIsSaving(false);
    if (response.error) {
      setError(response.error);
      return;
    }
    navigate(`/${routeUsername}`, { replace: true });
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-7 h-7 text-rose-500 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:items-center md:justify-center md:p-8 pt-14 pb-14 md:pt-8 md:pb-8">
      <div className="w-full max-w-xl bg-white md:rounded-3xl shadow-none md:shadow-xl border-x-0 border-y-0 md:border border-zinc-100 p-6 sm:p-8 flex-grow md:flex-grow-0">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(`/${routeUsername}`)} className="p-2 -ml-2 rounded-full hover:bg-zinc-100 transition-colors">
            <ArrowLeft className="w-6 h-6 text-zinc-900" />
          </button>
          <h2 className="text-2xl font-bold text-zinc-900">Edit Profile</h2>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 text-red-600 p-3 rounded-xl flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        <form id="edit-profile-form" onSubmit={handleEditProfileSubmit} className="space-y-6">
          {/* Profile Photo */}
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full overflow-hidden shrink-0 border border-zinc-200">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-zinc-100 flex items-center justify-center"><Camera className="w-7 h-7 text-zinc-400" /></div>
              )}
            </div>
            <div className="flex-1">
              <div className="mb-2">
                <h4 className="font-bold text-zinc-900 text-sm">{editForm.username}</h4>
                <p className="text-zinc-500 text-sm">{editForm.name}</p>
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors">
                Change photo
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarChange} className="hidden" />
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-900">Name</label>
            <input 
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({...editForm, name: e.target.value})}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
              placeholder="Your name"
              required
            />
          </div>

          {/* Username (permanent, read-only) */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-900">Username</label>
            <div className="relative">
              <input 
                type="text"
                value={editForm.username}
                readOnly
                disabled
                className="w-full px-4 py-3 pr-11 bg-zinc-100 border border-zinc-200 rounded-xl text-zinc-500 cursor-not-allowed focus:outline-none"
              />
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-xs text-zinc-500">Usernames are permanent and cannot be changed.</p>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-900">Bio</label>
            <textarea 
              required
              maxLength={400}
              value={editForm.bio}
              onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors resize-none h-24"
              placeholder="Write something about yourself..."
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-900">Location</label>
            <input 
              type="text"
              value={editForm.location}
              onChange={(e) => setEditForm({...editForm, location: e.target.value})}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
              placeholder="City, Country"
            />
          </div>

          {/* Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-2">Social Links</h4>
            <div className="space-y-3 flex flex-col sm:flex-row gap-0 sm:gap-4">
              <input 
                type="url"
                value={editForm.instagram}
                onChange={(e) => setEditForm({...editForm, instagram: e.target.value})}
                className="w-full sm:flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors mb-3 sm:mb-0"
                placeholder="Instagram URL"
              />
              <input 
                type="url"
                value={editForm.facebook}
                onChange={(e) => setEditForm({...editForm, facebook: e.target.value})}
                className="w-full sm:flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                placeholder="Facebook URL"
              />
            </div>
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-900">Gender</label>
            <select
              value={editForm.gender}
              onChange={(e) => setEditForm({...editForm, gender: e.target.value})}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors appearance-none"
            >
              <option value="Prefer not to say">Prefer not to say</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Transgender">Transgender</option>
            </select>
          </div>

          <div className="pt-4 border-t border-zinc-200">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl transition-colors text-lg shadow-sm disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
