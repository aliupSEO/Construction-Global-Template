import React, { useState, useEffect, useRef } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { FileText, CalendarDays, Camera, X, UploadCloud, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db, storage, APP_ID } from '../lib/firebase';
import { collection, query, where, onSnapshot, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';

interface Baustelle {
    id: string;
    name: string;
    status?: string;
}

export const Dashboard = () => {
    const [sites, setSites] = useState<Baustelle[]>([]);
    
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
            <div className="flex flex-col gap-6 mt-2 max-w-4xl">
                
                {/* Schnell Foto Card */}
                <button
                    onClick={() => setIsPhotoModalOpen(true)}
                    className="group bg-white rounded-xl shadow-sm border-l-4 border-l-red-500 border-t border-b border-r border-gray-100 p-6 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center text-left"
                >
                    <div className="flex items-center">
                        <div className="p-4 rounded-full bg-red-50 text-red-600 mr-4 group-hover:scale-110 transition-transform">
                            <Camera className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Schnelles Foto aufnehmen</h3>
                            <p className="text-sm text-gray-500 mt-1">Direkt ein Foto für eine Baustelle dokumentieren.</p>
                        </div>
                    </div>
                </button>

                {/* Tagesbericht Card */}
                <Link
                    to="/daily-reports/new"
                    className="group bg-white rounded-xl shadow-sm border-l-4 border-l-blue-500 border-t border-b border-r border-gray-100 p-6 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between"
                >
                    <div className="flex items-center mb-4 sm:mb-0">
                        <div className="p-4 rounded-full bg-blue-50 text-blue-600 mr-4 group-hover:scale-110 transition-transform">
                            <FileText className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Neuer Tagesbericht</h3>
                            <p className="text-sm text-gray-500 mt-1">Leistungen, Material und Wetter für einen Tag erfassen.</p>
                        </div>
                    </div>
                    <div className="bg-blue-50 text-blue-700 px-8 py-3 rounded-lg font-medium text-center w-full sm:w-auto group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        Starten
                    </div>
                </Link>

                {/* Wochenbericht Card */}
                <Link
                    to="/weekly-reports/new"
                    className="group bg-white rounded-xl shadow-sm border-l-4 border-l-green-500 border-t border-b border-r border-gray-100 p-6 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between"
                >
                    <div className="flex items-center mb-4 sm:mb-0">
                        <div className="p-4 rounded-full bg-green-50 text-green-600 mr-4 group-hover:scale-110 transition-transform">
                            <CalendarDays className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Neuer Wochenbericht</h3>
                            <p className="text-sm text-gray-500 mt-1">Stundennachweise für die gesamte Woche anlegen.</p>
                        </div>
                    </div>
                    <div className="bg-green-50 text-green-700 px-8 py-3 rounded-lg font-medium text-center w-full sm:w-auto group-hover:bg-green-600 group-hover:text-white transition-colors">
                        Starten
                    </div>
                </Link>
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
                                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-gray-900 bg-white"
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
                                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-gray-900"
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
