import React, { useState, useEffect } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { db, APP_ID } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Building2, MapPin, ArrowRight, Plus, X, Save, Archive, ArchiveRestore, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { slugify } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface Baustelle {
    id: string;
    name: string;
    address: string;
    postalCode?: string;
    city?: string;
    status?: 'active' | 'archived';
}

export const Sites = () => {
    const { userRole } = useAuth();
    const navigate = useNavigate();
    const [sites, setSites] = useState<Baustelle[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [currentPage, setCurrentPage] = useState(1);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        postalCode: '',
        city: '',
        status: 'active'
    });

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'apps', APP_ID, 'baustellen'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Baustelle[];
            setSites(data.sort((a, b) => a.name.localeCompare(b.name)));
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Reset pagination when tab or view changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, viewMode]);

    const handleCreateSite = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const id = slugify(formData.name);
            const docRef = doc(db, 'apps', APP_ID, 'baustellen', id);
            await setDoc(docRef, { ...formData, createdAt: serverTimestamp() }, { merge: true });
            
            setFormData({ name: '', address: '', postalCode: '', city: '', status: 'active' });
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error creating Baustelle:', error);
            toast.error('Fehler beim Erstellen der Baustelle.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (e: React.MouseEvent, site: Baustelle) => {
        e.stopPropagation();
        try {
            const newStatus = site.status === 'archived' ? 'active' : 'archived';
            const docRef = doc(db, 'apps', APP_ID, 'baustellen', site.id);
            await setDoc(docRef, { status: newStatus }, { merge: true });
        } catch (error) {
            console.error('Error toggling status:', error);
            toast.error('Fehler beim Ändern des Status.');
        }
    };

    // Pagination Logic
    const ITEMS_PER_PAGE = viewMode === 'grid' ? 9 : 10;
    const filteredSites = sites.filter(s => activeTab === 'archived' ? s.status === 'archived' : (!s.status || s.status === 'active'));
    const totalPages = Math.ceil(filteredSites.length / ITEMS_PER_PAGE);
    const paginatedSites = filteredSites.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <DashboardShell title="Baustellen">
            <div className="max-w-7xl mx-auto flex flex-col min-h-[calc(100vh-8rem)]">
                
                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
                    <div className="flex space-x-2 bg-gray-50 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('active')}
                            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
                                activeTab === 'active' 
                                    ? 'bg-white text-brand-primary shadow-sm ring-1 ring-black/5' 
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                        >
                            Aktive
                        </button>
                        <button
                            onClick={() => setActiveTab('archived')}
                            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
                                activeTab === 'archived' 
                                    ? 'bg-white text-brand-primary shadow-sm ring-1 ring-black/5' 
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                        >
                            Archiviert
                        </button>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        {/* View Toggles */}
                        <div className="flex bg-gray-50 p-1 rounded-xl">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-all ${
                                    viewMode === 'grid'
                                        ? 'bg-white text-brand-primary shadow-sm ring-1 ring-black/5'
                                        : 'text-gray-400 hover:text-gray-700'
                                }`}
                                title="Kartenansicht"
                            >
                                <LayoutGrid className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`p-2 rounded-lg transition-all ${
                                    viewMode === 'table'
                                        ? 'bg-white text-brand-primary shadow-sm ring-1 ring-black/5'
                                        : 'text-gray-400 hover:text-gray-700'
                                }`}
                                title="Tabellenansicht"
                            >
                                <List className="w-5 h-5" />
                            </button>
                        </div>

                        {userRole !== 'mitarbeiter' && (
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="flex-1 sm:flex-none flex items-center justify-center text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-brand-primary/20 hover:-translate-y-0.5"
                            >
                                <Plus className="w-5 h-5 mr-1.5" />
                                Neue Baustelle erstellen
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                    </div>
                ) : filteredSites.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center flex flex-col items-center">
                        <div className="w-20 h-20 bg-brand-primary/5 rounded-full flex items-center justify-center mb-6">
                            <Building2 className="w-10 h-10 text-brand-primary" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Keine Baustellen gefunden</h3>
                        <p className="text-gray-500 mb-8 max-w-sm">
                            {activeTab === 'active' 
                                ? "Lege deine erste aktive Baustelle an, um zu starten." 
                                : "Es gibt aktuell keine archivierten Baustellen."}
                        </p>
                        {activeTab === 'active' && userRole !== 'mitarbeiter' && (
                            <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-brand-primary text-white font-bold px-6 py-3 rounded-xl hover:bg-brand-primary/90 transition-all shadow-md shadow-brand-primary/20">
                                <Plus className="w-5 h-5 mr-2" />
                                Neue Baustelle anlegen
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
                                {paginatedSites.map(site => (
                                    <div 
                                        key={site.id} 
                                        onClick={() => navigate(`/sites/${site.id}`)}
                                        className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:border-brand-primary/30 transition-all relative overflow-hidden flex flex-col"
                                    >
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 rounded-full blur-2xl -mr-10 -mt-10 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                                        
                                        <div className="flex justify-between items-start mb-5 relative z-10">
                                            <div className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl text-gray-600 ring-1 ring-black/5 group-hover:text-brand-primary group-hover:from-brand-primary/10 group-hover:to-brand-primary/5 transition-all">
                                                <Building2 className="w-6 h-6" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {userRole !== 'mitarbeiter' && (
                                                    <button
                                                        onClick={(e) => handleToggleStatus(e, site)}
                                                        className="p-2 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-full transition-colors z-10"
                                                        title={site.status === 'archived' ? 'Wiederherstellen' : 'Archivieren'}
                                                    >
                                                        {site.status === 'archived' ? <ArchiveRestore className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <h3 className="text-xl font-bold text-gray-900 mb-3 truncate relative z-10">{site.name}</h3>
                                        
                                        <div className="flex items-start text-gray-500 text-sm mb-6 relative z-10 flex-1">
                                            <MapPin className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5 text-gray-400 group-hover:text-brand-primary transition-colors" />
                                            <span className="line-clamp-2 leading-relaxed">
                                                {site.address}{site.postalCode || site.city ? `, ${site.postalCode || ''} ${site.city || ''}` : ''}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-sm font-semibold text-gray-400 group-hover:text-brand-primary transition-colors pt-4 border-t border-gray-100 mt-auto relative z-10">
                                            <span>Details ansehen</span>
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-500 text-sm">
                                                <th className="py-4 px-6 font-medium">Baustelle</th>
                                                <th className="py-4 px-6 font-medium">Adresse</th>
                                                <th className="py-4 px-6 font-medium">Status</th>
                                                <th className="py-4 px-6 font-medium text-right">Aktionen</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedSites.map(site => (
                                                <tr 
                                                    key={site.id}
                                                    onClick={() => navigate(`/sites/${site.id}`)}
                                                    className="border-b border-gray-50 hover:bg-gray-50/80 cursor-pointer transition-colors group"
                                                >
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center">
                                                            <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-lg mr-4">
                                                                <Building2 className="w-4 h-4" />
                                                            </div>
                                                            <span className="font-bold text-gray-900">{site.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 text-sm text-gray-500">
                                                        {site.address}{site.postalCode || site.city ? `, ${site.postalCode || ''} ${site.city || ''}` : ''}
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                            site.status === 'archived' 
                                                                ? 'bg-gray-100 text-gray-600' 
                                                                : 'bg-emerald-50 text-emerald-600'
                                                        }`}>
                                                            {site.status === 'archived' ? 'Archiviert' : 'Aktiv'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        <div className="flex justify-end items-center gap-2">
                                                            {userRole !== 'mitarbeiter' && (
                                                                <button
                                                                    onClick={(e) => handleToggleStatus(e, site)}
                                                                    className="p-2 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-full transition-colors"
                                                                    title={site.status === 'archived' ? 'Wiederherstellen' : 'Archivieren'}
                                                                >
                                                                    {site.status === 'archived' ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                                                </button>
                                                            )}
                                                            <div className="p-2 text-gray-400 group-hover:text-brand-primary transition-colors">
                                                                <ArrowRight className="w-4 h-4" />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Pagination */}
                        <div className="flex justify-between items-center bg-white py-3 px-5 rounded-2xl shadow-sm border border-gray-100 mt-auto">
                            <span className="text-sm text-gray-500">
                                Seite <span className="font-semibold text-gray-900">{currentPage}</span> von <span className="font-semibold text-gray-900">{Math.max(totalPages, 1)}</span>
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage >= totalPages}
                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                <Building2 className="w-5 h-5 mr-2 text-brand-primary" />
                                Neue Baustelle anlegen
                            </h2>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-2 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreateSite} className="p-6 overflow-y-auto">
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Name der Baustelle <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        className="input-premium"
                                        placeholder="z.B. Wohnanlage Sonnenstraße"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Adresse (Straße & Hausnr.) <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.address}
                                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                                        className="input-premium"
                                        placeholder="z.B. Sonnenstraße 12"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">PLZ</label>
                                        <input
                                            type="text"
                                            value={formData.postalCode}
                                            onChange={(e) => setFormData({...formData, postalCode: e.target.value})}
                                            className="input-premium"
                                            placeholder="z.B. 1010"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ort / Stadt</label>
                                        <input
                                            type="text"
                                            value={formData.city}
                                            onChange={(e) => setFormData({...formData, city: e.target.value})}
                                            className="input-premium"
                                            placeholder="z.B. Wien"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-3 rounded-xl font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-all"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || !formData.name.trim() || !formData.address.trim()}
                                    className="flex items-center px-6 py-3 rounded-xl font-bold text-white bg-brand-primary hover:bg-brand-primary/90 transition-all disabled:opacity-50 shadow-md shadow-brand-primary/20"
                                >
                                    {saving ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                    ) : (
                                        <Save className="w-5 h-5 mr-2" />
                                    )}
                                    Speichern
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DashboardShell>
    );
};
