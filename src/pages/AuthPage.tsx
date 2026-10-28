import React, { useState } from 'react';
import { Shield, Lock, Mail, User, Phone, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthPageProps {
  onSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { login, register, loginDemoUser } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (isLoginMode) {
        await login(email, password);
      } else {
        await register(name, email, phone, password);
      }
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role: 'user' | 'admin') => {
    setLoading(true);
    try {
      await loginDemoUser(role);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4 bg-[#08090b] antialiased">
      <div className="max-w-md w-full bg-[#17181c] rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="bg-[#101114] text-[#f5f5f7] p-6 text-center space-y-2 border-b border-white/10">
          <div className="w-12 h-12 rounded-2xl bg-[#0a84ff]/10 border border-[#0a84ff]/20 text-[#64b5ff] flex items-center justify-center font-bold mx-auto">
            <Shield className="w-6 h-6 text-[#0a84ff]" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">SafeCircle AI Access</h2>
          <p className="text-xs text-[#a1a1aa] leading-relaxed">
            {isLoginMode
              ? 'Sign in to access saved routes, emergency SOS, and live sharing'
              : 'Create an account to join the women travel safety network'}
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick Demo Switcher for Evaluation */}
          <div className="bg-[#101114] border border-white/10 rounded-2xl p-4 text-xs space-y-2.5">
            <span className="font-semibold text-[#a1a1aa] block text-[11px] uppercase tracking-wider">
              1-Click Academic Evaluation Profiles:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('user')}
                className="py-2.5 px-3 bg-[#17181c] hover:bg-white/10 text-[#f5f5f7] border border-white/10 font-medium rounded-xl text-xs transition text-left space-y-0.5"
              >
                <div className="font-bold text-[#f5f5f7]">Priya Sharma</div>
                <div className="text-[10px] text-[#64b5ff]">Regular Traveler</div>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('admin')}
                className="py-2.5 px-3 bg-[#0a84ff] hover:bg-[#0077ed] text-white font-medium rounded-xl text-xs transition shadow-md shadow-[#0a84ff]/20 text-left space-y-0.5"
              >
                <div className="font-bold text-white">Dr. Anita Roy</div>
                <div className="text-[10px] text-white/80">Safety Admin</div>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-[#ff453a]/10 border border-[#ff453a]/20 text-[#ff453a] text-xs rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          {/* Regular Login / Register Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLoginMode && (
              <div>
                <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                  Full Name
                </label>
                <div className="flex items-center bg-[#101114] border border-white/10 rounded-xl px-3 py-2.5 text-xs focus-within:border-[#0a84ff] transition">
                  <User className="w-4 h-4 text-[#a1a1aa] mr-2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g., Priya Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-transparent text-[#f5f5f7] placeholder-[#a1a1aa]/60 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                Email Address
              </label>
              <div className="flex items-center bg-[#101114] border border-white/10 rounded-xl px-3 py-2.5 text-xs focus-within:border-[#0a84ff] transition">
                <Mail className="w-4 h-4 text-[#a1a1aa] mr-2" />
                <input
                  type="email"
                  required
                  placeholder="user@safecircle.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-[#f5f5f7] placeholder-[#a1a1aa]/60 focus:outline-hidden"
                />
              </div>
            </div>

            {!isLoginMode && (
              <div>
                <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                  Mobile Phone (for SOS alerts)
                </label>
                <div className="flex items-center bg-[#101114] border border-white/10 rounded-xl px-3 py-2.5 text-xs focus-within:border-[#0a84ff] transition">
                  <Phone className="w-4 h-4 text-[#a1a1aa] mr-2" />
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-transparent text-[#f5f5f7] placeholder-[#a1a1aa]/60 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                Password
              </label>
              <div className="flex items-center bg-[#101114] border border-white/10 rounded-xl px-3 py-2.5 text-xs focus-within:border-[#0a84ff] transition">
                <Lock className="w-4 h-4 text-[#a1a1aa] mr-2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-[#f5f5f7] placeholder-[#a1a1aa]/60 focus:outline-hidden"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#0a84ff] hover:bg-[#0077ed] text-white font-semibold rounded-full text-xs transition shadow-lg shadow-[#0a84ff]/20 flex items-center justify-center space-x-1 active:scale-98"
            >
              <span>{loading ? 'Authenticating...' : isLoginMode ? 'Sign In' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Toggle Login / Register */}
          <div className="text-center pt-2 border-t border-white/10 text-xs text-[#a1a1aa]">
            {isLoginMode ? (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsLoginMode(false)}
                  className="text-[#64b5ff] font-semibold hover:underline"
                >
                  Create one now
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsLoginMode(true)}
                  className="text-[#64b5ff] font-semibold hover:underline"
                >
                  Sign in
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
