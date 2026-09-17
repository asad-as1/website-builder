"use client";

import { useEffect, useState, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios, { AxiosError } from 'axios';
import { Eye, EyeOff, Mail, CheckCircle, ArrowRight, Camera, X, Loader2 } from 'lucide-react';

// Google SVG Icon
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
);

export default function RegisterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  // ✅ Avatar state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-4 text-white">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
          <span className="text-sm text-gray-300">Loading your account...</span>
        </div>
      </div>
    );
  }

  if (session) return null;

  // ✅ Avatar select handler
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Only images allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Max 5MB allowed');
      return;
    }

    setAvatarFile(file);
    setAvatarError('');
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError('');
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // ✅ Use FormData for file upload
      const formData = new FormData();
      formData.append('email', email);
      formData.append('password', password);
      formData.append('name', name);
      if (avatarFile) formData.append('avatar', avatarFile);

      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setRegisteredEmail(email);
      setIsSuccess(true);
      setEmail('');
      setPassword('');
      setName('');
      clearAvatar();
    } catch (err) {
      const axiosError = err as AxiosError<{ error?: string }>;
      setError(axiosError.response?.data?.error || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    signIn('google', { callbackUrl: '/dashboard' });
  };

  // ✅ Success Screen
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] px-4">
        <div className="glass p-8 rounded-2xl w-full max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">
            Registration Successful! 🎉
          </h1>
          
          <p className="text-gray-400 mb-6">
            We&apos;ve sent a verification email to
          </p>
          
          <div className="flex items-center justify-center gap-2 bg-white/5 rounded-lg px-4 py-2 mb-6">
            <Mail className="w-4 h-4 text-cyan-400" />
            <span className="text-white font-medium">{registeredEmail}</span>
          </div>
          
          <div className="space-y-4 text-left">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-cyan-400 text-sm font-bold">1</span>
              </div>
              <div>
                <p className="text-sm text-gray-300">Open your email inbox</p>
                <p className="text-xs text-gray-500">Check the email we just sent you</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-cyan-400 text-sm font-bold">2</span>
              </div>
              <div>
                <p className="text-sm text-gray-300">Click the verification link</p>
                <p className="text-xs text-gray-500">It will verify your email address</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-amber-400 text-sm font-bold">!</span>
              </div>
              <div>
                <p className="text-sm text-gray-300">Check your spam folder</p>
                <p className="text-xs text-amber-400">If you don&apos;t see the email, check spam</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => router.push('/login')}
            className="w-full mt-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg font-semibold hover:scale-105 transition flex items-center justify-center gap-2"
          >
            Go to Login
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ✅ Register Form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] px-4 py-10">
      <div className="glass p-8 rounded-2xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center gradient-text mb-6">
          Create Account
        </h1>

        {/* ✅ Avatar Upload */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <input
              ref={avatarInputRef}
              type="file"
              hidden
              accept="image/*"
              onChange={handleAvatarSelect}
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="w-24 h-24 rounded-full border-2 border-dashed border-white/20 hover:border-cyan-400/60 bg-white/5 flex items-center justify-center overflow-hidden transition group relative"
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="avatar preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-400 group-hover:text-cyan-400">
                  <Camera className="w-6 h-6" />
                  <span className="text-[10px]">Add Photo</span>
                </div>
              )}
            </button>
            {avatarPreview && (
              <button
                type="button"
                onClick={clearAvatar}
                className="absolute -top-1 -right-1 p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        {avatarError && (
          <p className="text-xs text-red-400 text-center mb-4">{avatarError}</p>
        )}
        <p className="text-center text-xs text-gray-500 mb-6">
          Optional · Max 5MB · JPG or PNG
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Full Name</label>
            <input
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition cursor-text"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition cursor-text"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition cursor-text pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg font-semibold hover:scale-105 transition flex items-center justify-center gap-2 ${
              isLoading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[#1a1a2e] text-gray-400">OR</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full py-3 border border-white/20 rounded-lg font-semibold hover:bg-white/10 transition flex items-center justify-center gap-3"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <p className="text-center text-gray-400 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-cyan-400 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}