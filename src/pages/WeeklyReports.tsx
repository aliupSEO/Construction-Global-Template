import React, { useState, useEffect } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { db, APP_ID } from '../lib/firebase';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Plus, Edit2, Trash2, CalendarDays } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface WeeklyReport {
    id: string;
    reportNumber?: string;
    calendarWeek: number;
    year: number;
    weeklyEntries?: any[];
    // Backwards compatibility
    employeeId?: string;
    employeeName?: string;
    employeeEntries?: any[];
    constructionSite?: string;
    totalHours: number;
    createdAt?: any;
}

export const WeeklyReports = () => {
    const [reports, setReports] = useState<WeeklyReport[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const q = collection(db, 'apps', APP_ID, 'weekly_reports');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as WeeklyReport[];

            // Sort by year descending, then by calendar week descending
            data.sort((a, b) => {
                if (b.year !== a.year) return b.year - a.year;
                return b.calendarWeek - a.calendarWeek;
            });

            setReports(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleDelete = async (id: string) => {
        if (window.confirm('Möchten Sie diesen Wochenbericht wirklich löschen?')) {
            try {
                await deleteDoc(doc(db, 'apps', APP_ID, 'weekly_reports', id));
            } catch (error) {
                console.error('Error deleting report:', error);
                alert('Fehler beim Löschen des Berichts.');
            }
        }
    };

    return (
        <DashboardShell title="Wochenberichte">
            <div className="mb-6 flex justify-between items-center">
                <p className="text-gray-500">Übersicht aller erfassten Wochenberichte der Mitarbeiter.</p>
                <Link
                    to="/weekly-reports/new"
                    className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 shadow-sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Neuer Wochenbericht
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
                            <CalendarDays className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">Keine Wochenberichte</h3>
                        <p className="text-gray-500 max-w-sm mx-auto">
                            Es wurden noch keine Wochenberichte erstellt. Klicken Sie oben rechts, um den ersten anzulegen.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">KW / Jahr</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Baustelle</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mitarbeiter</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gesamtstunden</th>
                                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Aktionen</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {reports.map((report) => {
                                    // Calculate unique sites and employees
                                    let uniqueSites = new Set<string>();
                                    let uniqueEmployees = new Set<string>();

                                    if (report.weeklyEntries && report.weeklyEntries.length > 0) {
                                        report.weeklyEntries.forEach((entry: any) => {
                                            if (entry.constructionSiteName) uniqueSites.add(entry.constructionSiteName);
                                            if (entry.employeeName) uniqueEmployees.add(entry.employeeName);
                                        });
                                    } else if (report.employeeEntries && report.employeeEntries.length > 0) {
                                        if (report.constructionSite) uniqueSites.add(report.constructionSite);
                                        report.employeeEntries.forEach((entry: any) => {
                                            if (entry.employeeName) uniqueEmployees.add(entry.employeeName);
                                        });
                                    } else {
                                        if (report.constructionSite) uniqueSites.add(report.constructionSite);
                                        if (report.employeeName) uniqueEmployees.add(report.employeeName);
                                    }

                                    const siteText = uniqueSites.size > 0 ? Array.from(uniqueSites).join(', ') : '-';
                                    const empText = uniqueEmployees.size > 1 ? `${uniqueEmployees.size} Mitarbeiter` : (Array.from(uniqueEmployees)[0] || '-');


                                    return (
                                        <tr key={report.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/weekly-reports/${report.id}`)}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {report.reportNumber ? `${report.reportNumber} (KW ${report.calendarWeek} / ${report.year})` : `KW ${report.calendarWeek} / ${report.year}`}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 max-w-xs truncate" title={siteText}>
                                                {siteText}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {empText}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-brand-primary">
                                                {report.totalHours} h
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => navigate(`/weekly-reports/${report.id}`)}
                                                    className="text-brand-primary hover:text-brand-primary/80 mr-4"
                                                    title="Bearbeiten"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(report.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                    title="Löschen"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
};
