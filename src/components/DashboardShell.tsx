import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu, User, LogOut, ChevronDown, HardHat } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { auth, db, APP_ID } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface Props {
    children: React.ReactNode;
    title: string;
}

export const DashboardShell: React.FC<Props> = ({ children, title }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const navigate = useNavigate();
    const { currentUser, userRole, employeeName } = useAuth();
    const [logoUrl, setLogoUrl] = useState<string | null>(null);

    React.useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'apps', APP_ID, 'metadata', 'company_profile'), (docSnap) => {
            if (docSnap.exists() && docSnap.data().logoBase64) {
                setLogoUrl(docSnap.data().logoBase64);
            } else {
                setLogoUrl(null);
            }
        });
        return () => unsubscribe();
    }, []);
    
    const getInitials = () => {
        if (employeeName) {
            const parts = employeeName.split(' ');
            if (parts.length >= 2) {
                return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
            }
            return employeeName.substring(0, 2).toUpperCase();
        }
        if (currentUser?.displayName) {
            const parts = currentUser.displayName.split(' ');
            if (parts.length >= 2) {
                return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
            }
            return currentUser.displayName.substring(0, 2).toUpperCase();
        }
        if (currentUser?.email) {
            return currentUser.email.substring(0, 2).toUpperCase();
        }
        return 'SB';
    };

    return (
        <div className="min-h-screen bg-brand-surface print:bg-white flex flex-col lg:flex-row">
            <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} logoUrl={logoUrl} />

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <div className="lg:pl-[280px] flex flex-col flex-1 min-h-screen print:pl-0 w-full transition-all duration-300">
                {/* MOBILE HEADER */}
                <div className="lg:hidden h-20 bg-gradient-to-b from-brand-dark to-black border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-30 print:hidden shadow-lg shadow-black/20">
                    <div className="flex items-center">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="h-9 w-auto rounded-lg shadow-md border border-white/10 bg-white" />
                        ) : (
                            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-brand-primary/20 to-brand-primary/5 border border-brand-primary/20 flex items-center justify-center shadow-md">
                                <HardHat className="w-5 h-5 text-brand-primary" />
                            </div>
                        )}
                        <span className="text-xs uppercase tracking-widest text-brand-primary font-bold ml-3 mt-0.5">Construction</span>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-400 hover:text-white p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-transparent hover:border-white/10 shadow-sm">
                        <Menu className="w-6 h-6" />
                    </button>
                </div>

                {/* DESKTOP HEADER */}
                <header className="hidden lg:flex h-20 bg-gradient-to-b from-brand-dark to-black border-b border-white/5 items-center justify-between px-10 sticky top-0 z-30 print:hidden shadow-lg shadow-black/10">
                    <div className="flex items-center space-x-4">
                        <h2 className="text-white font-heading text-xl tracking-wider font-bold drop-shadow-md">{title}</h2>
                        {title === 'Dashboard' && (
                            <span className="bg-brand-primary/10 text-brand-primary text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full font-bold border border-brand-primary/20">
                                Live
                            </span>
                        )}
                    </div>

                    <div className="flex items-center space-x-6">
                        {/* User Profile */}
                        <div className="relative">
                            <button 
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center space-x-3 bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1.5 pr-4 rounded-full transition-all cursor-pointer shadow-md group"
                            >
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-primary to-red-400 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-brand-primary/40 ring-2 ring-transparent group-hover:ring-brand-primary/50 transition-all">
                                    {getInitials()}
                                </div>
                                <div className="hidden md:flex flex-col items-start">
                                    <span className="text-xs font-semibold text-white tracking-wide">{employeeName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}</span>
                                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">{userRole || 'Admin'}</span>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-gray-400 group-hover:text-white transition-transform duration-300 ${isProfileOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isProfileOpen && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsProfileOpen(false)}
                                    />
                                    <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] ring-1 ring-black/5 py-2 z-50 transform opacity-100 scale-100 transition-all origin-top-right overflow-hidden">
                                        <div className="px-5 py-4 border-b border-gray-100 bg-slate-50/50">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                                                Angemeldet als
                                            </p>
                                            <p className="text-sm font-bold text-gray-900 truncate">
                                                {employeeName || currentUser?.displayName || currentUser?.email || 'Benutzer'}
                                            </p>
                                        </div>
                                        <div className="p-2 space-y-1">
                                            <button
                                                onClick={() => {
                                                    setIsProfileOpen(false);
                                                    navigate('/konto');
                                                }}
                                                className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-brand-primary/5 hover:text-brand-primary rounded-xl transition-colors group"
                                            >
                                                <User className="w-4 h-4 mr-3 text-gray-400 group-hover:text-brand-primary transition-colors" />
                                                Mein Konto
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsProfileOpen(false);
                                                    setIsLogoutModalOpen(true);
                                                }}
                                                className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors group"
                                            >
                                                <LogOut className="w-4 h-4 mr-3 text-red-400 group-hover:text-red-600 transition-colors" />
                                                Abmelden
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* MAIN CONTENT */}
                <main className="p-4 md:p-8 flex-1">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>

            {/* LOGOUT CONFIRMATION MODAL */}
            {isLogoutModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div 
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsLogoutModalOpen(false)}
                    />
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden z-10 transform transition-all scale-100 opacity-100 p-6">
                        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <LogOut className="w-6 h-6 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Abmelden?</h3>
                        <p className="text-sm text-center text-gray-500 mb-6">
                            Möchten Sie sich wirklich abmelden?
                        </p>
                        <div className="flex flex-col space-y-2">
                            <button
                                onClick={async () => {
                                    setIsLogoutModalOpen(false);
                                    if (import.meta.env.DEV) {
                                        console.log("Lokal im Dev-Modus ausgeloggt (Mock)");
                                    } else {
                                        await signOut(auth);
                                    }
                                    navigate('/login');
                                }}
                                className="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                            >
                                Ja, Abmelden
                            </button>
                            <button
                                onClick={() => setIsLogoutModalOpen(false)}
                                className="w-full inline-flex justify-center items-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors"
                            >
                                Abbrechen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
