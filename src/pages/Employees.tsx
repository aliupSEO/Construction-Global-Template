import React, { useState, useEffect } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { db, APP_ID } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { slugify } from '../lib/utils';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { CustomSelect } from '../components/CustomSelect';
import { Plus, Edit2, Trash2, X, Save, Loader2, Archive, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import toast from 'react-hot-toast';

const ROLE_MAP: Record<string, string> = {
    'admin': 'Administrator',
    'vorarbeiter': 'Vorarbeiter (Digital)',
    'mitarbeiter': 'Mitarbeiter (Digital)',
    '': 'Kein Systemzugang',
};

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    position?: string;
    active?: boolean;
    status?: 'active' | 'archived';
    address?: string;
    phone?: string;
    email?: string;
    authUid?: string;
    password?: string;
}

export const Employees = () => {
    const { currentUser, userRole } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string } | null>(null);
    const [formData, setFormData] = useState<{
        firstName: string,
        lastName: string,
        role: string,
        position: string,
        status: 'active' | 'archived',
        address?: string,
        phone?: string,
        email?: string,
        password?: string
    }>({
        firstName: '',
        lastName: '',
        role: '',
        position: '',
        status: 'active',
        address: '',
        phone: '',
        email: '',
        password: '',
    });

    useEffect(() => {
        const q = collection(db, 'apps', APP_ID, 'employees');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Employee[];

            // Sort alphabetically mainly by last name
            data.sort((a, b) => a.lastName.localeCompare(b.lastName));
            setEmployees(data.filter(e => e.authUid !== currentUser?.uid));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAddNew = () => {
        setFormData({ firstName: '', lastName: '', role: '', position: '', status: 'active', address: '', phone: '', email: '' });
        setEditingId(null);
        setIsFormOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleEdit = (employee: Employee) => {
        let currentStatus: 'active' | 'archived' = 'active';
        if (employee.status) {
            currentStatus = employee.status;
        } else if (employee.active === false) {
            currentStatus = 'archived';
        }

        setFormData({
            firstName: employee.firstName,
            lastName: employee.lastName,
            role: ['admin', 'vorarbeiter', 'mitarbeiter'].includes(employee.role?.toLowerCase() || '') ? employee.role.toLowerCase() : '',
            position: employee.position || (['Vorarbeiter', 'Hilfsarbeiter', 'Facharbeiter', 'Ausführender', 'VA', 'HA', 'FA'].includes(employee.role) ? 
                (employee.role === 'VA' ? 'Vorarbeiter' : employee.role === 'HA' ? 'Hilfsarbeiter' : employee.role === 'FA' ? 'Facharbeiter' : employee.role) 
                : ''),
            status: currentStatus,
            address: employee.address || '',
            phone: employee.phone || '',
            email: employee.email || '',
        });
        setEditingId(employee.id);
        setIsFormOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteClick = (employee: Employee) => {
        if (userRole === 'admin' || userRole === 'vorarbeiter') {
            setItemToDelete({ id: employee.id, name: `${employee.firstName} ${employee.lastName}` });
            setDeleteModalOpen(true);
        }
    };

    const executeDeleteAdmin = async () => {
        if (!itemToDelete) return;
        try {
            await deleteDoc(doc(db, 'apps', APP_ID, 'employees', itemToDelete.id));
            toast.success('Mitarbeiter endgültig gelöscht');
            setDeleteModalOpen(false);
            setItemToDelete(null);
        } catch (error) {
            console.error('Error deleting employee:', error);
            toast.error('Fehler beim Löschen des Mitarbeiters.');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const isNew = !editingId;
            let finalAuthUid = undefined;
            const actualEmail = formData.email?.includes('@') ? formData.email : `${formData.email}@satler-digital.com`;

            // Uniqueness Check in Firestore
            if (formData.email) {
                const uniqueCheckQuery = query(collection(db, 'apps', APP_ID, 'employees'), where('email', '==', formData.email));
                const uniqueDocs = await getDocs(uniqueCheckQuery);
                if (!uniqueDocs.empty) {
                    const existingDoc = uniqueDocs.docs[0];
                    if (isNew || existingDoc.id !== editingId) {
                        throw new Error("Dieser Benutzername / diese E-Mail existiert bereits im System.");
                    }
                }
            }

            if (isNew && formData.email) {
                if (!currentUser) throw new Error("Nicht eingeloggt als Admin");
                
                if (import.meta.env.DEV) {
                    throw new Error("User-Anlage geht aus Sicherheitsgründen nur im echten Vercel-Environment (Produktion) via Admin SDK. Bitte pushen und live testen.");
                } else {
                    const token = await currentUser.getIdToken();
                    
                    const userPassword = formData.password || 'Start1234!';
                    
                    const response = await fetch('/api/createUser', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            email: actualEmail,
                            password: userPassword,
                            displayName: `${formData.firstName} ${formData.lastName}`,
                            role: formData.role
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

            // Fallback für Legacy Daten
            const employeeData = editingId ? employees.find(e => e.id === editingId) : null;
            if (!isNew && employeeData?.authUid && userRole === 'admin') {
                if (employeeData.role !== formData.role) {
                    if (import.meta.env.DEV) {
                        console.log("Updating Role in DEV mode");
                    } else {
                        const token = await currentUser?.getIdToken();
                        if (token) {
                            try {
                                const res = await fetch('/api/updateUserRole', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                    body: JSON.stringify({ authUid: employeeData.authUid, newRole: formData.role || 'mitarbeiter' })
                                });
                                if (!res.ok) console.warn('Online Role Update failed on Backend');
                            } catch (err) {
                                console.error('Update Role Network Err:', err);
                            }
                        }
                    }
                }

                // E-Mail / Password Update
                if (formData.email !== employeeData.email || formData.password) {
                    if (import.meta.env.DEV) {
                        throw new Error("Auth-Update geht aus Sicherheitsgründen nur auf der Live-Version via Admin SDK. Bitte pushen und live testen.");
                    } else {
                        const token = await currentUser?.getIdToken();
                        if (token) {
                            try {
                                const authPayload: any = { authUid: employeeData.authUid };
                                if (formData.email !== employeeData.email) authPayload.email = actualEmail;
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
            const docRef = doc(db, 'apps', APP_ID, 'employees', id);

            const savePayload: any = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                role: formData.role,
                position: formData.position,
                status: formData.status,
                address: formData.address || '',
                phone: formData.phone || '',
                email: formData.email || '',
                updatedAt: serverTimestamp(),
            };

            // Remove plaintext password, use a flag to force change
            if (isNew) {
                // Ensure password requires change since we used a default password
                savePayload.password = 'temp_needs_change';
            }

            if (finalAuthUid) {
                savePayload.authUid = finalAuthUid;
            }

            await setDoc(docRef, savePayload, { merge: true });

            setIsFormOpen(false);
            if (isNew) {
                toast.success(`Mitarbeiter erfolgreich angelegt. Standardpasswort: Start1234! (Benutzer muss es beim 1. Login ändern)`);
            } else {
                toast.success('Mitarbeiter erfolgreich gespeichert.');
            }
        } catch (error: any) {
            console.error('Error saving employee:', error);
            toast.error(error.message || 'Fehler beim Speichern.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DashboardShell title="Mitarbeiter">
            <div className="mb-6 flex justify-between items-center">
                <p className="text-gray-500">Verwalten Sie hier alle Mitarbeiter, die auf den Bauberichten erfasst werden können.</p>
                {(userRole === 'admin' || userRole === 'vorarbeiter') && (
                    <button
                        onClick={handleAddNew}
                        className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 shadow-sm"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Neuer Mitarbeiter
                    </button>
                )}
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
                        <div className="fixed inset-0 transition-opacity bg-black bg-opacity-75" onClick={() => setIsFormOpen(false)} />
                        
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

                        <div className="inline-block w-full max-w-3xl overflow-hidden text-left align-bottom transition-all transform bg-white rounded-xl shadow-xl sm:my-8 sm:align-middle">
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                                <h3 className="text-lg font-medium text-gray-900">{editingId ? 'Mitarbeiter bearbeiten' : 'Neuen Mitarbeiter anlegen'}</h3>
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
                                        <label className="block text-sm font-medium text-gray-700">Adresse</label>
                                        <input
                                            type="text"
                                            name="address"
                                            value={formData.address || ''}
                                            onChange={handleChange}
                                            placeholder="Straße, Hausnummer, PLZ Ort"
                                            className="input-premium"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                                        <div className="phone-premium-container">
                                            <PhoneInput
                                                country={'at'}
                                                preferredCountries={['at', 'de', 'ch']}
                                                value={formData.phone || ''}
                                                onChange={(phone) => setFormData({ ...formData, phone })}
                                                containerClass="w-full"
                                                inputClass="!w-full !h-[42px] !pl-12 !pr-4 !bg-gray-50/50 focus:!bg-white !border !border-gray-200 focus:!border-brand-primary focus:!ring-2 focus:!ring-brand-primary/20 !rounded-xl !text-sm !font-medium !text-gray-900 !transition-all hover:!border-gray-300"
                                                buttonClass="!bg-transparent !border-none !rounded-l-xl !pl-3"
                                                dropdownClass="!rounded-xl !border-gray-100 !shadow-xl"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Position (Berufsbild)</label>
                                        <CustomSelect
                                            value={formData.position || ''}
                                            onChange={(value) => setFormData({ ...formData, position: value })}
                                            placeholder="- Bitte wählen -"
                                            options={[
                                                { value: 'Vorarbeiter', label: 'Vorarbeiter' },
                                                { value: 'Hilfsarbeiter', label: 'Hilfsarbeiter' },
                                                { value: 'Facharbeiter', label: 'Facharbeiter' },
                                                { value: 'Ausführender', label: 'Ausführender' }
                                            ]}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Benutzername / E-Mail</label>
                                        <input
                                            type="text"
                                            name="email"
                                            value={formData.email || ''}
                                            onChange={handleChange}
                                            placeholder="z.B. klaus oder klaus@firma.at"
                                            className="input-premium"
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
                                    {(userRole === 'admin') && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">System-Rolle (Zugriff)</label>
                                            <CustomSelect
                                                value={formData.role || ''}
                                                onChange={(value) => setFormData({ ...formData, role: value })}
                                                placeholder="- Kein Login -"
                                                options={[
                                                    { value: 'admin', label: 'Administrator (Bauleiter)' },
                                                    { value: 'vorarbeiter', label: 'Vorarbeiter' },
                                                    { value: 'mitarbeiter', label: 'Mitarbeiter' }
                                                ]}
                                            />
                                        </div>
                                    )}
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
                        Aktive Mitarbeiter
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
                ) : employees.filter(e => activeTab === 'archived' ? (e.status === 'archived' || e.active === false) : (e.status === 'active' || (!e.status && e.active !== false))).length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        Keine Mitarbeiter gefunden.
                    </div>
                ) : (
                    <div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">System-Rolle</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Aktionen</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {(() => {
                                    const filteredEmployees = employees.filter(e => activeTab === 'archived' ? (e.status === 'archived' || e.active === false) : (e.status === 'active' || (!e.status && e.active !== false)));
                                    const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
                                    const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                                    
                                    return paginatedEmployees.map((employee) => {
                                        const isArchived = employee.status === 'archived' || employee.active === false;
                                        return (
                                            <tr key={employee.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">{employee.lastName}, {employee.firstName}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {employee.position || (['Vorarbeiter', 'Hilfsarbeiter', 'Facharbeiter', 'Ausführender', 'VA', 'HA', 'FA'].includes(employee.role) ? 
                                                        (employee.role === 'VA' ? 'Vorarbeiter' : employee.role === 'HA' ? 'Hilfsarbeiter' : employee.role === 'FA' ? 'Facharbeiter' : employee.role) 
                                                        : '-')}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <span className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-md ${
                                                        employee.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                                        employee.role === 'vorarbeiter' ? 'bg-brand-primary/10 text-brand-primary' :
                                                        employee.role === 'mitarbeiter' ? 'bg-gray-100 text-gray-800' :
                                                        'bg-gray-50 text-gray-500'
                                                    }`}>
                                                        {ROLE_MAP[employee.role] || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${!isArchived ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                        {!isArchived ? 'Aktiv' : 'Archiviert'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    {(userRole === 'admin' || userRole === 'vorarbeiter') && (
                                                        <button
                                                            onClick={() => handleEdit(employee)}
                                                            className="text-brand-primary hover:text-brand-primary/80 mr-4"
                                                            title="Bearbeiten"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {(userRole === 'admin' || userRole === 'vorarbeiter') && (
                                                        <button
                                                            onClick={() => handleDeleteClick(employee)}
                                                            className="text-red-600 hover:text-red-900"
                                                            title="Löschen / Archivieren"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                            </table>
                        </div>
                        {(() => {
                            const filteredCount = employees.filter(e => activeTab === 'archived' ? (e.status === 'archived' || e.active === false) : (e.status === 'active' || (!e.status && e.active !== false))).length;
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

            <ConfirmDeleteModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setItemToDelete(null);
                }}
                onConfirm={executeDeleteAdmin}
                title="Mitarbeiter löschen"
                itemName={itemToDelete?.name || ''}
            />
        </DashboardShell>
    );
};
