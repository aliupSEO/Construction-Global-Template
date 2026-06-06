import React, { useState, useEffect } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { db, APP_ID } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Plus, Edit2, Trash2, FileText, RotateCcw, Trash, Clock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { softDelete, restoreItem, permanentDelete, getDaysUntilExpiry } from '../lib/softDelete';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

interface DailyReport {
    id: string;
    reportNumber: string;
    date: string;
    weather?: string;
    calendarWeek?: string | number;
    constructionSite: string;
    managerId: string;
    clientId: string;
    isDeleted?: boolean;
    deletedAt?: any;
    deletedByName?: string;
    expireAt?: any;
    createdAt?: any;
}

export const DailyReports = () => {
    const [reports, setReports] = useState<DailyReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [showTrash, setShowTrash] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
    const navigate = useNavigate();
    const { userRole, currentUser, employeeName } = useAuth();
    const isAdmin = userRole === 'admin';

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'apps', APP_ID, 'daily_reports'), (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as DailyReport[];
            data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setReports(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const active = reports.filter(r => !r.isDeleted);
    const trash = reports.filter(r => r.isDeleted);
    const displayed = showTrash ? trash : active;

    const handleDelete = async (report: DailyReport) => {
        try {
            await softDelete('daily_reports', report.id, {
                uid: currentUser?.uid || '',
                name: employeeName || currentUser?.email || 'Unbekannt',
            });
            toast.success('Bericht in den Papierkorb verschoben.');
        } catch {
            toast.error('Fehler beim Löschen.');
        }
    };

    const handleRestore = async (report: DailyReport) => {
        try {
            await restoreItem('daily_reports', report.id);
            toast.success('Bericht wiederhergestellt.');
        } catch {
            toast.error('Fehler beim Wiederherstellen.');
        }
    };

    const handlePermanentDelete = async () => {
        if (!confirmDelete) return;
        try {
            await permanentDelete('daily_reports', confirmDelete.id);
            toast.success('Bericht endgültig gelöscht.');
        } catch {
            toast.error('Fehler beim endgültigen Löschen.');
        } finally {
            setConfirmDelete(null);
        }
    };

    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('de-DE') : '-';

    return (
        <DashboardShell title="Tagesberichte">
            <div className="mb-6 flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                    <p className="text-gray-500 text-sm">Übersicht aller Tagesberichte.</p>
                    {isAdmin && trash.length > 0 && (
                        <button
                            onClick={() => setShowTrash(!showTrash)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${showTrash ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'}`}
                        >
                            <Trash className="w-3.5 h-3.5" />
                            Papierkorb {showTrash ? 'verlassen' : `(${trash.length})`}
                        </button>
                    )}
                </div>
                {!showTrash && (
                    <Link to="/daily-reports/new" className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-xl hover:bg-brand-primary/90 shadow-sm text-sm font-bold">
                        <Plus className="w-4 h-4 mr-2" /> Neuer Bericht
                    </Link>
                )}
            </div>

            {showTrash && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                    <Clock className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-red-700">Papierkorb</p>
                        <p className="text-xs text-red-600 mt-0.5">Gelöschte Elemente werden nach 30 Tagen automatisch endgültig entfernt.</p>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" /></div>
                ) : displayed.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            {showTrash ? <Trash className="w-8 h-8 text-gray-300" /> : <FileText className="w-8 h-8 text-gray-400" />}
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">{showTrash ? 'Papierkorb leer' : 'Keine Tagesberichte'}</h3>
                        <p className="text-gray-400 text-sm">{showTrash ? 'Es befinden sich keine gelöschten Berichte im Papierkorb.' : 'Noch keine Berichte erstellt.'}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bericht Nr.</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Baustelle</th>
                                    {showTrash && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gelöscht von</th>}
                                    {showTrash && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Läuft ab</th>}
                                    <th className="relative px-6 py-3"><span className="sr-only">Aktionen</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {displayed.map(report => (
                                    <tr key={report.id} className={`transition-colors ${showTrash ? 'bg-red-50/30 hover:bg-red-50' : 'hover:bg-gray-50 cursor-pointer'}`}
                                        onClick={() => !showTrash && navigate(`/daily-reports/${report.id}`)}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatDate(report.date)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{report.reportNumber || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{report.constructionSite || '-'}</td>
                                        {showTrash && <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{report.deletedByName || '-'}</td>}
                                        {showTrash && (
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2.5 py-1 rounded-full">
                                                    <Clock className="w-3 h-3" />
                                                    {getDaysUntilExpiry(report.expireAt)}d
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={e => e.stopPropagation()}>
                                            {showTrash ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleRestore(report)} className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors border border-emerald-200">
                                                        <RotateCcw className="w-3.5 h-3.5" /> Wiederherstellen
                                                    </button>
                                                    <button onClick={() => setConfirmDelete({ id: report.id, name: `Bericht ${report.reportNumber || report.id}` })} className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors border border-red-200">
                                                        <Trash2 className="w-3.5 h-3.5" /> Löschen
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-3">
                                                    <button onClick={() => navigate(`/daily-reports/${report.id}`)} className="text-brand-primary hover:text-brand-primary/80"><Edit2 className="w-4 h-4" /></button>
                                                    {userRole !== 'mitarbeiter' && (
                                                        <button onClick={() => handleDelete(report)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <ConfirmDeleteModal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handlePermanentDelete}
                title="Endgültig löschen"
                itemName={confirmDelete?.name || ''}
            />
        </DashboardShell>
    );
};
