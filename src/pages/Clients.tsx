import React, { useState, useEffect } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { db, APP_ID } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { slugify } from '../lib/utils';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';

interface Client {
    id: string;
    companyOrName: string;
    contactPerson: string;
    address: string;
    postalCode?: string;
    city?: string;
    phone: string;
    email: string;
}

export const Clients = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        companyOrName: '',
        contactPerson: '',
        address: '',
        postalCode: '',
        city: '',
        phone: '',
        email: '',
    });

    useEffect(() => {
        const q = collection(db, 'apps', APP_ID, 'clients');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Client[];

            data.sort((a, b) => a.companyOrName.localeCompare(b.companyOrName));
            setClients(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAddNew = () => {
        setFormData({ companyOrName: '', contactPerson: '', address: '', postalCode: '', city: '', phone: '', email: '' });
        setEditingId(null);
        setIsFormOpen(true);
    };

    const handleEdit = (client: Client) => {
        setFormData({
            companyOrName: client.companyOrName,
            contactPerson: client.contactPerson || '',
            address: client.address || '',
            postalCode: client.postalCode || '',
            city: client.city || '',
            phone: client.phone || '',
            email: client.email || '',
        });
        setEditingId(client.id);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Möchten Sie diesen Bauleiter wirklich löschen?')) {
            try {
                await deleteDoc(doc(db, 'apps', APP_ID, 'clients', id));
            } catch (error) {
                console.error('Error deleting client:', error);
                alert('Fehler beim Löschen des Bauleiters.');
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const id = editingId || slugify(formData.companyOrName);
            const docRef = doc(db, 'apps', APP_ID, 'clients', id);

            await setDoc(docRef, {
                ...formData,
                updatedAt: serverTimestamp(),
            }, { merge: true });

            setIsFormOpen(false);
        } catch (error) {
            console.error('Error saving client:', error);
            alert('Fehler beim Speichern.');
        }
    };

    return (
        <DashboardShell title="Bauleiter">
            <div className="mb-6 flex justify-between items-center">
                <p className="text-gray-500">Verwalten Sie hier alle Bauleiter (Kunden).</p>
                <button
                    onClick={handleAddNew}
                    className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 shadow-sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Neuer Bauleiter
                </button>
            </div>

            {isFormOpen && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-medium text-gray-900">{editingId ? 'Bauleiter bearbeiten' : 'Neuen Bauleiter anlegen'}</h3>
                        <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Firma / Name *</label>
                                <input
                                    type="text"
                                    name="companyOrName"
                                    required
                                    value={formData.companyOrName}
                                    onChange={handleChange}
                                    className="input-premium"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Ansprechpartner</label>
                                <input
                                    type="text"
                                    name="contactPerson"
                                    value={formData.contactPerson}
                                    onChange={handleChange}
                                    className="input-premium"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Telefon</label>
                                <input
                                    type="text"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="input-premium"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">E-Mail</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="input-premium"
                                />
                            </div>
                            <div className="md:col-span-2">
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
                            <div className="md:col-span-2 grid grid-cols-2 gap-4">
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
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => setIsFormOpen(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Abbrechen
                            </button>
                            <button
                                type="submit"
                                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                Speichern
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-8 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                    </div>
                ) : clients.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        Keine Bauleiter gefunden. Legen Sie den ersten Bauleiter an.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma / Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ansprechpartner</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kontakt</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Aktionen</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {clients.map((client) => (
                                <tr key={client.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{client.companyOrName}</div>
                                        <div className="text-sm text-gray-500">
                                            {client.address}{client.postalCode || client.city ? `, ${client.postalCode || ''} ${client.city || ''}` : ''}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {client.contactPerson || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex flex-col">
                                        {client.phone && <span>{client.phone}</span>}
                                        {client.email && <span>{client.email}</span>}
                                        {(!client.phone && !client.email) && <span>-</span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleEdit(client)}
                                            className="text-brand-primary hover:text-brand-primary/80 mr-4"
                                            title="Bearbeiten"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(client.id)}
                                            className="text-red-600 hover:text-red-900"
                                            title="Löschen"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
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
