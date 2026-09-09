"use client";

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    if (!token) {
      setStatus('error');
      setMessage('No verification token found');
      return;
    }

    hasVerified.current = true;

    const verifyEmail = async () => {
      try {
        
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/verify-email?token=${token}`
        );
        
        const data = await response.json();
        
        if (!response.ok) {
          setStatus('error');
          setMessage(data.error || 'Verification failed');
          return;
        }

        setStatus('success');
        setMessage('Email verified successfully! Logging you in...');

        if (data.token) {          
          
          const loginResult = await signIn('credentials', {
            email: data.email,
            password: 'VERIFIED_BY_TOKEN', // Backend will check emailVerified flag
            redirect: false,
            callbackUrl: '/dashboard',
          });

          if (loginResult?.error) {
            setMessage('Email verified! Please login to continue.');
            setTimeout(() => router.push('/login'), 2000);
          } else {
            setMessage('Email verified! Redirecting to dashboard...');
            setTimeout(() => router.push('/dashboard'), 1500);
          }
        } else {
          // Fallback: No token received
          setMessage('Email verified! Please login to continue.');
          setTimeout(() => router.push('/login'), 2000);
        }

      } catch (error) {
        console.error('Frontend - Error:', error);
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      }
    };

    verifyEmail();
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] px-4">
      <div className="glass p-8 rounded-2xl w-full max-w-md text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-white">Verifying your email...</h2>
            <p className="text-gray-400 mt-2">Please wait a moment</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">✅ Email Verified!</h2>
            <p className="text-gray-400 mt-2">{message}</p>
            <div className="w-full bg-white/5 h-1.5 rounded-full mt-4 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full animate-pulse" style={{ width: '100%' }}></div>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">❌ Verification Failed</h2>
            <p className="text-red-400 mt-2">{message}</p>
            <Link 
              href="/login" 
              className="inline-block mt-6 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg font-semibold hover:scale-105 transition"
            >
              Go to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f]" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}