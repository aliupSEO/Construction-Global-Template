import React, { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db, APP_ID } from '../lib/firebase';
import { Lock, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

export function ForcePasswordResetModal() {
  const { employeeId, userCollection } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    if (!auth.currentUser || !employeeId) {
      setError('Benutzersitzung ungültig.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Update Firebase Auth Password
      await updatePassword(auth.currentUser, newPassword);
      
      // 2. Update Firestore Doc to remove the plaintext password
      const empRef = doc(db, 'apps', APP_ID, userCollection || 'employees', employeeId);
      await updateDoc(empRef, {
        password: '',
        requiresPasswordChange: false
      });

      toast.success('Passwort erfolgreich geändert.');
      
      // Reload application to clear requiresPasswordChange flag securely
      window.location.reload();
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/requires-recent-login') {
         setError('Zu lange untätig. Bitte loggen Sie sich aus und erneut ein, um das Passwort zu ändern.');
      } else {
         setError('Fehler beim Ändern des Passworts. Bitte versuchen Sie es später erneut.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-brand-primary" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-center text-slate-100 mb-2">
            Passwort ändern erforderlich
          </h2>
          <p className="text-center text-slate-400 text-sm mb-8">
            Sie melden sich zum ersten Mal mit einem vom Administrator erstellten Passwort an. Zu Ihrer eigenen Sicherheit müssen Sie nun ein neues, privates Passwort festlegen.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Neues Passwort</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-shadow"
                placeholder="Mindestens 6 Zeichen"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Passwort bestätigen</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-shadow"
                placeholder="Passwort wiederholen"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary focus:ring-offset-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Passwort sicher speichern'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
