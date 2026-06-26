'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, CheckCircle, FileText } from 'lucide-react';

export default function AuthPage() {
  const { user, loading, login, signup } = useAuth();
  const router = useRouter();
  
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          <p className="text-sm text-gray-500 font-medium animate-pulse">Checking authentication status...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFormLoading(true);

    if (!email || !password || (!isLogin && !name)) {
      setError('Please fill in all required fields.');
      setFormLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.error || 'Invalid credentials');
        }
      } else {
        const res = await signup(name, email, password);
        if (!res.success) {
          setError(res.error || 'Registration failed');
        }
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-screen bg-background">
      {/* Visual branding side panel */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-orange-50/80 via-slate-50 to-orange-100/50 border-r border-slate-200 p-12 flex-col justify-between text-slate-900 relative overflow-hidden">
        {/* Simple ambient light orange gradient color background */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full bg-orange-200/30 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] rounded-full bg-orange-100/40 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_35%,rgba(249,115,22,0.02),transparent_40%)]" />
        </div>
        
        <div className="flex items-center gap-2 font-semibold text-lg tracking-wide z-10 text-slate-800 animate-slide-up opacity-0">
          <div className="bg-orange-600 text-white p-2 rounded-lg shadow-sm">
            <FileText className="h-5 w-5" />
          </div>
          <span>SyncDoc</span>
        </div>

        <div className="my-auto max-w-md z-10 p-8 glass-panel bg-white/80 rounded-3xl border border-white/80 shadow-xl space-y-6 animate-slide-up opacity-0 delay-1">
          <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight tracking-tight text-slate-950">
            Write together.<br />Work anywhere.
          </h1>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            SyncDoc is a smart document editor for modern teams. Keep writing even when your internet connection drops, and collaborate with your team without losing your work.
          </p>

          <div className="space-y-3.5 pt-2">
            <div className="flex items-center gap-3">
              <div className="bg-orange-50 p-1.5 rounded-lg shrink-0">
                <CheckCircle className="h-4 w-4 text-orange-600" />
              </div>
              <span className="text-slate-700 font-medium text-xs sm:text-sm">Work offline—never lose typed work when internet drops</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-orange-50 p-1.5 rounded-lg shrink-0">
                <CheckCircle className="h-4 w-4 text-orange-600" />
              </div>
              <span className="text-slate-700 font-medium text-xs sm:text-sm">Seamless collaborative editing without save conflicts</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-orange-50 p-1.5 rounded-lg shrink-0">
                <CheckCircle className="h-4 w-4 text-orange-600" />
              </div>
              <span className="text-slate-700 font-medium text-xs sm:text-sm">Look back at older drafts & restore them with one click</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-orange-50 p-1.5 rounded-lg shrink-0">
                <CheckCircle className="h-4 w-4 text-orange-600" />
              </div>
              <span className="text-slate-700 font-medium text-xs sm:text-sm">Built-in AI helper to summarize and autocomplete text</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400 z-10 font-mono animate-slide-up opacity-0 delay-2">
          SyncDoc Project • Built by Shruti Sonawane
        </div>
      </div>

      {/* Forms Section */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-12 md:p-16">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div>
            <div className="md:hidden flex items-center gap-2 font-semibold text-lg text-orange-600 mb-8">
              <FileText className="h-6 w-6" />
              <span>SyncDoc</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight">
              {isLogin ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {isLogin ? "Don't have an account yet?" : 'Already registered?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                }}
                className="font-medium text-orange-600 hover:text-orange-500 transition-colors"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {!isLogin && (
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <User className="h-5 w-5" />
                    </div>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-transparent focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-transparent focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-transparent focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={formLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {formLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : isLogin ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
