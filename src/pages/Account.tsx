import React, { useEffect, useState } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, APP_ID } from '../lib/firebase';

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    position?: string;
    active?: boolean;
    status?: 'active' | 'archived';
    address?: string;
    phone?: string;
    email?: string;
    authUid?: string;
}
import { User, Phone, Mail, MapPin, Briefcase, Shield } from 'lucide-react';



export const Account: React.FC = () => {
    const { currentUser, userRole } = useAuth();
    const [employeeData, setEmployeeData] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!currentUser) return;
            
            try {
                const q = query(
                    collection(db, 'apps', APP_ID, 'employees'),
                    where('authUid', '==', currentUser.uid)
                );
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    setEmployeeData(snapshot.docs[0].data() as Employee);
                }
            } catch (err) {
                console.error("Error fetching account data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [currentUser]);

    return (
        <DashboardShell title="Mein Konto">
            <div className="bg-brand-surface border border-gray-800 rounded-xl p-6 md:p-8 max-w-3xl shadow-xl">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 border-b border-gray-800 pb-8 mb-8">
                    <div className="w-24 h-24 rounded-full border-2 border-brand-primary/30 bg-brand-dark flex items-center justify-center text-3xl font-bold text-brand-primary">
                        {currentUser?.email ? currentUser.email.substring(0, 2).toUpperCase() : 'ME'}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-2">
                            {employeeData ? `${employeeData.firstName} ${employeeData.lastName}` : (currentUser?.displayName || 'Mein Konto')}
                        </h1>
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-brand-dark border border-gray-700 rounded-full text-sm text-gray-300 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-brand-primary" />
                                {userRole === 'admin' ? 'Administrator' : userRole === 'vorarbeiter' ? 'Vorarbeiter' : 'Mitarbeiter'}
                            </span>
                            {employeeData?.position && (
                                <span className="px-3 py-1 bg-brand-dark border border-gray-700 rounded-full text-sm text-gray-300 flex items-center gap-2">
                                    <Briefcase className="w-4 h-4 text-emerald-400" />
                                    {employeeData.position}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="text-gray-400 animate-pulse">Daten werden geladen...</div>
                ) : employeeData ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-brand-dark rounded-lg p-5">
                            <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Persönliche Daten</h3>
                            
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">Voller Name</p>
                                        <p className="text-sm text-white">{employeeData.firstName} {employeeData.lastName}</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400">
                                        <MapPin className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">Adresse</p>
                                        <p className="text-sm text-white">{employeeData.address || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-brand-dark rounded-lg p-5">
                            <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Kontaktinformationen</h3>
                            
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">E-Mail Adresse</p>
                                        <p className="text-sm text-white">{employeeData.email || currentUser?.email || '-'}</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400">
                                        <Phone className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">Telefonnummer</p>
                                        <p className="text-sm text-white">{employeeData.phone || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-10 bg-brand-dark rounded-xl">
                        <User className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-white mb-2">Keine Mitarbeiterakte gefunden</h3>
                        <p className="text-gray-400 max-w-sm mx-auto">
                            Es konnte keine Mitarbeiterakte für Ihr Profil gefunden werden. Bitte kontaktieren Sie einen Administrator, falls dies ein Fehler ist.
                        </p>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
};
