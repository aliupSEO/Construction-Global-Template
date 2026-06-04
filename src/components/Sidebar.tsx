import React, { useState } from 'react';
import { LayoutDashboard, FileText, Settings, CheckSquare, Circle, Users, UserCircle, Building2, ClipboardList, CalendarDays, X, ChevronDown, ChevronUp, MapPin, PlusCircle, LayoutList, Download, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTaskSync } from '../hooks/useTaskSync';
import { useAuth } from '../contexts/AuthContext';
import { DownloadAppModal } from './DownloadAppModal';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, APP_ID } from '../lib/firebase';

const mainNavigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Baustellen', href: '/sites', icon: MapPin },
];

const leaveNavigation = [
    { name: 'Anfragen', href: '/urlaubsantraege?tab=pending', icon: Clock },
    { name: 'Genehmigt', href: '/urlaubsantraege?tab=approved', icon: CheckCircle },
    { name: 'Abgelehnt & Historie', href: '/urlaubsantraege?tab=rejected', icon: XCircle },
];

const reportsNavigation = [
    { name: 'Übersicht', href: '/reports', icon: LayoutList },
    { name: 'Neuer Tagesbericht', href: '/daily-reports/new', icon: PlusCircle },
    { name: 'Neuer Wochenbericht', href: '/weekly-reports/new', icon: PlusCircle },
];

