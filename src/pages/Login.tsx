import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Lock, Mail, Loader2, AlertCircle, HardHat, Eye, EyeOff, LogIn, ArrowLeft, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { logger } from '../lib/logger';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const { executeRecaptcha } = useGoogleReCaptcha();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // reCAPTCHA v3 verification — only if a real site key is configured
      const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';
      const hasRealKey = siteKey && !siteKey.startsWith('6Le_your');

      if (hasRealKey && executeRecaptcha) {
        const token = await executeRecaptcha('login');
        const captchaRes = await fetch('/api/verifyCaptcha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!captchaRes.ok) {
          const data = await captchaRes.json();
          throw new Error(data.error || 'reCAPTCHA-Überprüfung fehlgeschlagen. Bitte versuchen Sie es erneut.');
        }
      }

      const defaultDomain = import.meta.env.VITE_DEFAULT_EMAIL_DOMAIN || 'satler-digital.com';
      const actualEmail = email.includes('@') ? email : `${email}@${defaultDomain}`;
      await signInWithEmailAndPassword(auth, actualEmail, password);
      toast.success('Anmeldung erfolgreich');
      navigate('/');
    } catch (err: any) {
      logger.error('Login error:', err);
      setError(err.message || 'Anmeldung fehlgeschlagen. Bitte überprüfen Sie E-Mail und Passwort.');
      toast.error('Anmeldung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!email) {
        throw new Error('Bitte geben Sie Ihre E-Mail-Adresse ein.');
      }
      const defaultDomain = import.meta.env.VITE_DEFAULT_EMAIL_DOMAIN || 'satler-digital.com';
      const actualEmail = email.includes('@') ? email : `${email}@${defaultDomain}`;
      await sendPasswordResetEmail(auth, actualEmail);
      setResetSent(true);
      toast.success('Link zum Zurücksetzen gesendet!');
    } catch (err: any) {
      logger.error('Reset error:', err);
      setError(err.message || 'Fehler beim Senden der E-Mail.');
      toast.error('Fehler beim Senden');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-brand-dark flex">
      {/* Left Column - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-brand-dark">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-dark/90 via-brand-dark/50 to-transparent z-10" />
        <img 
          src="/login-bg.png" 
          alt="Premium Construction Site" 
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-80"
        />
        <div className="relative z-20 flex flex-col justify-center p-12 lg:p-16 xl:p-24 h-full">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-primary/20 backdrop-blur-md border border-brand-primary/30 mb-8 shadow-2xl">
            <HardHat className="w-8 h-8 text-brand-primary" />
          </div>
          <h1 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight tracking-tight">
            Gestalten Sie die <br/><span className="text-brand-primary">Zukunft des Bauens.</span>
          </h1>
          <p className="text-lg text-slate-300 max-w-lg leading-relaxed font-light">
            Das Construction Global Template bietet Ihnen die modernsten Werkzeuge zur Verwaltung Ihrer Baustellen, Mitarbeiter und Berichte – auf Premium-Niveau.
          </p>
        </div>
      </div>

      {/* Right Column - Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 xl:p-24 bg-brand-surface relative shadow-2xl z-20 lg:rounded-l-3xl lg:-ml-6 min-h-screen lg:min-h-0 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center shadow-inner">
              <HardHat className="w-8 h-8 text-brand-primary" />
            </div>
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2 tracking-tight text-center lg:text-left">
            {resetMode ? 'Passwort zurücksetzen' : 'Willkommen zurück'}
          </h2>
          <p className="text-slate-500 mb-8 sm:mb-10 text-sm sm:text-base text-center lg:text-left">
            {resetMode 
              ? 'Geben Sie Ihre E-Mail-Adresse ein, um einen Link zum Zurücksetzen Ihres Passworts zu erhalten.' 
              : 'Bitte loggen Sie sich in Ihr Baumanagement-Konto ein.'}
          </p>

          {!resetMode ? (
            <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 shadow-sm">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Benutzername oder E-Mail</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary transition-all shadow-sm text-base"
                  placeholder="name@firma.at"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Passwort</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-12 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary transition-all shadow-sm text-base"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="flex justify-end pt-2">
                <button 
                  type="button" 
                  onClick={() => setResetMode(true)}
                  className="text-sm font-semibold text-brand-primary hover:text-brand-primary/80 transition-colors"
                >
                  Passwort vergessen?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-brand-primary/30 text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-4 focus:ring-brand-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-8 hover:-translate-y-0.5"
            >
              <Loader2 className={`w-5 h-5 animate-spin mr-2 ${loading ? '' : 'hidden'}`} />
              <LogIn className={`w-5 h-5 mr-2 ${loading ? 'hidden' : ''}`} />
              <span>{loading ? 'Wird angemeldet...' : 'Login'}</span>
            </button>
          </form>
          ) : resetSent ? (
            <div className="space-y-6">
              <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-emerald-900 mb-2">E-Mail gesendet!</h3>
                <p className="text-sm text-emerald-700">
                  Wir haben einen Link zum Zurücksetzen Ihres Passworts an <strong>{email}</strong> gesendet. Bitte überprüfen Sie Ihren Posteingang (und den Spam-Ordner).
                </p>
              </div>
              <button
                onClick={() => {
                  setResetMode(false);
                  setResetSent(false);
                }}
                className="w-full flex justify-center items-center py-4 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 transition-all"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück zum Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 shadow-sm">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">E-Mail Adresse</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary transition-all shadow-sm text-base"
                    placeholder="name@firma.at"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setResetMode(false)}
                  disabled={loading}
                  className="flex-1 py-4 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-brand-primary/30 text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 transition-all disabled:opacity-50"
                >
                  <Loader2 className={`w-5 h-5 animate-spin ${loading ? '' : 'hidden'}`} />
                  <Send className={`w-4 h-4 mr-2 ${loading ? 'hidden' : ''}`} />
                  <span className={loading ? 'hidden' : ''}>Senden</span>
                </button>
              </div>
            </form>
          )}
          
          <div className="mt-12 text-center">
            <p className="text-sm text-slate-500 font-medium">
              Bei Login-Problemen kontaktieren Sie bitte <a href="mailto:info@up-seo.at" className="text-brand-primary hover:underline">info@up-seo.at</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
