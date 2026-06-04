import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Lock, Loader2, AlertCircle, HardHat, Eye, EyeOff, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [verifying, setVerifying] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const code = searchParams.get('oobCode');
    const mode = searchParams.get('mode');

    if (!code || mode !== 'resetPassword') {
      setError('Ungültiger oder abgelaufener Link zum Zurücksetzen des Passworts.');
      setVerifying(false);
      return;
    }

    setOobCode(code);

    // Verify the code and get the user's email
    verifyPasswordResetCode(auth, code)
      .then((userEmail) => {
        setEmail(userEmail);
        setVerifying(false);
      })
      .catch((err) => {
        console.error('Error verifying code:', err);
        setError('Dieser Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.');
        setVerifying(false);
      });
  }, [searchParams]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) return;

    if (newPassword !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess(true);
      toast.success('Passwort erfolgreich geändert!');
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError('Fehler beim Ändern des Passworts. Bitte versuchen Sie es erneut.');
      toast.error('Fehler beim Ändern des Passworts');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background styling */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-dark/90 via-brand-dark/50 to-transparent z-10" />
      <img 
        src="/login-bg.png" 
        alt="Background" 
        className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-20"
      />

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl z-20 overflow-hidden relative">
        <div className="p-8 sm:p-12">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center shadow-inner">
              <HardHat className="w-8 h-8 text-brand-primary" />
            </div>
          </div>
          
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2 text-center">
            Neues Passwort festlegen
          </h2>
          
          {verifying ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-brand-primary animate-spin mb-4" />
              <p className="text-slate-500">Link wird verifiziert...</p>
            </div>
          ) : error ? (
            <div className="py-6">
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex flex-col items-center text-center gap-3 shadow-sm mb-6">
                <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full flex justify-center items-center py-3.5 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
              >
                Zurück zum Login
              </button>
            </div>
          ) : success ? (
            <div className="py-6">
              <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col items-center text-center gap-4 shadow-sm mb-6">
                <CheckCircle className="w-12 h-12 text-emerald-500" />
                <div>
                  <h3 className="text-lg font-bold text-emerald-900 mb-1">Passwort geändert!</h3>
                  <p className="text-sm text-emerald-700">Sie können sich nun mit Ihrem neuen Passwort anmelden.</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-brand-primary/30 text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 transition-all"
              >
                Zum Login
              </button>
            </div>
          ) : (
            <>
              <p className="text-slate-500 mb-8 text-sm text-center">
                Erstellen Sie ein neues Passwort für <strong className="text-slate-700">{email}</strong>.
              </p>

              <form onSubmit={handleReset} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Neues Passwort</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="block w-full pl-12 pr-12 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary transition-all shadow-sm text-base"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-brand-primary focus:outline-none transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Passwort bestätigen</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-12 pr-12 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary transition-all shadow-sm text-base"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-brand-primary focus:outline-none transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-brand-primary/30 text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-4 focus:ring-brand-primary/30 transition-all disabled:opacity-50 mt-8"
                >
                  {saving ? <Loader2 key="loader" className="w-5 h-5 animate-spin mr-2" /> : <Lock key="lock" className="w-5 h-5 mr-2" />}
                  <span>Passwort speichern</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
