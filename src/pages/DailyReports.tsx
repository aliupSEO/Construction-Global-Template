import React, { useState, useEffect } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { db, APP_ID } from '../lib/firebase';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Plus, Edit2, Trash2, FileText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface DailyReport {
    id: string;
    reportNumber: string;
    date: string;
    weather?: string;
    calendarWeek?: string | number;
    constructionSite: string;
    managerId: string;
    clientId: string;
    usedMaterials?: string;
    usedEquipment?: string;
    createdAt?: any;
}

export const DailyReports = () => {
    const [reports, setReports] = useState<DailyReport[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { userRole } = useAuth();

    useEffect(() => {
        const q = collection(db, 'apps', APP_ID, 'daily_reports');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as DailyReport[];

            // Sort by date descending
            data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setReports(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleDelete = async (id: string) => {
        if (window.confirm('Möchten Sie diesen Tagesbericht wirklich löschen?')) {
            try {
                await deleteDoc(doc(db, 'apps', APP_ID, 'daily_reports', id));
            } catch (error) {
                console.error('Error deleting report:', error);
                alert('Fehler beim Löschen des Berichts.');
            }
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('de-DE');
    };

    return (
        <DashboardShell title="Tagesberichte">
            <div className="mb-6 flex justify-between items-center">
                <p className="text-gray-500">Übersicht aller erfassten Tagesberichte.</p>
                <Link
                    to="/daily-reports/new"
                    className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 shadow-sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Neuer Bericht
                </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-8 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                    </div>
                ) : reports.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <FileText className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">Keine Tagesberichte</h3>
                        <p className="text-gray-500 max-w-sm mx-auto">
                            Es wurden noch keine Tagesberichte erstellt. Klicken Sie oben rechts, um Ihren ersten Bericht anzulegen.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bericht Nr.</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Baustelle</th>
                                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Aktionen</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {reports.map((report) => (
                                    <tr key={report.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/daily-reports/${report.id}`)}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{formatDate(report.date)}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {report.reportNumber || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {report.constructionSite || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => navigate(`/daily-reports/${report.id}`)}
                                                className="text-brand-primary hover:text-brand-primary/80 mr-4"
                                                title="Bearbeiten"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            {userRole !== 'mitarbeiter' && (
                                                <button
                                                    onClick={() => handleDelete(report.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                    title="Löschen"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
};
