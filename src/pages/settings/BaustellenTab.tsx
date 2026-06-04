import React, { useState, useEffect } from 'react';
import { db, APP_ID } from '../../lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { slugify } from '../../lib/utils';
import { Save, Trash2, Edit2, Archive, ArchiveRestore } from 'lucide-react';
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal';

interface Baustelle {
    id: string;
    name: string;
    address: string;
    postalCode?: string;
    city?: string;
    status?: 'active' | 'archived';
}

export const BaustellenTab = () => {
    const [baustellen, setBaustellen] = useState<Baustelle[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
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
            alert('Fehler beim Speichern.');
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
            await deleteDoc(doc(db, 'apps', APP_ID, 'baustellen', itemToDelete.id));
            setDeleteModalOpen(false);
            setItemToDelete(null);
        } catch (error) {
            console.error('Error deleting Baustelle:', error);
            alert('Fehler beim Löschen.');
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
            alert('Fehler beim Ändern des Status.');
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
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`text-sm font-medium px-1 py-2 border-b-2 transition-colors ${activeTab === 'active' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Aktive Baustellen
                    </button>
                    <button
                        onClick={() => setActiveTab('archived')}
                        className={`text-sm font-medium px-1 py-2 border-b-2 transition-colors ${activeTab === 'archived' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Archiviert
                    </button>
                </div>
                {loading ? (
                    <div className="p-6 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                    </div>
                ) : baustellen.filter(b => activeTab === 'archived' ? b.status === 'archived' : (!b.status || b.status === 'active')).length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                        Keine Baustellen gefunden.
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {baustellen
                            .filter(b => activeTab === 'archived' ? b.status === 'archived' : (!b.status || b.status === 'active'))
                            .map(b => (
                                <div key={b.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50">
                                    <div className="mb-4 sm:mb-0">
                                        <div className="flex items-center space-x-2">
                                            <h4 className="font-medium text-gray-900">{b.name}</h4>
                                            {b.status === 'archived' && (
                                                <span className="px-2 py-0.5 text-[10px] uppercase font-bold text-gray-500 bg-gray-100 rounded-full">Archiviert</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {b.address}{b.postalCode || b.city ? `, ${b.postalCode || ''} ${b.city || ''}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => handleEdit(b)}
                                            className="inline-flex items-center justify-center p-2 text-brand-primary hover:text-brand-primary/80 hover:bg-brand-primary/10 rounded-md transition-colors"
                                            title="Bearbeiten"
                                        >
                                            <Edit2 className="w-5 h-5 sm:w-4 sm:h-4" />
                                        </button>
                                        <button
                                            onClick={() => toggleStatus(b.id, b.status)}
                                            className={`inline-flex items-center justify-center p-2 rounded-md transition-colors ${b.status === 'archived'
                                                ? 'text-green-600 hover:text-green-900 hover:bg-green-50'
                                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                                }`}
                                            title={b.status === 'archived' ? 'Wiederherstellen' : 'Archivieren'}
                                        >
                                            {b.status === 'archived' ? <ArchiveRestore className="w-5 h-5 sm:w-4 sm:h-4" /> : <Archive className="w-5 h-5 sm:w-4 sm:h-4" />}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClick(b)}
                                            className="inline-flex items-center justify-center p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md transition-colors"
                                            title="Endgültig löschen"
                                        >
                                            <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                                        </button>
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
