import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Loader2, Trash2, Upload } from 'lucide-react';
import { db, storage, APP_ID } from '../lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface SitePhotoModalProps {
    isOpen: boolean;
    onClose: () => void;
    siteId: string;
    siteName: string;
}

export const SitePhotoModal = ({ isOpen, onClose, siteId, siteName }: SitePhotoModalProps) => {
    const [photos, setPhotos] = useState<any[]>([]);
    const [uploadingType, setUploadingType] = useState<'before' | 'after' | null>(null);
    const fileInputUploadRef = useRef<HTMLInputElement>(null);
    const fileInputCaptureRef = useRef<HTMLInputElement>(null);
    const [currentType, setCurrentType] = useState<'before' | 'after'>('before');
    const { userRole } = useAuth();
    
    // Delete Modal State
    const [photoToDelete, setPhotoToDelete] = useState<any | null>(null);

    useEffect(() => {
        if (!isOpen || !siteId) return;
        
        // Ensure index exists for siteId + createdAt, or remove orderBy if failing initially.
        // If sorting fails, we'll sort client-side as fallback.
        const q = query(
            collection(db, 'apps', APP_ID, 'baustellen_fotos'),
            where('siteId', '==', siteId)
        );
        
        const unsubscribe = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            data.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
            });
            setPhotos(data);
        });
        
        return () => unsubscribe();
    }, [isOpen, siteId]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (files.length === 0) return;

        setUploadingType(currentType);
        
        let successCount = 0;
        let errorCount = 0;

        const loadingToast = toast.loading(`${files.length} Foto(s) werden hochgeladen...`);

        try {
            for (const file of files) {
                try {
                    let fileToUpload = file;
                    // Attempt compression
                    try {
                        const options = {
                            maxSizeMB: 0.5,
                            maxWidthOrHeight: 1920,
                            useWebWorker: true
                        };
                        fileToUpload = await imageCompression(file, options);
                    } catch (compressionError) {
                        console.warn("Komprimierung fehlgeschlagen, lade Originalbild hoch. Fehler:", compressionError);
                        // Fallback to uncompressed file
                    }

                    // Upload fallback to Firebase Storage
                    const ext = file.name.split('.').pop() || 'jpg';
                    const fileName = `${currentType}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
                    const storageRef = ref(storage, `apps/${APP_ID}/sites/${siteId}/photos/${fileName}`); // Scope correctly
                    await uploadBytes(storageRef, fileToUpload);
                    const url = await getDownloadURL(storageRef);

                    // Speichern in Firestore
                    await addDoc(collection(db, 'apps', APP_ID, 'baustellen_fotos'), {
                        siteId,
                        type: currentType,
                        url,
                        fileName,
                        createdAt: serverTimestamp() // Save created timestamp
                    });
                    
                    successCount++;
                } catch (err: any) {
                    console.error("Upload Fehler für Datei:", file.name, err);
                    
                    // Loggen wir den Fehler als System-Log 
                    try {
                        await addDoc(collection(db, 'apps', APP_ID, 'system_logs'), {
                            error: err.message,
                            context: 'SitePhotoModal Upload Fehler',
                            fileName: file.name,
                            timestamp: serverTimestamp()
                        });
                    } catch(e) {}
                    
                    errorCount++;
                }
            }

            if (successCount > 0 && errorCount === 0) {
                toast.success(`${successCount} Foto(s) erfolgreich hochgeladen!`, { id: loadingToast });
            } else if (successCount > 0 && errorCount > 0) {
                toast.error(`${successCount} Foto(s) hochgeladen, ${errorCount} fehlgeschlagen.`, { id: loadingToast });
            } else {
                toast.error(`Fehler beim Hochladen der Fotos. Bitte erneut versuchen.`, { id: loadingToast });
            }

        } finally {
            setUploadingType(null);
            if (fileInputUploadRef.current) fileInputUploadRef.current.value = '';
            if (fileInputCaptureRef.current) fileInputCaptureRef.current.value = '';
        }
    };

    const triggerUpload = (type: 'before' | 'after') => {
        setCurrentType(type);
        fileInputUploadRef.current?.click();
    };

    const triggerCapture = (type: 'before' | 'after') => {
        setCurrentType(type);
        fileInputCaptureRef.current?.click();
    };

    const executeDelete = async () => {
        if (!photoToDelete) return;
        const photo = photoToDelete;
        try {
            await deleteDoc(doc(db, 'apps', APP_ID, 'baustellen_fotos', photo.id));
            const storageRef = ref(storage, `apps/${APP_ID}/sites/${siteId}/photos/${photo.fileName}`); // Updated path to match scoping rules
            await deleteObject(storageRef).catch(e => console.log("Storage delete error:", e));
        } catch (error) {
            console.error("Löschen Fehler:", error);
        } finally {
            setPhotoToDelete(null);
        }
    };

    if (!isOpen) return null;

    const beforePhotos = photos.filter(p => p.type === 'before');
    const afterPhotos = photos.filter(p => p.type === 'after');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 sm:p-6">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-900 border-l-4 border-brand-primary pl-3">
                        Vorher/Nachher Fotos: {siteName}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white">
                    <input 
                        type="file" 
                        accept="image/*"
                        multiple
                        ref={fileInputUploadRef}
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                    <input 
                        type="file" 
                        accept="image/*"
                        capture="environment"
                        ref={fileInputCaptureRef}
                        className="hidden"
                        onChange={handleFileSelect}
                    />

                    {/* Section: Vorher */}
                    <div className="mb-8">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                            <h3 className="text-md font-bold text-gray-800 flex items-center">
                                Davor (Vorher)
                                <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{beforePhotos.length}</span>
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                                <button 
                                    onClick={() => triggerUpload('before')}
                                    disabled={uploadingType !== null}
                                    className="flex items-center justify-center text-xs sm:text-sm font-medium text-brand-primary bg-brand-primary/5 hover:bg-brand-primary/10 px-3 sm:px-4 py-2 rounded-lg transition-colors border border-brand-primary/10 flex-1 sm:flex-none min-w-[140px]"
                                >
                                    <Loader2 className={`w-4 h-4 mr-2 animate-spin ${uploadingType === 'before' ? '' : 'hidden'}`} />
                                    <Upload className={`w-4 h-4 mr-2 ${uploadingType === 'before' ? 'hidden' : ''}`} />
                                    <span>{uploadingType === 'before' ? 'Lade...' : 'Hochladen'}</span>
                                </button>
                                <button 
                                    onClick={() => triggerCapture('before')}
                                    disabled={uploadingType !== null}
                                    className="flex items-center justify-center text-xs sm:text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 px-3 sm:px-4 py-2 rounded-lg transition-colors shadow-sm flex-1 sm:flex-none min-w-[140px]"
                                >
                                    <Loader2 className={`w-4 h-4 mr-2 text-white animate-spin ${uploadingType === 'before' ? '' : 'hidden'}`} />
                                    <Camera className={`w-4 h-4 mr-2 text-white ${uploadingType === 'before' ? 'hidden' : ''}`} />
                                    <span>{uploadingType === 'before' ? 'Lade...' : 'Foto machen'}</span>
                                </button>
                            </div>
                        </div>
                        {beforePhotos.length === 0 ? (
                            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 bg-gray-50">
                                Keine Vorher-Fotos hochgeladen.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {beforePhotos.map(photo => (
                                    <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-[4/3] border border-gray-100 bg-gray-100">
                                        <img src={photo.url} alt="Vorher" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        {userRole === 'admin' && (
                                            <button 
                                                onClick={() => setPhotoToDelete(photo)}
                                                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all shadow-lg"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        <div className="absolute bottom-2 left-2 right-2 text-xs text-white opacity-0 group-hover:opacity-100 font-medium">
                                             {new Date(photo.createdAt?.toDate ? photo.createdAt.toDate() : Date.now()).toLocaleDateString('de-DE')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-gray-100 w-full mb-8" />

                    {/* Section: Nachher */}
                    <div className="mb-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                            <h3 className="text-md font-bold text-gray-800 flex items-center">
                                Danach (Nachher)
                                <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{afterPhotos.length}</span>
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                                <button 
                                    onClick={() => triggerUpload('after')}
                                    disabled={uploadingType !== null}
                                    className="flex items-center justify-center text-xs sm:text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 sm:px-4 py-2 rounded-lg transition-colors border border-emerald-200 flex-1 sm:flex-none min-w-[140px]"
                                >
                                    <Loader2 className={`w-4 h-4 mr-2 animate-spin ${uploadingType === 'after' ? '' : 'hidden'}`} />
                                    <Upload className={`w-4 h-4 mr-2 ${uploadingType === 'after' ? 'hidden' : ''}`} />
                                    <span>{uploadingType === 'after' ? 'Lade...' : 'Hochladen'}</span>
                                </button>
                                <button 
                                    onClick={() => triggerCapture('after')}
                                    disabled={uploadingType !== null}
                                    className="flex items-center justify-center text-xs sm:text-sm font-medium bg-emerald-500 hover:bg-emerald-600 px-3 sm:px-4 py-2 rounded-lg transition-colors shadow-sm text-white flex-1 sm:flex-none min-w-[140px]"
                                >
                                    <Loader2 className={`w-4 h-4 mr-2 text-white animate-spin ${uploadingType === 'after' ? '' : 'hidden'}`} />
                                    <Camera className={`w-4 h-4 mr-2 text-white ${uploadingType === 'after' ? 'hidden' : ''}`} />
                                    <span>{uploadingType === 'after' ? 'Lade...' : 'Foto machen'}</span>
                                </button>
                            </div>
                        </div>
                        {afterPhotos.length === 0 ? (
                            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 bg-gray-50">
                                Keine Nachher-Fotos hochgeladen.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {afterPhotos.map(photo => (
                                    <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-[4/3] border border-gray-100 bg-gray-100">
                                        <img src={photo.url} alt="Nachher" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        {userRole === 'admin' && (
                                            <button 
                                                onClick={() => setPhotoToDelete(photo)}
                                                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all shadow-lg"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        <div className="absolute bottom-2 left-2 right-2 text-xs text-white opacity-0 group-hover:opacity-100 font-medium">
                                             {new Date(photo.createdAt?.toDate ? photo.createdAt.toDate() : Date.now()).toLocaleDateString('de-DE')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmDeleteModal
                isOpen={!!photoToDelete}
                onClose={() => setPhotoToDelete(null)}
                onConfirm={executeDelete}
                title="Foto löschen"
                itemName="dieses Vorher/Nachher Foto"
            />
        </div>
    );
};