const settingsNavigation = [
    { name: 'Mitarbeiter', href: '/employees', icon: Users },
    { name: 'Bauleiter', href: '/managers', icon: UserCircle },
    { name: 'Firmendaten', href: '/settings', icon: Settings },
];

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
    const location = useLocation();
    const { isOnline } = useTaskSync();
    const { userRole } = useAuth();
    const [isReportsOpen, setIsReportsOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isLeaveOpen, setIsLeaveOpen] = useState(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

    const filteredSettingsNavigation = settingsNavigation.filter(item => {
        if (userRole === 'admin') return true;
        // Für alle Nicht-Admins (Vorarbeiter, Mitarbeiter) nur Mitarbeiter anzeigen (falls berechtigt)
        if (item.name === 'Mitarbeiter' && userRole === 'vorarbeiter') return true;
        // Mitarbeiter dürfen ggf. gar keine Stammdaten verwalten, dann einfach return false;
        // aber laut Vorgabe gibt es hierfür in Listen den readonly modus bzw. Archivieren weg,
        // also lasse ich es für Vorarbeiter zu, und für Mitarbeiter theoretisch auch.
        if (item.name === 'Mitarbeiter') return true;
        
        return false;
    });

    const [pendingLeaveCount, setPendingLeaveCount] = useState(0);

    React.useEffect(() => {
        if (userRole === 'admin') {
            const q = query(
                collection(db, 'apps', APP_ID, 'leave_requests'),
                where('status', 'in', ['pending', 'needs_info'])
            );
            const unsubscribe = onSnapshot(q, (snapshot) => {
                setPendingLeaveCount(snapshot.size);
            });
            return () => unsubscribe();
        }
    }, [userRole]);

    return (
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-brand-dark flex flex-col border-r border-gray-800 print:hidden transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            {/* TOP AREA */}
            <div className="p-6">
                <div className="flex items-center justify-between">
                    <img src="/logo.jpeg" alt="Construction Global Template Logo" className="h-12 w-auto" />
                    <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-white p-1">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <p className="text-gray-400 text-xs mt-3">Bauberichte v1</p>
                <div className="mt-4 border-b border-gray-800" />
            </div>

            {/* MIDDLE AREA */}
            <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
                {mainNavigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            onClick={onClose}
                            className={`flex items-center space-x-3 px-3 py-3 rounded-lg transition-all ${isActive
                                ? 'bg-brand-primary text-white shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${isActive ? 'opacity-100' : 'opacity-70'}`} />
                            <div className="flex-1 flex justify-between items-center">
                                <span className="font-medium">{item.name}</span>
                            </div>
                        </Link>
                    );
                })}

                {userRole === 'admin' ? (
                    <div className="pt-2">
                        <button
                            onClick={() => setIsLeaveOpen(!isLeaveOpen)}
                            className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-all text-gray-400 hover:text-white hover:bg-white/5`}
                        >
                            <div className="flex items-center space-x-3">
                                <CalendarDays className="w-5 h-5 opacity-70" />
                                <span className="font-medium">Urlaubsanträge</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                {pendingLeaveCount > 0 && (
                                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        {pendingLeaveCount}
                                    </span>
                                )}
                                {isLeaveOpen ? <ChevronUp className="w-4 h-4 opacity-70" /> : <ChevronDown className="w-4 h-4 opacity-70" />}
                            </div>
                        </button>

                        {isLeaveOpen && (
                            <div className="mt-1 space-y-1">
                                {leaveNavigation.map((item) => {
                                    const urlObj = new URL(item.href, 'http://dummy.com');
                                    const targetTab = urlObj.searchParams.get('tab');
                                    const currentTab = new URLSearchParams(location.search).get('tab') || 'pending';
                                    
                                    const isActive = location.pathname === '/urlaubsantraege' && currentTab === targetTab;
                                    
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.href}
                                            onClick={onClose}
                                            className={`flex items-center space-x-3 pl-11 pr-3 py-2.5 rounded-lg transition-all text-sm ${isActive
                                                ? 'bg-brand-primary/20 text-brand-primary font-semibold'
                                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                }`}
                                        >
                                            <item.icon className={`w-4 h-4 ${isActive ? 'opacity-100' : 'opacity-70'}`} />
                                            <div className="flex-1 flex items-center justify-between">
                                                <span>{item.name}</span>
                                                {item.name === 'Anfragen' && pendingLeaveCount > 0 && (
                                                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                        {pendingLeaveCount}
                                                    </span>
                                                )}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="pt-2">
                        <Link
                            to="/urlaubsantraege"
                            onClick={onClose}
                            className={`flex items-center space-x-3 px-3 py-3 rounded-lg transition-all ${location.pathname === '/urlaubsantraege'
                                ? 'bg-brand-primary text-white shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <CalendarDays className={`w-5 h-5 ${location.pathname === '/urlaubsantraege' ? 'opacity-100' : 'opacity-70'}`} />
                            <div className="flex-1 flex justify-between items-center">
                                <span className="font-medium">Urlaubsanträge</span>
                            </div>
                        </Link>
                    </div>
                )}

                <div className="pt-2">
                    <button
                        onClick={() => setIsReportsOpen(!isReportsOpen)}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-all text-gray-400 hover:text-white hover:bg-white/5`}
                    >
                        <div className="flex items-center space-x-3">
                            <FileText className="w-5 h-5 opacity-70" />
                            <span className="font-medium">Berichte</span>
                        </div>
                        {isReportsOpen ? <ChevronUp className="w-4 h-4 opacity-70" /> : <ChevronDown className="w-4 h-4 opacity-70" />}
                    </button>

                    {isReportsOpen && (
                        <div className="mt-1 space-y-1">
                            {reportsNavigation.map((item) => {
                                const isActive = location.pathname === item.href;
                                return (
                                    <Link
                                        key={item.name}
                                        to={item.href}
                                        onClick={onClose}
                                        className={`flex items-center space-x-3 pl-11 pr-3 py-2.5 rounded-lg transition-all text-sm ${isActive
                                            ? 'bg-brand-primary/20 text-brand-primary font-semibold'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        <item.icon className={`w-4 h-4 ${isActive ? 'opacity-100' : 'opacity-70'}`} />
                                        <span>{item.name}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="pt-2">
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-all text-gray-400 hover:text-white hover:bg-white/5`}
                    >
                        <div className="flex items-center space-x-3">
                            <Settings className="w-5 h-5 opacity-70" />
                            <span className="font-medium">Einstellungen</span>
                        </div>
                        {isSettingsOpen ? <ChevronUp className="w-4 h-4 opacity-70" /> : <ChevronDown className="w-4 h-4 opacity-70" />}
                    </button>

                    {isSettingsOpen && (
                        <div className="mt-1 space-y-1">
                            {filteredSettingsNavigation.map((item) => {
                                const isActive = location.pathname === item.href;
                                return (
                                    <Link
                                        key={item.name}
                                        to={item.href}
                                        onClick={onClose}
                                        className={`flex items-center space-x-3 pl-11 pr-3 py-2.5 rounded-lg transition-all text-sm ${isActive
                                            ? 'bg-brand-primary/20 text-brand-primary font-semibold'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        <item.icon className={`w-4 h-4 ${isActive ? 'opacity-100' : 'opacity-70'}`} />
                                        <span>{item.name}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="pt-2">
                    <button
                        onClick={() => setIsDownloadModalOpen(true)}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-all text-gray-400 hover:text-white hover:bg-white/5`}
                    >
                        <div className="flex items-center space-x-3">
                            <Download className="w-5 h-5 opacity-70" />
                            <span className="font-medium">App Download</span>
                        </div>
                    </button>
                </div>
            </nav>

            {/* BOTTOM AREA */}
            <div className="p-4 mt-auto">
                <div className="border-t border-gray-800 pt-4 flex items-center space-x-3 px-2">
                    <div className="relative flex items-center justify-center w-3 h-3">
                        {isOnline ? (
                            <>
                                <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-20 animate-ping"></span>
                                <Circle className="relative w-2 h-2 fill-green-500 text-green-500" />
                            </>
                        ) : (
                            <Circle className="relative w-2 h-2 fill-gray-500 text-gray-500" />
                        )}
                    </div>
                    <span className={`text-[10px] uppercase tracking-widest font-bold ${isOnline ? 'text-gray-400' : 'text-gray-600'}`}>
                        {isOnline ? 'System Online' : 'Sync Ausstehend'}
                    </span>
                </div>
            </div>
            <DownloadAppModal 
                isOpen={isDownloadModalOpen} 
                onClose={() => setIsDownloadModalOpen(false)} 
            />
        </aside>
    );
};
