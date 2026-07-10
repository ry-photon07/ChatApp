'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, ChevronRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useStore } from '@/lib/store';

type Step = 'phone' | 'otp' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, token } = useStore();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState('');
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (token) router.replace('/conversations');
  }, [token, router]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const res = await api.auth.requestOtp(phone.trim());
      setHint(res.hint || '');
      toast.success('OTP sent! Check hint below.');
      setStep('otp');
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpStr = otp.join('');
    if (otpStr.length < 6) return;
    setLoading(true);
    try {
      const res = await api.auth.verifyOtp(phone.trim(), otpStr);
      if (res.requires_registration) {
        setStep('register');
      } else if (res.access_token && res.user) {
        setAuth(res.access_token, res.user);
        toast.success(`Welcome back, ${res.user.display_name}!`);
        router.replace('/conversations');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setLoading(true);
    try {
      const res = await api.auth.register(
        phone.trim(),
        otp.join(''),
        displayName.trim(),
        username.trim() || undefined
      );
      setAuth(res.access_token, res.user);
      toast.success(`Welcome to Signal, ${res.user.display_name}!`);
      router.replace('/conversations');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <MessageSquare size={36} strokeWidth={1.5} />
          </div>
        </div>

        {step === 'phone' && (
          <>
            <h1 className="auth-title">Signal</h1>
            <p className="auth-subtitle">
              Enter your phone number to get started.<br />
              Your number is never shared with anyone.
            </p>
            <form onSubmit={handleRequestOtp}>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  className="form-input"
                  type="tel"
                  placeholder="+1 555 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? <Loader2 size={18} className="spinning" /> : <>Continue <ChevronRight size={18} /></>}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>
              🔒 End-to-end encrypted. Privacy guaranteed.
            </p>
          </>
        )}

        {step === 'otp' && (
          <>
            <h1 className="auth-title">Verify your number</h1>
            <p className="auth-subtitle">
              Enter the 6-digit code sent to<br />
              <strong style={{ color: 'var(--text-primary)' }}>{phone}</strong>
            </p>
            {hint && (
              <div style={{
                background: 'rgba(58,118,240,0.08)',
                border: '1px solid rgba(58,118,240,0.2)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: 13,
                color: 'var(--signal-blue)',
              }}>
                💡 {hint}
              </div>
            )}
            <form onSubmit={handleVerifyOtp}>
              <div className="otp-inputs">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    className="otp-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  />
                ))}
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading || otp.join('').length < 6}>
                {loading ? <Loader2 size={18} /> : 'Verify'}
              </button>
              <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setStep('phone')}>
                Change number
              </button>
            </form>
          </>
        )}

        {step === 'register' && (
          <>
            <h1 className="auth-title">Create your profile</h1>
            <p className="auth-subtitle">
              This is how you'll appear to others on Signal.
            </p>
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Display Name *</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Username (optional)</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="@username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading || !displayName.trim()}>
                {loading ? <Loader2 size={18} /> : 'Create Account'}
              </button>
            </form>
          </>
        )}
      </div>

      <style jsx>{`
        .spinning { animation: spin 700ms linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
