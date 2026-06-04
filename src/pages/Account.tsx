import React, { useEffect, useState, useRef } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db, storage, APP_ID } from '../lib/firebase';
import { updatePassword, updateProfile } from 'firebase/auth';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { User, Phone, Mail, MapPin, Briefcase, Shield, Camera, Loader2, Save, X, Lock, Edit2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { PhoneInputPremium } from '../components/PhoneInputPremium';

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
}

export const Account: React.FC = () => {
    const { currentUser, userRole, userCollection, employeeId, setEmployeeName } = useAuth();
    const [employeeData, setEmployeeData] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(true);

    // Edit states
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);

    // Password states
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Image states
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!currentUser || !userCollection || !employeeId) {
                setLoading(false);
                return;
            }
            
            try {
                const docRef = doc(db, 'apps', APP_ID, userCollection, employeeId);
                const snapshot = await getDoc(docRef);
                
                if (snapshot.exists()) {
                    const data = snapshot.data() as Employee;
                    data.id = snapshot.id;
                    setEmployeeData(data);
                    
                    setFirstName(data.firstName || '');
                    setLastName(data.lastName || '');
                    setPhone(data.phone || '');
                    setAddress(data.address || '');
                }
            } catch (err) {
                console.error("Error fetching account data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [currentUser, userCollection, employeeId]);

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        
        const targetCollection = userCollection || (userRole === 'admin' ? 'managers' : 'employees');
        const targetId = employeeData?.id || employeeId;
        
        setSavingProfile(true);
        try {
            if (targetId) {
                const empRef = doc(db, 'apps', APP_ID, targetCollection, targetId);
                await updateDoc(empRef, {
                    firstName,
                    lastName,
                    phone,
                    address
                });
                if (employeeData) {
                    setEmployeeData({ ...employeeData, firstName, lastName, phone, address });
                } else {
                    setEmployeeData({ id: targetId, firstName, lastName, phone, address, role: userRole || 'admin', authUid: currentUser.uid });
                }
                
                await updateProfile(currentUser, { displayName: `${firstName} ${lastName}`.trim() });
                setEmployeeName(`${firstName} ${lastName}`.trim());
                
            } else {
                // First-time bootstrap for admin who doesn't have a document yet
                const newDocRef = doc(collection(db, 'apps', APP_ID, targetCollection));
                const newData = {
                    authUid: currentUser.uid,
                    role: userRole || 'admin',
                    firstName,
                    lastName,
                    phone,
                    address,
                    email: currentUser.email,
                    active: true,
                    status: 'active'
                };
                await setDoc(newDocRef, newData);
                setEmployeeData({ id: newDocRef.id, ...newData } as Employee);
                
                await updateProfile(currentUser, { displayName: `${firstName} ${lastName}`.trim() });
                setEmployeeName(`${firstName} ${lastName}`.trim());
            }
            
            toast.success('Profil erfolgreich aktualisiert');
            setIsEditingProfile(false);
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.error('Fehler beim Aktualisieren des Profils');
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        if (newPassword !== confirmPassword) {
            toast.error('Die Passwörter stimmen nicht überein');
            return;
        }

        if (newPassword.length < 6) {
            toast.error('Das Passwort muss mindestens 6 Zeichen lang sein');
            return;
        }

        setSavingPassword(true);
        try {
            await updatePassword(currentUser, newPassword);
            toast.success('Passwort erfolgreich geändert');
            setIsChangingPassword(false);
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            console.error("Error updating password:", error);
            if (error.code === 'auth/requires-recent-login') {
                toast.error('Bitte loggen Sie sich aus und erneut ein, um das Passwort zu ändern.');
            } else {
                toast.error('Fehler beim Ändern des Passworts');
            }
        } finally {
            setSavingPassword(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentUser) return;

        if (fileInputRef.current) fileInputRef.current.value = '';

        setUploadingImage(true);
        try {
            const filename = `${Date.now()}_${file.name}`;
            const storagePath = `users/${currentUser.uid}/profile/${filename}`;
            const storageRef = ref(storage, storagePath);

            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed', 
                null, 
                (error) => {
                    console.error("Upload error", error);
                    toast.error('Fehler beim Hochladen des Bildes');
                    setUploadingImage(false);
                }, 
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    await updateProfile(currentUser, { photoURL: downloadURL });
                    toast.success('Profilbild erfolgreich aktualisiert');
                    setUploadingImage(false);
                }
            );
        } catch (error) {
            console.error("Error preparing upload:", error);
            setUploadingImage(false);
            toast.error('Fehler beim Vorbereiten des Uploads');
        }
    };

    const initials = employeeData ? `${employeeData.firstName.charAt(0)}${employeeData.lastName.charAt(0)}` : (currentUser?.email ? currentUser.email.substring(0, 2).toUpperCase() : 'ME');

    return (
        <DashboardShell title="Mein Konto">
            <div className="max-w-5xl mx-auto space-y-6 mt-2">
                
                {/* Profile Header */}
                <div className="relative overflow-hidden rounded-2xl bg-white p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-8">
                    <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-brand-primary/5 rounded-full blur-3xl"></div>
                    
                    {/* Avatar Upload */}
                    <div className="relative z-10 group">
                        <div className="w-28 h-28 rounded-full border-4 border-white shadow-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-4xl font-bold text-gray-400 overflow-hidden relative">
                            {currentUser?.photoURL ? (
                                <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <span>{initials}</span>
                            )}
                            
                            {/* Hover Overlay */}
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingImage}
                                className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100 disabled:bg-black/40 rounded-full"
                            >
                                {uploadingImage ? (
                                    <Loader2 className="w-6 h-6 text-white animate-spin mb-1" />
                                ) : (
                                    <Camera className="w-6 h-6 text-white mb-1" />
                                )}
                                <span className="text-[9px] font-bold text-white tracking-widest uppercase">
                                    {uploadingImage ? 'LÄDT...' : 'BILD HOCHLADEN'}
                                </span>
                            </button>
                        </div>
                        <input 
                            type="file" 
                            accept="image/*" 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                            className="hidden" 
                        />
                    </div>
                    
                    {/* User Info Title */}
                    <div className="relative z-10 text-center md:text-left">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            {employeeData ? `${employeeData.firstName} ${employeeData.lastName}` : (currentUser?.displayName || 'Mein Konto')}
                        </h1>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                            <span className="px-4 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-sm font-medium text-gray-700 flex items-center gap-2 shadow-sm">
                                <Shield className="w-4 h-4 text-brand-primary" />
                                {userRole === 'admin' ? 'Administrator' : userRole === 'vorarbeiter' ? 'Vorarbeiter' : 'Mitarbeiter'}
                            </span>
                            {employeeData?.position && (
                                <span className="px-4 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full text-sm font-medium text-emerald-700 flex items-center gap-2 shadow-sm">
                                    <Briefcase className="w-4 h-4" />
                                    {employeeData.position}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Personal Details Card */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm relative overflow-hidden">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                    <User className="w-5 h-5 mr-2 text-brand-primary" />
                                    Persönliche Daten
                                </h3>
                                {!isEditingProfile ? (
                                    <button 
                                        key="btn-edit"
                                        onClick={() => setIsEditingProfile(true)}
                                        className="text-sm font-semibold text-brand-primary hover:text-red-700 flex items-center transition-colors"
                                    >
                                        <Edit2 className="w-4 h-4 mr-1" />
                                        Bearbeiten
                                    </button>
                                ) : (
                                    <button 
                                        key="btn-cancel"
                                        onClick={() => {
                                            setIsEditingProfile(false);
                                            // Reset fields
                                            if (employeeData) {
                                                setFirstName(employeeData.firstName || '');
                                                setLastName(employeeData.lastName || '');
                                                setPhone(employeeData.phone || '');
                                                setAddress(employeeData.address || '');
                                            }
                                        }}
                                        className="text-sm font-semibold text-gray-500 hover:text-gray-700 flex items-center transition-colors"
                                    >
                                        <X className="w-4 h-4 mr-1" />
                                        Abbrechen
                                    </button>
                                )}
                            </div>

                            {isEditingProfile ? (
                                <form key="edit-profile-form" onSubmit={handleProfileUpdate} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Vorname</label>
                                            <input 
                                                type="text" 
                                                value={firstName} 
                                                onChange={e => setFirstName(e.target.value)}
                                                className="input-premium"
                                                placeholder="Max"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nachname</label>
                                            <input 
                                                type="text" 
                                                value={lastName} 
                                                onChange={e => setLastName(e.target.value)}
                                                className="input-premium"
                                                placeholder="Mustermann"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Telefonnummer</label>
                                        <PhoneInputPremium 
                                            value={phone} 
                                            onChange={setPhone} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                                        <input 
                                            type="text" 
                                            value={address} 
                                            onChange={e => setAddress(e.target.value)}
                                            className="input-premium"
                                            placeholder="Musterstraße 1, 12345 Stadt"
                                        />
                                    </div>
                                    <div className="pt-2">
                                        <button 
                                            type="submit" 
                                            disabled={savingProfile}
                                            className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 focus:ring-4 focus:ring-brand-primary/30 transition-all disabled:opacity-50 uppercase tracking-wider"
                                        >
                                            {savingProfile ? <Loader2 key="loader" className="w-4 h-4 mr-2 animate-spin" /> : <Save key="save" className="w-4 h-4 mr-2" />}
                                            <span>ÄNDERUNGEN SPEICHERN</span>
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div key="view-profile-data" className="space-y-5">
                                    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">Voller Name</p>
                                            <p className="text-sm font-medium text-gray-900">{employeeData?.firstName} {employeeData?.lastName}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm">
                                            <Phone className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">Telefonnummer</p>
                                            <p className="text-sm font-medium text-gray-900">{employeeData?.phone || 'Nicht angegeben'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm">
                                            <MapPin className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">Adresse</p>
                                            <p className="text-sm font-medium text-gray-900">{employeeData?.address || 'Nicht angegeben'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm">
                                            <Mail className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">E-Mail Adresse (Nicht änderbar)</p>
                                            <p className="text-sm font-medium text-gray-900">{employeeData?.email || currentUser?.email || 'Nicht angegeben'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Security Card */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm relative overflow-hidden">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                    <Lock className="w-5 h-5 mr-2 text-gray-700" />
                                    Sicherheit
                                </h3>
                            </div>

                            {!isChangingPassword ? (
                                <div key="view-password-prompt" className="flex flex-col items-center justify-center py-8 text-center">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                                        <Shield className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
                                        Schützen Sie Ihr Konto durch ein starkes Passwort. Sie können Ihr Passwort jederzeit ändern.
                                    </p>
                                    <button 
                                        onClick={() => setIsChangingPassword(true)}
                                        className="py-2.5 px-6 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm uppercase tracking-wider"
                                    >
                                        PASSWORT ÄNDERN
                                    </button>
                                </div>
                            ) : (
                                <form key="edit-password-form" onSubmit={handlePasswordChange} className="space-y-4">
                                    <div className="p-4 bg-brand-primary/5 border border-brand-primary/10 rounded-xl mb-4">
                                        <p className="text-xs text-brand-primary font-medium flex items-start gap-2">
                                            <Lock className="w-4 h-4 shrink-0" />
                                            Geben Sie ein neues Passwort mit mindestens 6 Zeichen ein.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
                                        <div className="relative">
                                            <input 
                                                type={showNewPassword ? "text" : "password"}
                                                value={newPassword} 
                                                onChange={e => setNewPassword(e.target.value)}
                                                className="input-premium pr-12"
                                                placeholder="••••••••"
                                                required
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-primary transition-colors focus:outline-none"
                                            >
                                                {showNewPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen</label>
                                        <div className="relative">
                                            <input 
                                                type={showConfirmPassword ? "text" : "password"}
                                                value={confirmPassword} 
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                className="input-premium pr-12"
                                                placeholder="••••••••"
                                                required
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-primary transition-colors focus:outline-none"
                                            >
                                                {showConfirmPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="pt-2 flex gap-3">
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                setIsChangingPassword(false);
                                                setNewPassword('');
                                                setConfirmPassword('');
                                            }}
                                            disabled={savingPassword}
                                            className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-all"
                                        >
                                            Abbrechen
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={savingPassword}
                                            className="flex-1 flex justify-center items-center py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 focus:ring-4 focus:ring-brand-primary/30 transition-all disabled:opacity-50 uppercase tracking-wider"
                                        >
                                            {savingPassword ? <Loader2 key="loader" className="w-4 h-4 mr-2 animate-spin" /> : <Save key="save" className="w-4 h-4 mr-2" />}
                                            <span>PASSWORT ÄNDERN</span>
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </DashboardShell>
    );
};
