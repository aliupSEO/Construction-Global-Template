import React, { useState } from 'react';
import { LayoutDashboard, FileText, Settings, Circle, Users, UserCircle, CalendarDays, X, ChevronDown, ChevronUp, MapPin, PlusCircle, LayoutList, Download, Clock, CheckCircle, XCircle } from 'lucide-react';
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


const reportsNavigation = [
    { name: 'Übersicht', href: '/reports', icon: LayoutList },
    { name: 'Tagesbericht', href: '/daily-reports/new', icon: PlusCircle },
    { name: 'Wochenbericht', href: '/weekly-reports/new', icon: PlusCircle },
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

    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

    const filteredSettingsNavigation = settingsNavigation.filter(item => {
        if (userRole === 'admin') return true;
        if (item.name === 'Mitarbeiter' && userRole === 'vorarbeiter') return true;
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
        <>
        <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-gradient-to-b from-brand-dark to-black flex flex-col border-r border-white/5 shadow-2xl print:hidden transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            {/* TOP AREA */}
            <div className="p-6 relative">
                <div className="absolute inset-0 bg-brand-primary/5 blur-3xl rounded-full" />
                <div className="relative flex items-center justify-between z-10">
                    <div className="flex flex-col">
                        <img src="/logo.jpeg" alt="Logo" className="h-10 w-auto rounded-lg shadow-lg border border-white/10" />
                        <span className="text-[10px] uppercase tracking-widest text-brand-primary font-bold mt-3 ml-1">Construction</span>
                    </div>
                    <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* MIDDLE AREA */}
            <nav className="flex-1 px-4 space-y-2 mt-2 overflow-y-auto custom-scrollbar">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-3 pb-2">Hauptmenü</div>
                {mainNavigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            onClick={onClose}
                            className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 font-bold'
                                : 'text-gray-400 hover:text-white hover:bg-white/5 font-medium'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                            <div className="flex-1 flex justify-between items-center">
                                <span>{item.name}</span>
                            </div>
                        </Link>
                    );
                })}

                <div className="mt-8 mb-2">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-3 pb-2">Verwaltung</div>
                    
                        <div className="space-y-1">
                            <Link
                                to="/urlaubsantraege"
                                onClick={onClose}
                                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${location.pathname === '/urlaubsantraege'
                                    ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 font-bold'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5 font-medium'
                                    }`}
                            >
                                <CalendarDays className={`w-5 h-5 ${location.pathname === '/urlaubsantraege' ? 'text-white' : 'text-gray-400'}`} />
                                <div className="flex-1 flex justify-between items-center">
                                    <span>Urlaubsanträge</span>
                                    {userRole === 'admin' && pendingLeaveCount > 0 && (
                                        <span className="bg-brand-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md shadow-brand-primary/30">
                                            {pendingLeaveCount}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        </div>

                    <div className="pt-1">
                        <button
                            onClick={() => setIsReportsOpen(!isReportsOpen)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 font-medium ${isReportsOpen ? 'bg-white/5 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <div className="flex items-center space-x-3">
                                <FileText className={`w-5 h-5 ${isReportsOpen ? 'text-brand-primary' : 'text-gray-400'}`} />
                                <span>Berichte</span>
                            </div>
                            {isReportsOpen ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
                        </button>

                        {isReportsOpen && (
                            <div className="mt-1 space-y-1 pl-4 relative before:absolute before:left-6 before:top-0 before:bottom-2 before:w-px before:bg-white/10">
                                {reportsNavigation.map((item) => {
                                    const isActive = location.pathname === item.href;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.href}
                                            onClick={onClose}
                                            className={`flex items-center space-x-3 pl-6 pr-4 py-2.5 rounded-xl transition-all text-sm relative ${isActive
                                                ? 'text-white font-semibold bg-white/5'
                                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                }`}
                                        >
                                            {isActive && <div className="absolute left-[-17px] top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-primary rounded-r-full" />}
                                            <item.icon className={`w-4 h-4 ${isActive ? 'text-brand-primary' : 'opacity-70'}`} />
                                            <span>{item.name}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="pt-1">
                        <button
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 font-medium ${isSettingsOpen ? 'bg-white/5 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <div className="flex items-center space-x-3">
                                <Settings className={`w-5 h-5 ${isSettingsOpen ? 'text-brand-primary' : 'text-gray-400'}`} />
                                <span>Einstellungen</span>
                            </div>
                            {isSettingsOpen ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
                        </button>

                        {isSettingsOpen && (
                            <div className="mt-1 space-y-1 pl-4 relative before:absolute before:left-6 before:top-0 before:bottom-2 before:w-px before:bg-white/10">
                                {filteredSettingsNavigation.map((item) => {
                                    const isActive = location.pathname === item.href;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.href}
                                            onClick={onClose}
                                            className={`flex items-center space-x-3 pl-6 pr-4 py-2.5 rounded-xl transition-all text-sm relative ${isActive
                                                ? 'text-white font-semibold bg-white/5'
                                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                }`}
                                        >
                                            {isActive && <div className="absolute left-[-17px] top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-primary rounded-r-full" />}
                                            <item.icon className={`w-4 h-4 ${isActive ? 'text-brand-primary' : 'opacity-70'}`} />
                                            <span>{item.name}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* BOTTOM AREA */}
            <div className="p-6 mt-auto bg-gradient-to-t from-[#050505] to-transparent relative z-10">
                <button
                    onClick={() => setIsDownloadModalOpen(true)}
                    className="w-full flex items-center justify-center px-4 py-3.5 mb-6 rounded-xl transition-all border border-brand-primary/50 shadow-lg shadow-brand-primary/20 text-sm font-bold text-brand-primary bg-brand-primary/10 hover:bg-brand-primary hover:text-white group"
                >
                    <Download className="w-5 h-5 mr-2 group-hover:-translate-y-0.5 transition-transform" />
                    <span className="font-medium">App Download</span>
                </button>

                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                        <div className="relative flex items-center justify-center w-2 h-2">
                            {isOnline ? (
                                <>
                                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-40 animate-ping"></span>
                                    <Circle className="relative w-2 h-2 fill-emerald-500 text-emerald-500" />
                                </>
                            ) : (
                                <Circle className="relative w-2 h-2 fill-gray-500 text-gray-500" />
                            )}
                        </div>
                        <span className={`text-[10px] uppercase tracking-widest font-bold ${isOnline ? 'text-gray-300' : 'text-gray-600'}`}>
                            {isOnline ? 'Online' : 'Offline'}
                        </span>
                    </div>
                    <span className="text-[10px] text-gray-600 font-medium tracking-wide">v2.0 Premium</span>
                </div>
            </div>
        </aside>
        
        <DownloadAppModal 
            isOpen={isDownloadModalOpen} 
            onClose={() => setIsDownloadModalOpen(false)} 
        />
        </>
    );
};
