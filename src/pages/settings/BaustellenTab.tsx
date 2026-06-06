import React, { useState, useEffect } from 'react';
import { db, APP_ID } from '../../lib/firebase';
import { collection, doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { slugify } from '../../lib/utils';
import { Save, Trash2, Edit2, Archive, ArchiveRestore, RotateCcw, Trash, Clock } from 'lucide-react';
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal';
import toast from 'react-hot-toast';
import { softDelete, restoreItem, permanentDelete, getDaysUntilExpiry } from '../../lib/softDelete';
import { useAuth } from '../../contexts/AuthContext';

interface Baustelle {
    id: string;
    name: string;
    address: string;
    postalCode?: string;
    city?: string;
    status?: 'active' | 'archived';
}

export const BaustellenTab = () => {
    const { currentUser } = useAuth();
    const [baustellen, setBaustellen] = useState<Baustelle[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'active' | 'archived' | 'trash'>('active');
    const [editingId, setEditingId] = useState<string | null>(null);

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string } | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        address: '',
        postalCode: '',
        city: '',
        status: 'active'
    });

    useEffect(() => {
        const q = collection(db, 'apps', APP_ID, 'baustellen');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Baustelle[];
            setBaustellen(data.sort((a, b) => a.name.localeCompare(b.name)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const id = editingId || slugify(formData.name);
            const docRef = doc(db, 'apps', APP_ID, 'baustellen', id);
            await setDoc(docRef, formData, { merge: true });
            setFormData({ name: '', address: '', postalCode: '', city: '', status: 'active' });
            setEditingId(null);
        } catch (error) {
            console.error('Error saving Baustelle:', error);
            toast.error('Fehler beim Speichern.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClick = (b: Baustelle) => {
        setItemToDelete({ id: b.id, name: b.name });
        setDeleteModalOpen(true);
    };

    const executeDelete = async () => {
        if (!itemToDelete) return;
        try {
            if (activeTab === 'trash') {
                await permanentDelete('baustellen', itemToDelete.id);
                toast.success('Baustelle endgültig gelöscht.');
            } else {
                await softDelete('baustellen', itemToDelete.id, {
                    uid: currentUser?.uid || '',
                    name: currentUser?.email || 'Admin',
                });
                toast.success('Baustelle in den Papierkorb verschoben.');
            }
            setDeleteModalOpen(false);
            setItemToDelete(null);
        } catch {
            toast.error('Fehler beim Löschen.');
        }
    };

    const handleRestore = async (b: Baustelle) => {
        try {
            await restoreItem('baustellen', b.id);
            toast.success('Baustelle wiederhergestellt.');
        } catch {
            toast.error('Fehler beim Wiederherstellen.');
        }
    };

    const handleEdit = (b: Baustelle) => {
        setFormData({
            name: b.name,
            address: b.address,
            postalCode: b.postalCode || '',
            city: b.city || '',
            status: b.status || 'active'
        });
        setEditingId(b.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const toggleStatus = async (id: string, currentStatus?: 'active' | 'archived') => {
        try {
            const newStatus = currentStatus === 'archived' ? 'active' : 'archived';
            const docRef = doc(db, 'apps', APP_ID, 'baustellen', id);
            await setDoc(docRef, { status: newStatus }, { merge: true });
        } catch (error) {
            console.error('Error toggling status:', error);
            toast.error('Fehler beim Ändern des Status.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-lg font-medium text-gray-900">{editingId ? 'Baustelle bearbeiten' : 'Neue Baustelle anlegen'}</h3>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Name der Baustelle *</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            className="input-premium"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Adresse (Straße & Hausnr.) *</label>
                        <input
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            required
                            className="input-premium"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">PLZ</label>
                            <input
                                type="text"
                                name="postalCode"
                                value={formData.postalCode}
                                onChange={handleChange}
                                className="input-premium"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Ort / Stadt</label>
                            <input
                                type="text"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                className="input-premium"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Status</label>
                        <select
                            name="status"
                            value={formData.status}
                            onChange={handleChange}
                            className="input-premium appearance-none"
                        >
                            <option value="active">Aktiv</option>
                            <option value="archived">Archiviert</option>
                        </select>
                    </div>
                    <div className="flex justify-end pt-2 space-x-3">
                        {editingId && (
                            <button
                                type="button"
                                onClick={() => {
                                    setFormData({ name: '', address: '', postalCode: '', city: '', status: 'active' });
                                    setEditingId(null);
                                }}
                                className="px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
                            >
                                Abbrechen
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-50"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            Speichern
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center space-x-4">
                    <button onClick={() => setActiveTab('active')} className={`text-sm font-medium px-1 py-2 border-b-2 transition-colors ${activeTab === 'active' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Aktive Baustellen</button>
                    <button onClick={() => setActiveTab('archived')} className={`text-sm font-medium px-1 py-2 border-b-2 transition-colors ${activeTab === 'archived' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Archiviert</button>
                    {baustellen.some(b => (b as any).isDeleted) && (
                        <button onClick={() => setActiveTab('trash')} className={`flex items-center gap-1.5 text-sm font-medium px-1 py-2 border-b-2 transition-colors ${activeTab === 'trash' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-red-600'}`}>
                            <Trash className="w-3.5 h-3.5" />
                            Papierkorb ({baustellen.filter(b => (b as any).isDeleted).length})
                        </button>
                    )}
                </div>
                {loading ? (
                    <div className="p-6 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                    </div>
                ) : baustellen.filter(b => {
                    if (activeTab === 'trash') return (b as any).isDeleted;
                    if ((b as any).isDeleted) return false;
                    if (activeTab === 'archived') return b.status === 'archived';
                    return !b.status || b.status === 'active';
                }).length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                        {activeTab === 'trash' ? 'Papierkorb ist leer.' : 'Keine Baustellen gefunden.'}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {activeTab === 'trash' && (
                            <div className="p-3 bg-red-50 border-b border-red-200 flex items-center gap-2 text-xs text-red-600">
                                <Clock className="w-4 h-4" />
                                Gelöschte Baustellen werden nach 30 Tagen automatisch entfernt.
                            </div>
                        )}
                        {baustellen
                            .filter(b => {
                                if (activeTab === 'trash') return (b as any).isDeleted;
                                if ((b as any).isDeleted) return false;
                                if (activeTab === 'archived') return b.status === 'archived';
                                return !b.status || b.status === 'active';
                            })
                                .map(b => (
                                    <div key={b.id} className={`p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 ${(b as any).isDeleted ? 'bg-red-50/20' : ''}`}>
                                        <div className="mb-4 sm:mb-0">
                                            <div className="flex items-center space-x-2">
                                                <h4 className="font-medium text-gray-900">{b.name}</h4>
                                                {b.status === 'archived' && !((b as any).isDeleted) && <span className="px-2 py-0.5 text-[10px] uppercase font-bold text-gray-500 bg-gray-100 rounded-full">Archiviert</span>}
                                                {(b as any).isDeleted && <span className="px-2 py-0.5 text-[10px] uppercase font-bold text-red-600 bg-red-100 rounded-full">Gelöscht</span>}
                                            </div>
                                            <p className="text-sm text-gray-500 mt-1">{b.address}{b.postalCode || b.city ? `, ${b.postalCode || ''} ${b.city || ''}` : ''}</p>
                                            {(b as any).isDeleted && (b as any).expireAt && (
                                                <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Wird in {getDaysUntilExpiry((b as any).expireAt)} Tagen gelöscht</p>
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {activeTab === 'trash' ? (
                                                <>
                                                    <button onClick={() => handleRestore(b)} className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                                                        <RotateCcw className="w-4 h-4" /> Wiederherstellen
                                                    </button>
                                                    <button onClick={() => handleDeleteClick(b)} className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                                                        <Trash2 className="w-4 h-4" /> Löschen
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleEdit(b)} className="inline-flex items-center justify-center p-2 text-brand-primary hover:text-brand-primary/80 hover:bg-brand-primary/10 rounded-md transition-colors" title="Bearbeiten">
                                                        <Edit2 className="w-5 h-5 sm:w-4 sm:h-4" />
                                                    </button>
                                                    <button onClick={() => toggleStatus(b.id, b.status)} className={`inline-flex items-center justify-center p-2 rounded-md transition-colors ${b.status === 'archived' ? 'text-green-600 hover:text-green-900 hover:bg-green-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`} title={b.status === 'archived' ? 'Wiederherstellen' : 'Archivieren'}>
                                                        {b.status === 'archived' ? <ArchiveRestore className="w-5 h-5 sm:w-4 sm:h-4" /> : <Archive className="w-5 h-5 sm:w-4 sm:h-4" />}
                                                    </button>
                                                    <button onClick={() => handleDeleteClick(b)} className="inline-flex items-center justify-center p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md transition-colors" title="In Papierkorb">
                                                        <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                    </div>
                )}
            </div>

            <ConfirmDeleteModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setItemToDelete(null);
                }}
                onConfirm={executeDelete}
                title="Baustelle löschen"
                itemName={itemToDelete?.name || ''}
            />
        </div>
    );
};
