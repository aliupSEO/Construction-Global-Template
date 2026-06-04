import React, { useState, useEffect } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { db, APP_ID } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { slugify } from '../lib/utils';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { SignaturePad } from '../components/ui/SignaturePad';

interface Manager {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    password?: string;
    authUid?: string;
    role?: string;
    signature?: string;
    status?: 'active' | 'archived';
}

import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { query, where, getDocs } from 'firebase/firestore';

export const Managers = () => {
    const { currentUser, userRole } = useAuth();
    const [managers, setManagers] = useState<Manager[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
    const [formData, setFormData] = useState<{
        firstName: string,
        lastName: string,
        phone: string,
        email: string,
        password?: string,
        signature: string,
        status: 'active' | 'archived'
    }>({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        password: '',
        signature: '',
        status: 'active'
    });

    useEffect(() => {
        const q = collection(db, 'apps', APP_ID, 'managers');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Manager[];

            data.sort((a, b) => a.lastName.localeCompare(b.lastName));
            setManagers(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAddNew = () => {
        setFormData({ firstName: '', lastName: '', phone: '', email: '', password: '', signature: '', status: 'active' });
        setEditingId(null);
        setIsFormOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleEdit = (manager: Manager) => {
        setFormData({
            firstName: manager.firstName,
            lastName: manager.lastName,
            phone: manager.phone || '',
            email: manager.email || '',
            password: manager.password || '',
            signature: manager.signature || '',
            status: manager.status || 'active',
        });
        setEditingId(manager.id);
        setIsFormOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Möchten Sie diesen Vorarbeiter wirklich löschen?')) {
            try {
                await deleteDoc(doc(db, 'apps', APP_ID, 'managers', id));
            } catch (error) {
                console.error('Error deleting manager:', error);
                alert('Fehler beim Löschen des Vorarbeiters.');
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const isNew = !editingId;
            let finalAuthUid = undefined;
            const actualEmail = formData.email.includes('@') ? formData.email : `${formData.email}@satler-digital.com`;

            if (formData.email) {
                const uniqueCheckQuery = query(collection(db, 'apps', APP_ID, 'managers'), where('email', '==', formData.email));
                const uniqueDocs = await getDocs(uniqueCheckQuery);
                if (!uniqueDocs.empty) {
                    const existingDoc = uniqueDocs.docs[0];
                    if (isNew || existingDoc.id !== editingId) {
                        throw new Error("Dieser Benutzername / diese E-Mail existiert bereits im System.");
                    }
                }
            }

            if (isNew && formData.email && formData.password) {
                if (!currentUser) throw new Error("Nicht eingeloggt als Admin");
                
                if (import.meta.env.DEV) {
                    throw new Error("Auth creation via secondary SDK is unsupported in Managers logic for now. Use Vercel backend.");
                } else {
                    const token = await currentUser.getIdToken();
                    const response = await fetch('/api/createUser', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            email: actualEmail,
                            password: formData.password,
                            displayName: `${formData.firstName} ${formData.lastName}`,
                            role: 'vorarbeiter'
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || 'Fehler beim Erstellen des Benutzer-Logins.');
                    }
                    const responseData = await response.json();
                    finalAuthUid = responseData.uid;
                }
            }

            const managerData = editingId ? managers.find(m => m.id === editingId) : null;
            if (!isNew && managerData?.authUid && (userRole === 'admin' || userRole === 'vorarbeiter')) {
                if ((formData.email !== managerData.email || formData.password !== managerData.password) && formData.password) {
                    if (import.meta.env.DEV) {
                        toast.error("Auth Updates in DEV mode currently unsupported here.");
                    } else {
                        const token = await currentUser?.getIdToken();
                        if (token) {
                            try {
                                const res = await fetch('/api/updateUserAuth', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                    body: JSON.stringify({ authUid: managerData.authUid, email: actualEmail, password: formData.password })
                                });
                                if (!res.ok) throw new Error(await res.text());
                            } catch (err) {
                                console.error('Update Auth Network Err:', err);
                                throw new Error("Fehler beim Aktualisieren der Login-Daten");
                            }
                        }
                    }
                }
            }

            const fullName = `${formData.firstName} ${formData.lastName}`;
            const id = editingId || finalAuthUid || slugify(fullName);
            const docRef = doc(db, 'apps', APP_ID, 'managers', id);

            const savePayload: any = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
                email: formData.email,
                password: formData.password || '',
                role: 'vorarbeiter',
                signature: formData.signature,
                status: formData.status,
                updatedAt: serverTimestamp(),
            };

            if (finalAuthUid) {
                savePayload.authUid = finalAuthUid;
            }

            await setDoc(docRef, savePayload, { merge: true });

            setIsFormOpen(false);
            toast.success('Vorarbeiter erfolgreich gespeichert.');
        } catch (error: any) {
            console.error('Error saving manager:', error);
            toast.error(error.message || 'Fehler beim Speichern.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DashboardShell title="Vorarbeiter">
            <div className="mb-6 flex justify-between items-center">
                <p className="text-gray-500">Verwalten Sie hier alle Vorarbeiter (Verantwortliche).</p>
                <button
                    onClick={handleAddNew}
                    className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 shadow-sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Neuer Vorarbeiter
                </button>
            </div>

            {isFormOpen && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-medium text-gray-900">{editingId ? 'Vorarbeiter bearbeiten' : 'Neuen Vorarbeiter anlegen'}</h3>
                        <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Vorname *</label>
                                <input
                                    type="text"
                                    name="firstName"
                                    required
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    className="input-premium"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nachname *</label>
                                <input
                                    type="text"
                                    name="lastName"
                                    required
                                    value={formData.lastName}
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
                                <label className="block text-sm font-medium text-gray-700">Benutzername / E-Mail</label>
                                <input
                                    type="text"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="input-premium"
                                    placeholder="z.B. klaus oder klaus@firma.at"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Log-in Passwort</label>
                                <input
                                    type="text"
                                    name="password"
                                    value={formData.password || ''}
                                    onChange={handleChange}
                                    placeholder={editingId ? (formData.password ? "Klartext-Passwort..." : "Passwort (versteckt). Hier tippen für Reset...") : "Passwort initialisieren"}
                                    className="input-premium"
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                    {editingId ? (formData.password ? "Klartext-Passwort aktiv. Nutzer muss es ändern." : "Nutzer hat eigenes Passwort. Neues eingeben für Reset.") : "Wird beim Erstellen benötigt."}
                                </p>
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
                        </div>

                        <div className="mt-6">
                            <SignaturePad
                                label="Unterschrift"
                                initialData={formData.signature}
                                onSave={(base64) => setFormData({ ...formData, signature: base64 })}
                            />
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
                <div className="p-4 border-b border-gray-100 flex items-center space-x-4">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`text-sm font-medium px-1 py-2 border-b-2 transition-colors ${activeTab === 'active' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Aktive Vorarbeiter
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
                    <div className="p-8 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                    </div>
                ) : managers.filter(m => activeTab === 'archived' ? m.status === 'archived' : (!m.status || m.status === 'active')).length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        Keine Vorarbeiter gefunden.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kontakt</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unterschrift</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Aktionen</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {managers
                                .filter(m => activeTab === 'archived' ? m.status === 'archived' : (!m.status || m.status === 'active'))
                                .map((manager) => (
                                    <tr key={manager.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center space-x-2">
                                                <span className="text-sm font-medium text-gray-900">{manager.lastName}, {manager.firstName}</span>
                                                {manager.status === 'archived' && (
                                                    <span className="px-2 py-0.5 text-[10px] uppercase font-bold text-gray-500 bg-gray-100 rounded-full">Archiviert</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex flex-col">
                                            {manager.phone && <span>{manager.phone}</span>}
                                            {manager.email && <span>{manager.email}</span>}
                                            {(!manager.phone && !manager.email) && <span>-</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {manager.signature ? (
                                                <img src={manager.signature} alt="Unterschrift" className="h-8 object-contain" />
                                            ) : (
                                                <span className="text-sm text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleEdit(manager)}
                                                className="text-brand-primary hover:text-brand-primary/80 mr-4"
                                                title="Bearbeiten"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(manager.id)}
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
