import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface Props {
    children: React.ReactNode;
    title: string;
}

export const DashboardShell: React.FC<Props> = ({ children, title }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    return (
        <div className="min-h-screen bg-brand-surface print:bg-white flex flex-col lg:flex-row">
            <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <div className="lg:pl-64 flex flex-col flex-1 min-h-screen print:pl-0 w-full">
                {/* MOBILE HEADER */}
                <div className="lg:hidden h-16 bg-brand-dark border-b border-gray-800 flex items-center justify-between px-4 sticky top-0 z-30 print:hidden shadow-sm">
                    <img src="/logo.jpeg" alt="Construction Global Template Logo" className="h-8 w-auto rounded" />
                    <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-400 hover:text-white p-2">
                        <Menu className="w-6 h-6" />
                    </button>
                </div>

                {/* DESKTOP HEADER */}
                <header className="hidden lg:flex h-16 bg-brand-dark border-b border-gray-800 items-center justify-between px-8 sticky top-0 z-30 print:hidden shadow-sm">
                    <h2 className="text-white font-heading text-lg">{title}</h2>

                    <div className="flex items-center space-x-6">
                        {/* User Profile */}
                        <div className="relative">
                            <button 
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold ring-2 ring-transparent hover:ring-indigo-500/50 transition-all cursor-pointer"
                            >
                                {currentUser?.email ? currentUser.email.substring(0, 2).toUpperCase() : 'SB'}
                            </button>

                            {isProfileOpen && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsProfileOpen(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-48 bg-brand-surface border border-gray-800 rounded-md shadow-lg py-1 z-50">
                                        <button
                                            onClick={() => {
                                                setIsProfileOpen(false);
                                                navigate('/konto');
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-brand-dark hover:text-white"
                                        >
                                            Mein Konto
                                        </button>
                                        <button
                                            onClick={async () => {
                                                setIsProfileOpen(false);
                                                if (import.meta.env.DEV) {
                                                    alert("Lokal im Dev-Modus ausgeloggt (Mock)");
                                                } else {
                                                    await signOut(auth);
                                                }
                                                navigate('/login');
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-brand-dark hover:text-red-300"
                                        >
                                            Abmelden
                                        </button>
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
        </div>
    );
};
