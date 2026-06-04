import React, { useState, useEffect } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { db, APP_ID } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { slugify } from '../lib/utils';
import { Plus, Edit2, Trash2, X, Save, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { SignaturePad } from '../components/ui/SignaturePad';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { CustomSelect } from '../components/CustomSelect';

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
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

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
            setManagers(data.filter(m => m.authUid !== currentUser?.uid));
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
            password: '',
            signature: manager.signature || '',
            status: manager.status || 'active',
        });
        setEditingId(manager.id);
        setIsFormOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Möchten Sie diesen Bauleiter wirklich löschen?')) {
            try {
                await deleteDoc(doc(db, 'apps', APP_ID, 'managers', id));
            } catch (error) {
                console.error('Error deleting manager:', error);
                alert('Fehler beim Löschen des Bauleiters.');
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
                            role: 'admin'
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
            if (!isNew && managerData?.authUid && userRole === 'admin') {
                if (formData.email !== managerData.email || formData.password) {
                    if (import.meta.env.DEV) {
                        toast.error("Auth Updates in DEV mode currently unsupported here.");
                    } else {
                        const token = await currentUser?.getIdToken();
                        if (token) {
                            try {
                                const authPayload: any = { authUid: managerData.authUid };
                                if (formData.email !== managerData.email) authPayload.email = actualEmail;
                                if (formData.password) authPayload.password = formData.password;

                                const res = await fetch('/api/updateUserAuth', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                    body: JSON.stringify(authPayload)
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
                role: 'admin',
                signature: formData.signature,
                status: formData.status,
                updatedAt: serverTimestamp(),
            };

            if (finalAuthUid) {
                savePayload.authUid = finalAuthUid;
            }

            await setDoc(docRef, savePayload, { merge: true });

            setIsFormOpen(false);
            toast.success('Bauleiter erfolgreich gespeichert.');
        } catch (error: any) {
            console.error('Error saving manager:', error);
            toast.error(error.message || 'Fehler beim Speichern.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DashboardShell title="Bauleiter">
            <div className="mb-6 flex justify-between items-center">
                <p className="text-gray-500">Verwalten Sie hier alle Bauleiter (Verantwortliche).</p>
                <button
                    onClick={handleAddNew}
                    className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 shadow-sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Neuer Bauleiter
                </button>
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
                        <div className="fixed inset-0 transition-opacity bg-black bg-opacity-75" onClick={() => setIsFormOpen(false)} />
                        
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

                        <div className="inline-block w-full max-w-3xl overflow-hidden text-left align-bottom transition-all transform bg-white rounded-xl shadow-xl sm:my-8 sm:align-middle">
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                                <h3 className="text-lg font-medium text-gray-900">{editingId ? 'Bauleiter bearbeiten' : 'Neuen Bauleiter anlegen'}</h3>
                                <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
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
                                            placeholder="z.B. Max"
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
                                            placeholder="z.B. Mustermann"
                                            className="input-premium"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                                        <div className="phone-premium-container">
                                            <PhoneInput
                                                country={'at'}
                                                preferredCountries={['at', 'de', 'ch']}
                                                value={formData.phone}
                                                onChange={(phone) => setFormData({ ...formData, phone })}
                                                containerClass="w-full"
                                                inputClass="!w-full !h-[42px] !pl-12 !pr-4 !bg-gray-50/50 focus:!bg-white !border !border-gray-200 focus:!border-brand-primary focus:!ring-2 focus:!ring-brand-primary/20 !rounded-xl !text-sm !font-medium !text-gray-900 !transition-all hover:!border-gray-300"
                                                buttonClass="!bg-transparent !border-none !rounded-l-xl !pl-3"
                                                dropdownClass="!rounded-xl !border-gray-100 !shadow-xl"
                                            />
                                        </div>
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
                                        <label className="block text-sm font-medium text-gray-700">
                                            {editingId ? 'Neues Passwort (optional)' : 'Passwort'}
                                        </label>
                                        <input
                                            type="password"
                                            name="password"
                                            value={formData.password || ''}
                                            onChange={handleChange}
                                            required={!editingId && !!formData.email}
                                            placeholder={editingId ? 'Leer lassen um nicht zu ändern' : 'Mindestens 6 Zeichen'}
                                            className="input-premium"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                        <CustomSelect
                                            value={formData.status}
                                            onChange={(value) => setFormData({ ...formData, status: value as any })}
                                            options={[
                                                { value: 'active', label: 'Aktiv' },
                                                { value: 'archived', label: 'Archiviert' }
                                            ]}
                                        />
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <SignaturePad
                                        label="Unterschrift"
                                        initialData={formData.signature}
                                        onSave={(base64) => setFormData({ ...formData, signature: base64 })}
                                    />
                                </div>

                                <div className="mt-8 flex justify-end space-x-3 pt-6 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsFormOpen(false)}
                                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                                    >
                                        Abbrechen
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                        Speichern
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center space-x-4">
                    <button
                        onClick={() => { setActiveTab('active'); setCurrentPage(1); }}
                        className={`text-sm font-medium px-1 py-2 border-b-2 transition-colors ${activeTab === 'active' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Aktive Bauleiter
                    </button>
                    <button
                        onClick={() => { setActiveTab('archived'); setCurrentPage(1); }}
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
                        Keine Bauleiter gefunden.
                    </div>
                ) : (
                    <div>
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
                                {(() => {
                                    const filteredManagers = managers.filter(m => activeTab === 'archived' ? m.status === 'archived' : (!m.status || m.status === 'active'));
                                    const paginatedManagers = filteredManagers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                                    
                                    return paginatedManagers.map((manager) => (
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
                                                    <span className="text-sm text-gray-400 italic">Keine Unterschrift</span>
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
                                    ));
                                })()}
                            </tbody>
                            </table>
                        </div>
                        {(() => {
                            const filteredCount = managers.filter(m => activeTab === 'archived' ? m.status === 'archived' : (!m.status || m.status === 'active')).length;
                            const totalPages = Math.ceil(filteredCount / itemsPerPage);
                            if (totalPages <= 1) return null;
                            return (
                                <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
                                    <div className="flex flex-1 justify-between sm:hidden">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            Zurück
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            Weiter
                                        </button>
                                    </div>
                                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-sm text-gray-700">
                                                Zeige <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> bis <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredCount)}</span> von <span className="font-medium">{filteredCount}</span> Einträgen
                                            </p>
                                        </div>
                                        <div>
                                            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                                <button
                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                    disabled={currentPage === 1}
                                                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                                >
                                                    <span className="sr-only">Zurück</span>
                                                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                                </button>
                                                <div className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300">
                                                    {currentPage} / {totalPages}
                                                </div>
                                                <button
                                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                    disabled={currentPage === totalPages}
                                                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                                >
                                                    <span className="sr-only">Weiter</span>
                                                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                                </button>
                                            </nav>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </DashboardShell>
    );
};
