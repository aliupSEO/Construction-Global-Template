import React, { useState, useEffect } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { db, APP_ID } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Building2, MapPin, ArrowRight, Plus, X, Save, Archive, ArchiveRestore } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { slugify } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

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

    const handleCreateSite = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const id = slugify(formData.name);
            const docRef = doc(db, 'apps', APP_ID, 'baustellen', id);
            await setDoc(docRef, { ...formData, createdAt: serverTimestamp() }, { merge: true });
            
            // Close and reset
            setFormData({ name: '', address: '', postalCode: '', city: '', status: 'active' });
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error creating Baustelle:', error);
            alert('Fehler beim Erstellen der Baustelle.');
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
            alert('Fehler beim Ändern des Status.');
        }
    };

    return (
        <DashboardShell title="Baustellen Übersicht">
            <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <p className="text-gray-500 text-sm">Wähle eine Baustelle für Details und Fotos</p>
                {userRole !== 'mitarbeiter' && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center justify-center text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 px-5 py-2.5 rounded-xl transition-colors shadow-sm"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Neue Baustelle
                    </button>
                )}
            </div>

            <div className="mb-6 border-b border-gray-100 flex space-x-6">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'active' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Aktive Baustellen
                </button>
                <button
                    onClick={() => setActiveTab('archived')}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'archived' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Archiviert
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                </div>
            ) : sites.filter(s => activeTab === 'archived' ? s.status === 'archived' : (!s.status || s.status === 'active')).length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center mb-4">
                        <Building2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Keine Baustellen gefunden</h3>
                    <p className="text-gray-500 mb-6">
                        {activeTab === 'active' 
                            ? "Lege deine erste aktive Baustelle an, um zu starten." 
                            : "Es gibt aktuell keine archivierten Baustellen."}
                    </p>
                    {activeTab === 'active' && userRole !== 'mitarbeiter' && (
                        <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-brand-primary text-white font-medium px-6 py-3 rounded-xl hover:bg-brand-primary/90 transition-colors shadow-sm">
                            <Plus className="w-5 h-5 mr-2" />
                            Neue Baustelle anlegen
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sites.filter(s => activeTab === 'archived' ? s.status === 'archived' : (!s.status || s.status === 'active')).map(site => (
                        <div 
                            key={site.id} 
                            onClick={() => navigate(`/sites/${site.id}`)}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-md hover:border-brand-primary/40 transition-all group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-1.5 h-full bg-brand-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary ring-1 ring-brand-primary/20">
                                    <Building2 className="w-6 h-6" />
                                </div>
                                <div className="flex items-center gap-2">
                                    {userRole !== 'mitarbeiter' && (
                                        <button
                                            onClick={(e) => handleToggleStatus(e, site)}
                                            className="p-2 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-full transition-colors z-10 relative"
                                            title={site.status === 'archived' ? 'Wiederherstellen' : 'Archivieren'}
                                        >
                                            {site.status === 'archived' ? <ArchiveRestore className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
                                        </button>
                                    )}
                                    <div className="text-gray-300 group-hover:text-brand-primary transition-colors bg-gray-50 group-hover:bg-brand-primary/10 p-2 rounded-full">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                            
                            <h3 className="text-lg font-bold text-gray-900 mb-2 truncate" title={site.name}>{site.name}</h3>
                            
                            <div className="flex items-start text-gray-500 text-sm">
                                <MapPin className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5 text-gray-400 group-hover:text-brand-primary/70 transition-colors" />
                                <span className="line-clamp-2 leading-tight">
                                    {site.address}{site.postalCode || site.city ? `, ${site.postalCode || ''} ${site.city || ''}` : ''}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900">Neue Baustelle anlegen</h2>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreateSite} className="p-6 overflow-y-auto">
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name der Baustelle <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary"
                                        placeholder="z.B. Wohnanlage Sonnenstraße"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresse (Straße & Hausnr.) <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.address}
                                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                                        className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary"
                                        placeholder="z.B. Sonnenstraße 12"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                                        <input
                                            type="text"
                                            value={formData.postalCode}
                                            onChange={(e) => setFormData({...formData, postalCode: e.target.value})}
                                            className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary"
                                            placeholder="z.B. 1010"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Ort / Stadt</label>
                                        <input
                                            type="text"
                                            value={formData.city}
                                            onChange={(e) => setFormData({...formData, city: e.target.value})}
                                            className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary"
                                            placeholder="z.B. Wien"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-3 rounded-xl font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || !formData.name.trim() || !formData.address.trim()}
                                    className="flex items-center px-6 py-3 rounded-xl font-bold text-white bg-brand-primary hover:bg-brand-primary/90 transition-colors disabled:opacity-50 shadow-sm"
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
