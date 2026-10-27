import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  GraduationCap,
  Lock,
  Mail,
  User,
  ArrowRight,
  AlertCircle,
  Loader2,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { apiClient } from '../../../shared/api/client';

export function StudentRegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiClient.post('/auth/register', { name, email, password });
      if (res.data.success && res.data.token) {
        loginWithToken(res.data.token, res.data.user, 'student');
        navigate('/student', { replace: true });
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B] p-4 font-sans text-[#F4F4F5]">
      <div className="w-full max-w-md">
        {/* Back Link */}
        <div className="mb-4">
          <Link
            to="/login?portal=student"
            className="inline-flex items-center gap-1.5 text-xs text-[#71717A] hover:text-violet-400 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Login</span>
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#151618] border border-[#232427] shadow-xl mb-3">
            <GraduationCap className="w-8 h-8 text-violet-400" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-white">Create Account</h1>
            <span className="px-2 py-0.5 text-[11px] font-bold bg-violet-500/10 text-violet-400 rounded border border-violet-500/30">
              STUDENT
            </span>
          </div>
          <p className="text-xs text-[#71717A] font-medium">
            Register to file and track grievances with AICTE
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0F1011] rounded-2xl border border-[#232427] shadow-2xl p-6 sm:p-7">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#71717A] absolute left-3 top-3" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-[#151618] border border-[#232427] rounded-lg text-sm text-[#F4F4F5] placeholder-[#52525B] focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#71717A] absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@university.ac.in"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-[#151618] border border-[#232427] rounded-lg text-sm text-[#F4F4F5] placeholder-[#52525B] focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#71717A] absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-[#151618] border border-[#232427] rounded-lg text-sm text-[#F4F4F5] placeholder-[#52525B] focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#71717A] absolute left-3 top-3" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-[#151618] border border-[#232427] rounded-lg text-sm text-[#F4F4F5] placeholder-[#52525B] focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-2.5 px-4 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Create Account & Start Filing</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-[#1F2023] text-center">
            <p className="text-xs text-[#71717A]">
              Already have an account?{' '}
              <Link to="/login?portal=student" className="text-violet-400 hover:text-violet-300 font-semibold transition">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-4 text-center text-[11px] text-[#52525B]">
          AICTE Student Grievance Portal · Secure Registration
        </div>
      </div>
    </div>
  );
}

export default StudentRegisterPage;
