import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, FileText, Settings, Users, CalendarDays, X, MapPin, Download, HardHat, User, LogOut } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTaskSync } from '../hooks/useTaskSync';
import { useAuth } from '../contexts/AuthContext';
import { DownloadAppModal } from './DownloadAppModal';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, APP_ID } from '../lib/firebase';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
    logoUrl?: string | null;
}

const NavLink = ({ to, icon: Icon, label, active, badge, onClick }: {
    to: string; icon: any; label: string; active: boolean; badge?: number; onClick?: () => void;
}) => (
    <Link
        to={to}
        onClick={onClick}
        className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-sm font-medium select-none
            ${active
                ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 font-bold'
                : 'text-gray-400 hover:text-white hover:bg-white/8 active:bg-white/12'
            }`}
    >
        <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-white' : 'text-gray-500'}`} />
        <span className="flex-1 leading-none">{label}</span>
        {badge !== undefined && badge > 0 && (
            <span className="bg-brand-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md shadow-brand-primary/30 min-w-[20px] text-center">
                {badge}
            </span>
        )}
    </Link>
);

export const Sidebar = ({ isOpen, onClose, logoUrl }: SidebarProps) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isOnline } = useTaskSync();
    const { userRole, employeeName, currentUser } = useAuth();
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    // Swipe to close
    const touchStartX = useRef<number | null>(null);
    const sidebarRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (userRole === 'admin') {
            const q = query(collection(db, 'apps', APP_ID, 'leave_requests'), where('status', 'in', ['pending', 'needs_info']));
            const unsub = onSnapshot(q, snap => setPendingLeaveCount(snap.size));
            return () => unsub();
        }
    }, [userRole]);

    // Lock body scroll on mobile when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX.current === null) return;
        const dx = touchStartX.current - e.changedTouches[0].clientX;
        if (dx > 60) onClose?.(); // swipe left to close
        touchStartX.current = null;
    };

    const isReports = location.pathname.includes('/reports') || location.pathname.includes('/daily-reports') || location.pathname.includes('/weekly-reports');

    return (
        <>
            {/* Sidebar drawer */}
            <aside
                ref={sidebarRef}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className={`
                    fixed inset-y-0 left-0 z-50 w-[280px]
                    bg-gradient-to-b from-brand-dark to-[#050505]
                    flex flex-col border-r border-white/5 shadow-2xl print:hidden
                    will-change-transform
                    transition-transform duration-300 ease-spring
                    lg:translate-x-0
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                {/* Logo area */}
                <div className="relative flex items-center justify-between px-5 pt-6 pb-4">
                    <div className="flex items-center gap-3">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="h-10 w-auto max-w-[120px] object-contain rounded-xl shadow-lg border border-white/10 bg-white p-1" />
                        ) : (
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-primary/20 to-brand-primary/5 border border-brand-primary/20 flex items-center justify-center shadow-lg shrink-0">
                                <HardHat className="w-5 h-5 text-brand-primary" />
                            </div>
                        )}
                        <span className="text-[11px] uppercase tracking-widest text-brand-primary font-bold">Construction</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="lg:hidden w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10"
                        aria-label="Close menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mx-4 h-px bg-white/5 mb-2" />

                {/* Navigation */}
                <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-4 py-2">Hauptmenü</p>
                    <NavLink to="/" icon={LayoutDashboard} label="Dashboard" active={location.pathname === '/'} onClick={onClose} />
                    <NavLink to="/sites" icon={MapPin} label="Baustellen" active={location.pathname.startsWith('/sites')} onClick={onClose} />

                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-4 pt-5 pb-2">Verwaltung</p>
                    <NavLink to="/urlaubsantraege" icon={CalendarDays} label="Urlaubsanträge" active={location.pathname === '/urlaubsantraege'} badge={pendingLeaveCount} onClick={onClose} />
                    <NavLink to="/reports" icon={FileText} label="Berichte" active={isReports} onClick={onClose} />
                    {(userRole === 'admin' || userRole === 'vorarbeiter') && (
                        <NavLink to="/employees" icon={Users} label="Mitarbeiter" active={location.pathname === '/employees'} onClick={onClose} />
                    )}

                    {userRole === 'admin' && (
                        <>
                            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-4 pt-5 pb-2">System</p>
                            <NavLink to="/settings" icon={Settings} label="Einstellungen" active={location.pathname.startsWith('/settings')} onClick={onClose} />
                        </>
                    )}
                </nav>

                {/* Bottom area */}
                <div className="p-4 mt-auto bg-gradient-to-t from-[#050505] to-transparent space-y-3">

                    {/* User profile card */}
                    <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white/5 border border-white/10">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-primary to-red-400 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
                            {currentUser?.photoURL
                                ? <img src={currentUser.photoURL} alt="avatar" className="w-full h-full object-cover" />
                                : (employeeName?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || currentUser?.email?.slice(0,2).toUpperCase() || 'SB')
                            }
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{employeeName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Benutzer'}</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{userRole || 'Mitarbeiter'}</p>
                        </div>
                    </div>

                    {/* Account + Logout */}
                    <Link
                        to="/konto"
                        onClick={onClose}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <User className="w-4 h-4 shrink-0" />
                        Mein Konto
                    </Link>

                    <button
                        onClick={() => setShowLogoutConfirm(true)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-white hover:bg-red-500/20 transition-colors"
                    >
                        <LogOut className="w-4 h-4 shrink-0" />
                        Abmelden
                    </button>

                    <div className="h-px bg-white/5 my-1" />

                    <button
                        onClick={() => setIsDownloadModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-brand-primary/40 text-sm font-bold text-brand-primary bg-brand-primary/10 hover:bg-brand-primary hover:text-white transition-all group"
                    >
                        <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                        App Download
                    </button>

                    <div className="flex items-center justify-between px-1 pt-1">
                        <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                            <span className="relative flex w-2 h-2">
                                {isOnline && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-40 animate-ping" />}
                                <span className={`relative inline-flex rounded-full w-2 h-2 ${isOnline ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                            </span>
                            <span className={`text-[10px] uppercase tracking-widest font-bold ${isOnline ? 'text-gray-300' : 'text-gray-600'}`}>
                                {isOnline ? 'Online' : 'Offline'}
                            </span>
                        </div>
                        <span className="text-[10px] text-gray-600 font-medium">v2.0 Premium</span>
                    </div>
                </div>
            </aside>

            <DownloadAppModal isOpen={isDownloadModalOpen} onClose={() => setIsDownloadModalOpen(false)} />

            {/* Logout confirmation modal */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
                        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <LogOut className="w-6 h-6 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Abmelden?</h3>
                        <p className="text-sm text-center text-gray-500 mb-6">Möchten Sie sich wirklich abmelden?</p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={async () => {
                                    setShowLogoutConfirm(false);
                                    onClose?.();
                                    await signOut(auth);
                                    navigate('/login');
                                }}
                                className="w-full flex justify-center items-center px-4 py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
                            >
                                Ja, Abmelden
                            </button>
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="w-full flex justify-center items-center px-4 py-3 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                Abbrechen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
