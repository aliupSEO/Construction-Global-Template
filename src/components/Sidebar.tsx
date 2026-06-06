import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, FileText, Settings, Circle, Users, CalendarDays, X, MapPin, Download, HardHat } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTaskSync } from '../hooks/useTaskSync';
import { useAuth } from '../contexts/AuthContext';
import { DownloadAppModal } from './DownloadAppModal';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, APP_ID } from '../lib/firebase';

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
    const { isOnline } = useTaskSync();
    const { userRole } = useAuth();
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [pendingLeaveCount, setPendingLeaveCount] = useState(0);

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
                <div className="p-4 mt-auto bg-gradient-to-t from-[#050505] to-transparent">
                    <button
                        onClick={() => setIsDownloadModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 mb-4 rounded-xl border border-brand-primary/40 text-sm font-bold text-brand-primary bg-brand-primary/10 hover:bg-brand-primary hover:text-white transition-all group"
                    >
                        <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                        App Download
                    </button>

                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                            <span className={`relative flex w-2 h-2`}>
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
        </>
    );
};
