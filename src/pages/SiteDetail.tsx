import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardShell } from '../components/DashboardShell';
import { db, APP_ID } from '../lib/firebase';
import { doc, getDoc, collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { ArrowLeft, MapPin, Building2, FileText, Image as ImageIcon, ArrowRight, Plus, Printer } from 'lucide-react';
import { SitePhotos } from '../components/SitePhotos';

interface Baustelle {
    id: string;
    name: string;
    address: string;
    postalCode?: string;
    city?: string;
    status?: string;
}

export const SiteDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [site, setSite] = useState<Baustelle | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<'menu' | 'reports' | 'photos'>('menu');
    
    const [reports, setReports] = useState<any[]>([]);

    useEffect(() => {
        if (!id) return;
        const fetchSite = async () => {
            const docRef = doc(db, 'apps', APP_ID, 'baustellen', id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setSite({ id: docSnap.id, ...docSnap.data() } as Baustelle);
            }
            setLoading(false);
        };
        fetchSite();
    }, [id]);

    useEffect(() => {
        if (!site?.name) return;
        
        const q = query(
            collection(db, 'apps', APP_ID, 'daily_reports'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as any));
            
            const siteReports = data.filter(r => r.constructionSite?.trim() === site.name?.trim());
            siteReports.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
            
            setReports(siteReports);
        });

        return () => unsubscribe();
    }, [site?.name]);

    if (loading) {
        return (
            <DashboardShell title="Baustellen Detailansicht">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                </div>
            </DashboardShell>
        );
    }

    if (!site) {
        return (
            <DashboardShell title="Baustellen Detailansicht">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-red-50 text-red-400 rounded-full flex items-center justify-center mb-4">
                        <Building2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Baustelle nicht gefunden</h3>
                    <p className="text-gray-500 mb-6">Diese Baustelle existiert möglicherweise nicht mehr.</p>
                    <button onClick={() => navigate('/sites')} className="bg-brand-primary text-white font-medium px-6 py-2.5 rounded-lg hover:bg-brand-primary/90 transition-colors shadow-sm">
                        Zurück zur Übersicht
                    </button>
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell title={site.name}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-primary"></div>
                <button 
                    onClick={() => activeView === 'menu' ? navigate('/sites') : setActiveView('menu')}
                    className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-brand-primary mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    {activeView === 'menu' ? 'Zurück zur Übersicht' : 'Zurück zum Baustellen-Menü'}
                </button>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                            <Building2 className="w-6 h-6 mr-3 text-brand-primary" />
                            {site.name}
                        </h1>
                        <div className="flex items-start sm:items-center text-gray-500 text-sm">
                            <MapPin className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5 sm:mt-0" />
                            <span>
                                {site.address}{site.postalCode || site.city ? `, ${site.postalCode || ''} ${site.city || ''}` : ''}
                            </span>
                        </div>
                    </div>
                    {site.status === 'archived' && (
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold uppercase tracking-wider border border-gray-200 self-start">
                            Archiviert
                        </span>
                    )}
                </div>
            </div>

            {activeView === 'menu' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        onClick={() => setActiveView('reports')}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-left hover:border-brand-primary/40 hover:shadow-md transition-all group flex flex-col items-start"
                    >
                        <div className="w-12 h-12 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center mb-4 ring-1 ring-brand-primary/20">
                            <FileText className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center">
                            Tagesberichte
                            <span className="ml-3 px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold border border-gray-200">
                                {reports.length}
                            </span>
                        </h3>
                        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                            Dokumentiere Arbeitsstunden, Leistungen und Vorkommnisse.
                        </p>
                        <div className="mt-auto flex items-center text-sm font-medium text-brand-primary group-hover:translate-x-1 transition-transform">
                            Berichte ansehen <ArrowRight className="w-4 h-4 ml-1" />
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveView('photos')}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-left hover:border-brand-primary/40 hover:shadow-md transition-all group flex flex-col items-start"
                    >
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 ring-1 ring-emerald-200">
                            <ImageIcon className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                            Fotodokumentation
                        </h3>
                        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                            Lade Fortschritts- und Dokumentationsfotos hoch oder nimm sie direkt auf.
                        </p>
                        <div className="mt-auto flex items-center text-sm font-medium text-emerald-600 group-hover:translate-x-1 transition-transform">
                            Galerie öffnen <ArrowRight className="w-4 h-4 ml-1" />
                        </div>
                    </button>

                    {/* Platzhalter für zukünftige Buttons
                    <button className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-6 text-center text-gray-400 flex flex-col items-center justify-center h-full min-h-[200px]">
                        <Plus className="w-8 h-8 mb-2" />
                        <span className="font-medium text-sm">Weitere Module folgen...</span>
                    </button>
                    */}
                </div>
            )}

            {activeView === 'reports' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h2 className="text-lg font-bold text-gray-900">Tagesberichte</h2>
                        <button 
                            onClick={() => navigate('/daily-reports/new')}
                            className="bg-brand-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-primary/90 transition-colors shadow-sm flex items-center"
                        >
                            <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Neuer Bericht</span>
                            <span className="sm:hidden">Neu</span>
                        </button>
                    </div>

                    {reports.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 ring-1 ring-gray-100">
                                <FileText className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">Keine Tagesberichte</h3>
                            <p className="text-sm text-gray-500 mb-6">Für diese Baustelle wurden noch keine Tagesberichte erfasst.</p>
                            <button 
                                onClick={() => navigate('/daily-reports/new')}
                                className="bg-brand-primary text-white font-medium px-6 py-2.5 rounded-lg hover:bg-brand-primary/90 transition-colors shadow-sm"
                            >
                                Jetzt ersten Bericht anlegen
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {reports.map((report) => (
                                <div key={report.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer group" onClick={() => navigate(`/daily-reports/${report.id}`)}>
                                    <div className="mb-4 sm:mb-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="font-bold text-gray-900">{new Date(report.date || 0).toLocaleDateString('de-DE')}</span>
                                            <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-bold text-gray-600 border border-gray-200 uppercase tracking-wider">
                                                {report.reportNumber || '-'}
                                            </span>
                                            {report.managerSignature ? (
                                                <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs font-bold border border-green-200 uppercase tracking-wider">Erledigt</span>
                                            ) : (
                                                <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded text-xs font-bold border border-yellow-200 uppercase tracking-wider">Offen</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.open(`/print/daily/${report.id}`, '_blank');
                                            }}
                                            title="Drucken"
                                            className="p-1.5 sm:p-2 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors border border-transparent hover:border-brand-primary/20 bg-white sm:bg-transparent shadow-sm sm:shadow-none"
                                        >
                                            <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </button>
                                        <div className="flex items-center text-sm font-medium text-gray-500 group-hover:text-brand-primary transition-colors bg-white px-3 py-1.5 rounded-lg border border-gray-200 group-hover:border-brand-primary/30 shadow-sm">
                                            Ansehen
                                            <ArrowRight className="w-4 h-4 ml-2" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeView === 'photos' && (
                <div className="mb-8">
                    <div className="flex items-center mb-4 px-2">
                        <ImageIcon className="w-5 h-5 text-gray-500 mr-2" />
                        <h2 className="text-xl font-bold text-gray-900">Fotodokumentation</h2>
                    </div>
                    <SitePhotos siteId={site.id} />
                </div>
            )}

        </DashboardShell>
    );
};
