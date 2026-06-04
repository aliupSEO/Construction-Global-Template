import React, { useState, useEffect, useRef } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { FileText, CalendarDays, Camera, X, UploadCloud, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db, storage, APP_ID } from '../lib/firebase';
import { collection, query, where, onSnapshot, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../contexts/AuthContext';

interface Baustelle {
    id: string;
    name: string;
    status?: string;
}

export const Dashboard = () => {
    const { currentUser, userRole, employeeName } = useAuth();
    const [sites, setSites] = useState<Baustelle[]>([]);

    const today = new Date().toLocaleDateString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Photo Modal States
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [selectedSiteId, setSelectedSiteId] = useState('');
    const [photoTitle, setPhotoTitle] = useState('');
    const [pendingFiles, setPendingFiles] = useState<{file: File, url: string}[]>([]);
    
    const [uploading, setUploading] = useState(false);
    const [uploadPhase, setUploadPhase] = useState<'compressing' | 'uploading' | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [successMsg, setSuccessMsg] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const q = query(collection(db, 'apps', APP_ID, 'baustellen'));
        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Baustelle));
            setSites(data.filter(s => s.status !== 'archived'));
        });
        return () => unsub();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList || fileList.length === 0) return;
        const files = Array.from(fileList);

        if (!selectedSiteId) {
            alert('Bitte wähle zuerst eine Baustelle aus.');
            return;
        }

        const newPending = files.map(f => ({ file: f, url: URL.createObjectURL(f) }));
        setPendingFiles(prev => [...prev, ...newPending]);

        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const handleConfirmUpload = async () => {
        if (pendingFiles.length === 0) return;
        if (!selectedSiteId) {
            alert('Bitte wähle zuerst eine Baustelle aus.');
            return;
        }

        setUploading(true);
        setUploadPhase('compressing');
        setUploadProgress(0);
        setSuccessMsg('');

        let location = null;
        if (navigator.geolocation) {
            try {
                location = await new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                        (err) => resolve(null),
                        { timeout: 5000, enableHighAccuracy: true, maximumAge: 10000 }
                    );
                });
            } catch (err) {}
        }

        try {
            const options = {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 1920,
                useWebWorker: false
            };

            let activityId = null;
            const finalTitle = photoTitle.trim();
            
            if (finalTitle) {
                const reqQ = query(
                    collection(db, 'apps', APP_ID, 'site_activities'), 
                    where('siteId', '==', selectedSiteId),
                    where('name', '==', finalTitle)
                );
                const snap = await getDocs(reqQ);
                if (!snap.empty) {
                    activityId = snap.docs[0].id;
                } else {
                    const newActRef = await addDoc(collection(db, 'apps', APP_ID, 'site_activities'), {
                        siteId: selectedSiteId,
                        name: finalTitle,
                        status: 'active',
                        createdAt: serverTimestamp()
                    });
                    activityId = newActRef.id;
                }
            }

            const totalFiles = pendingFiles.length;
            let uploadedCount = 0;

            for (let i = 0; i < totalFiles; i++) {
                const { file } = pendingFiles[i];
                
                setUploadPhase('compressing');
                const compressedFile = await imageCompression(file, options);
                
                setUploadPhase('uploading');
                const filename = `${Date.now()}_${compressedFile.name}`;
                const storagePath = `apps/${APP_ID}/sites/${selectedSiteId}/photos/general/${filename}`;
                const storageRef = ref(storage, storagePath);

                const uploadTask = uploadBytesResumable(storageRef, compressedFile);

                await new Promise((resolve, reject) => {
                    uploadTask.on('state_changed', 
                        (snapshot) => {
                            const currentFileProgress = snapshot.bytesTransferred / snapshot.totalBytes;
                            const overallProgress = ((uploadedCount + currentFileProgress) / totalFiles) * 100;
                            setUploadProgress(Math.round(overallProgress));
                        }, 
                        (error) => reject(error), 
                        async () => {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            await addDoc(collection(db, 'apps', APP_ID, 'site_photos'), {
                                siteId: selectedSiteId,
                                url: downloadURL,
                                type: 'general',
                                filename,
                                location: location || null,
                                activityId: activityId,
                                createdAt: serverTimestamp()
                            });
                            uploadedCount++;
                            resolve(null);
                        }
                    );
                });
            }

            setUploading(false);
            setUploadPhase(null);
            setUploadProgress(0);
            setPhotoTitle('');
            
            pendingFiles.forEach(pf => URL.revokeObjectURL(pf.url));
            setPendingFiles([]);

            const msg = totalFiles > 1 ? `${totalFiles} Fotos erfolgreich gespeichert!` : 'Foto erfolgreich gespeichert!';
            setSuccessMsg(msg);
            
            setTimeout(() => {
                setSuccessMsg('');
                setIsPhotoModalOpen(false);
            }, 2500);

        } catch (error) {
            console.error("Verarbeitung abgebrochen", error);
            alert("Fehler bei der Bildverarbeitung");
            setUploading(false);
            setUploadPhase(null);
        }
    };

    const triggerCamera = () => {
        if (!selectedSiteId) {
            alert('Bitte zuerst eine Baustelle wählen.');
            return;
        }
        if (cameraInputRef.current) {
            cameraInputRef.current.click();
        }
    };

    const triggerUpload = () => {
        if (!selectedSiteId) {
            alert('Bitte zuerst eine Baustelle wählen.');
            return;
        }
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    return (
        <DashboardShell title="Dashboard">
            <div className="max-w-6xl space-y-8 mt-2">
                
                {/* Welcome Banner */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary/10 to-brand-primary/5 p-8 border border-brand-primary/20 shadow-sm">
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-brand-primary/10 rounded-full blur-3xl"></div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                                Willkommen zurück{employeeName ? `, ${employeeName}` : (currentUser?.email ? `, ${currentUser.email.split('@')[0]}` : '')}!
                            </h2>
                            <p className="text-gray-600">
                                {today}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Schnell Foto Card */}
                    <button
                        onClick={() => setIsPhotoModalOpen(true)}
                        className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 overflow-hidden text-left flex flex-col h-full"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        <div className="p-6 md:p-8 flex-1 flex flex-col relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center mb-6 shadow-md shadow-red-500/20 group-hover:scale-110 transition-transform duration-300">
                                <Camera className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Schnelles Foto</h3>
                            <p className="text-gray-500 leading-relaxed flex-1">Direkt ein Foto für eine Baustelle dokumentieren.</p>
                            
                            <div className="mt-6 flex items-center text-red-600 font-semibold group-hover:gap-2 transition-all">
                                <span>Aufnehmen</span>
                                <span className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ml-1">→</span>
                            </div>
                        </div>
                    </button>

                    {/* Tagesbericht Card */}
                    <Link
                        to="/daily-reports/new"
                        className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 overflow-hidden flex flex-col h-full"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl -mr-10 -mt-10 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        <div className="p-6 md:p-8 flex-1 flex flex-col relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary to-red-700 text-white flex items-center justify-center mb-6 shadow-md shadow-brand-primary/20 group-hover:scale-110 transition-transform duration-300">
                                <FileText className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Tagesbericht</h3>
                            <p className="text-gray-500 leading-relaxed flex-1">Leistungen, Material und Wetter für einen Tag erfassen.</p>
                            
                            <div className="mt-6 flex items-center text-brand-primary font-semibold group-hover:gap-2 transition-all">
                                <span>Starten</span>
                                <span className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ml-1">→</span>
                            </div>
                        </div>
                    </Link>

                    {/* Wochenbericht Card */}
                    <Link
                        to="/weekly-reports/new"
                        className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 overflow-hidden flex flex-col h-full"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        <div className="p-6 md:p-8 flex-1 flex flex-col relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center mb-6 shadow-md shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
                                <CalendarDays className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Wochenbericht</h3>
                            <p className="text-gray-500 leading-relaxed flex-1">Stundennachweise für die gesamte Woche anlegen.</p>
                            
                            <div className="mt-6 flex items-center text-emerald-600 font-semibold group-hover:gap-2 transition-all">
                                <span>Starten</span>
                                <span className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ml-1">→</span>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Quick Photo Modal */}
            <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                multiple
            />
            <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                ref={cameraInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                multiple
            />

            {isPhotoModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => {
                            if (!uploading) {
                                pendingFiles.forEach(pf => URL.revokeObjectURL(pf.url));
                                setPendingFiles([]);
                                setIsPhotoModalOpen(false);
                            }
                        }}
                    ></div>
                    
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                <Camera className="w-5 h-5 mr-2 text-brand-primary" />
                                Schnelles Foto
                            </h2>
                            {!uploading && (
                                <button 
                                    onClick={() => {
                                        pendingFiles.forEach(pf => URL.revokeObjectURL(pf.url));
                                        setPendingFiles([]);
                                        setIsPhotoModalOpen(false);
                                    }}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        <div className="p-6">
                            {successMsg ? (
                                <div className="py-8 flex flex-col items-center justify-center text-green-600 space-y-4">
                                    <CheckCircle className="w-16 h-16" />
                                    <h3 className="text-xl font-bold text-center">{successMsg}</h3>
                                    <p className="text-sm text-green-700 text-center">Das Fenster schließt sich automatisch...</p>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                            Baustelle auswählen <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={selectedSiteId}
                                            onChange={(e) => setSelectedSiteId(e.target.value)}
                                            disabled={uploading}
                                            className="input-premium appearance-none"
                                        >
                                            <option value="">-- Bitte wählen --</option>
                                            {sites.map(site => (
                                                <option key={site.id} value={site.id}>{site.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                            Tätigkeit / Titel eingeben (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={photoTitle}
                                            onChange={(e) => setPhotoTitle(e.target.value)}
                                            disabled={uploading}
                                            placeholder="z.B. Betonieren, Fliesen verlegen..."
                                            className="input-premium"
                                        />
                                    </div>

                                    {pendingFiles.length > 0 && !uploading && !successMsg && (
                                        <div className="mt-4">
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                Ausgewählte Fotos ({pendingFiles.length})
                                            </label>
                                            <div className="grid grid-cols-4 gap-2">
                                                {pendingFiles.map((p, index) => (
                                                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                                                        <img src={p.url} alt={`preview ${index}`} className="w-full h-full object-cover" />
                                                        <button 
                                                            type="button" 
                                                            onClick={() => {
                                                                URL.revokeObjectURL(p.url);
                                                                setPendingFiles(prev => prev.filter((_, i) => i !== index));
                                                            }}
                                                            className="absolute top-1 right-1 bg-white/80 text-red-500 hover:bg-red-500 hover:text-white p-1 rounded-full shadow transition-colors"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {uploading ? (
                                        <div className="mt-8 p-5 bg-brand-primary/5 border border-brand-primary/20 rounded-xl flex flex-col items-center justify-center gap-3">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                                            <span className="font-medium text-brand-primary text-center mt-2">
                                                {uploadPhase === 'compressing' ? 'Bild wird optimiert...' : 'Wird hochgeladen...'}
                                            </span>
                                            {uploadPhase === 'uploading' && (
                                                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                                                    <div className="bg-brand-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="mt-8 pt-4 flex flex-col gap-3">
                                            {pendingFiles.length > 0 ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={handleConfirmUpload}
                                                        className="w-full flex justify-center items-center font-bold bg-green-500 text-white py-3.5 px-4 rounded-xl hover:bg-green-600 transition-all shadow-md"
                                                    >
                                                        <CheckCircle className="w-5 h-5 mr-2" />
                                                        {pendingFiles.length} Foto{pendingFiles.length > 1 ? 's' : ''} hochladen
                                                    </button>
                                                    <div className="flex gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={triggerUpload}
                                                            className="flex-1 flex justify-center items-center font-bold bg-brand-primary/10 text-brand-primary py-2 px-2 rounded-xl hover:bg-brand-primary/20 transition-all text-sm"
                                                        >
                                                            <UploadCloud className="w-4 h-4 mr-1.5" />
                                                            Weitere
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={triggerCamera}
                                                            className="flex-1 flex justify-center items-center font-bold bg-brand-primary/10 text-brand-primary py-2 px-2 rounded-xl hover:bg-brand-primary/20 transition-all text-sm"
                                                        >
                                                            <Camera className="w-4 h-4 mr-1.5" />
                                                            Kamera
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col gap-3 sm:flex-row">
                                                    <button
                                                        type="button"
                                                        onClick={triggerUpload}
                                                        disabled={!selectedSiteId}
                                                        className="w-full sm:flex-1 flex justify-center items-center font-bold bg-brand-primary/10 text-brand-primary py-3.5 px-4 rounded-xl hover:bg-brand-primary/20 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <UploadCloud className="w-5 h-5 mr-2" />
                                                        Aussuchen
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={triggerCamera}
                                                        disabled={!selectedSiteId}
                                                        className="w-full sm:flex-1 flex justify-center items-center font-bold bg-brand-primary text-white py-3.5 px-4 rounded-xl hover:bg-brand-primary/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <Camera className="w-5 h-5 mr-2" />
                                                        Aufnehmen
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </DashboardShell>
    );
};
