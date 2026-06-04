import React, { useState, useEffect, useRef } from 'react';
import { db, APP_ID, storage } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { Trash2, Image as ImageIcon, UploadCloud, Camera, X, Download, MapPin, Calendar, Clock, Map, Plus, Archive, ArchiveRestore, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface SitePhoto {
    id: string;
    siteId: string;
    url: string;
    type: string;
    createdAt: any;
    filename: string;
    location?: { latitude: number; longitude: number; } | null;
    activityId?: string | null;
}

interface SiteActivity {
    id: string;
    siteId: string;
    name: string;
    createdAt: any;
    status?: 'active' | 'archived';
}

interface SitePhotosProps {
    siteId: string;
}

export const SitePhotos: React.FC<SitePhotosProps> = ({ siteId }) => {
    const [photos, setPhotos] = useState<SitePhoto[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadPhase, setUploadPhase] = useState<'compressing' | 'uploading' | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [uploadType, setUploadType] = useState<string>('general');
    const [uploadActivityId, setUploadActivityId] = useState<string | null>(null);
    const [selectedPhoto, setSelectedPhoto] = useState<SitePhoto | null>(null);
    const [gettingLocation, setGettingLocation] = useState(false);
    const { userRole } = useAuth();
    
    // Delete Modals
    const [photoToDelete, setPhotoToDelete] = useState<SitePhoto | null>(null);
    const [activityToDelete, setActivityToDelete] = useState<{ activity: SiteActivity, photos: SitePhoto[] } | null>(null);
    
    // Activities
    const [activities, setActivities] = useState<SiteActivity[]>([]);
    const [newActivityName, setNewActivityName] = useState('');
    const [isAddingActivity, setIsAddingActivity] = useState(false);
    const [showArchived, setShowArchived] = useState(false);

    useEffect(() => {
        if (!siteId) return;
        
        // Fetch Photos
        const qPhotos = query(
            collection(db, 'apps', APP_ID, 'site_photos'),
            where('siteId', '==', siteId)
        );

        const unsubPhotos = onSnapshot(qPhotos, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SitePhoto));
            data.sort((a, b) => {
                const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return timeB - timeA;
            });
            setPhotos(data);
            setLoading(false);
        });

        // Fetch Activities
        const qActivities = query(
            collection(db, 'apps', APP_ID, 'site_activities'),
            where('siteId', '==', siteId)
        );

        const unsubActivities = onSnapshot(qActivities, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SiteActivity));
            data.sort((a, b) => {
                const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return timeA - timeB; // ascending, older activities first
            });
            setActivities(data);
        });

        return () => {
            unsubPhotos();
            unsubActivities();
        };
    }, [siteId]);

    const handleAddActivity = async () => {
        if (!newActivityName.trim()) return;
        try {
            await addDoc(collection(db, 'apps', APP_ID, 'site_activities'), {
                siteId,
                name: newActivityName.trim(),
                status: 'active',
                createdAt: serverTimestamp()
            });
            setNewActivityName('');
            setIsAddingActivity(false);
        } catch (error) {
            console.error("Error adding activity", error);
        }
    };

    const handleToggleArchiveActivity = async (activity: SiteActivity) => {
        try {
            const newStatus = activity.status === 'archived' ? 'active' : 'archived';
            await updateDoc(doc(db, 'apps', APP_ID, 'site_activities', activity.id), {
                status: newStatus
            });
        } catch (error) {
            console.error("Archive error", error);
        }
    };

    const executeDeleteActivity = async () => {
        if (!activityToDelete) return;
        const { activity, photos: activityPhotos } = activityToDelete;
        
        try {
            // Delete all associated photos from storage and firestore
            for (const photo of activityPhotos) {
                try {
                    await deleteDoc(doc(db, 'apps', APP_ID, 'site_photos', photo.id));
                    const storageRef = ref(storage, `apps/${APP_ID}/sites/${siteId}/photos/${photo.type}/${photo.filename}`);
                    await deleteObject(storageRef);
                } catch (e) {
                    console.error("Error deleting photo", e);
                }
            }
            
            // Delete the activity itself
            await deleteDoc(doc(db, 'apps', APP_ID, 'site_activities', activity.id));
        } catch (error) {
            console.error("Delete activity error", error);
        } finally {
            setActivityToDelete(null);
        }
    };

    const handleUploadClick = (actId: string | null) => {
        setUploadType('general');
        setUploadActivityId(actId);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleCameraClick = (actId: string | null) => {
        setUploadType('general');
        setUploadActivityId(actId);
        if (cameraInputRef.current) {
            cameraInputRef.current.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadPhase('compressing');
        setUploadProgress(0);

        let location = null;
        if (navigator.geolocation) {
            setGettingLocation(true);
            try {
                location = await new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                        (err) => resolve(null),
                        { timeout: 5000, enableHighAccuracy: true, maximumAge: 10000 }
                    );
                });
            } catch (err) {
                // Ignore gps error
            }
            setGettingLocation(false);
        }

        try {
            // Compress Image
            const options = {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 1920,
                useWebWorker: false // disabled for mobile stability
            };
            const compressedFile = await imageCompression(file, options);
            
            setUploadPhase('uploading');
            
            // Generate filename
            const filename = `${Date.now()}_${compressedFile.name}`;
            const storagePath = `apps/${APP_ID}/sites/${siteId}/photos/${uploadType}/${filename}`;
            const storageRef = ref(storage, storagePath);

            // Upload
            const uploadTask = uploadBytesResumable(storageRef, compressedFile);

            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(Math.round(progress));
                }, 
                (error) => {
                    console.error("Upload error:", error);
                    alert("Fehler beim Hochladen.");
                    setUploading(false);
                }, 
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    
                    // Save to Firestore
                    await addDoc(collection(db, 'apps', APP_ID, 'site_photos'), {
                        siteId,
                        url: downloadURL,
                        type: uploadType,
                        filename,
                        location: location || null,
                        activityId: uploadActivityId,
                        createdAt: serverTimestamp()
                    });
                    
                    setUploading(false);
                    setUploadPhase(null);
                    setUploadProgress(0);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    if (cameraInputRef.current) cameraInputRef.current.value = '';
                }
            );
        } catch (error) {
            console.error("Compression or upload failed:", error);
            alert(`Fehler bei der Bildverarbeitung: ${error instanceof Error ? error.message : String(error)}`);
            setUploading(false);
            setUploadPhase(null);
        }
    };

    const executeDeletePhoto = async () => {
        if (!photoToDelete) return;
        const photo = photoToDelete;
        try {
            await deleteDoc(doc(db, 'apps', APP_ID, 'site_photos', photo.id));
            const storageRef = ref(storage, `apps/${APP_ID}/sites/${siteId}/photos/${photo.type}/${photo.filename}`);
            await deleteObject(storageRef);
        } catch (error) {
            console.error("Delete error:", error);
        } finally {
            setPhotoToDelete(null);
            setSelectedPhoto(null);
        }
    };

    const downloadPhoto = async (photo: SitePhoto) => {
        try {
            const response = await fetch(photo.url);
            if (!response.ok) throw new Error("Network response was not ok");
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = photo.filename || 'foto.jpg';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error("Download failed with fetch, falling back to new tab", err);
            window.open(photo.url, '_blank');
        }
    };

    const PhotoGrid = ({ items, emptyMsg, actId }: { items: SitePhoto[], emptyMsg: string, actId: string | null }) => {
        return (
            <div className="mb-4">
                <div className="flex flex-col mb-6 gap-3">
                    <div className="grid grid-cols-2 w-full gap-2 sm:flex sm:w-auto sm:justify-end">
                        <button 
                            onClick={() => handleUploadClick(actId)}
                            disabled={uploading}
                            className="flex items-center justify-center text-[11px] min-[380px]:text-xs sm:text-sm font-medium py-2.5 px-2 rounded-xl transition-colors border-transparent text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20"
                        >
                            <UploadCloud className="w-4 h-4 mr-1.5" />
                            Hochladen
                        </button>
                        <button 
                            onClick={() => handleCameraClick(actId)}
                            disabled={uploading}
                            className="flex items-center justify-center text-[11px] min-[380px]:text-xs sm:text-sm font-medium py-2.5 px-2 rounded-xl transition-colors shadow-sm bg-brand-primary hover:bg-brand-primary/90 text-white"
                        >
                            <Camera className="w-4 h-4 mr-1.5" />
                            Foto machen
                        </button>
                    </div>
                </div>
            
            {items.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-gray-500 bg-gray-50/50">
                    <ImageIcon className="w-8 h-8 text-gray-300 mb-2 sm:mb-3" />
                    <p className="text-sm font-medium text-center">{emptyMsg}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {items.map(photo => (
                        <div key={photo.id} onClick={() => setSelectedPhoto(photo)} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square sm:aspect-[4/3] bg-gray-100 cursor-pointer shadow-sm">
                            <img src={photo.url} alt="Baustellenfoto" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"></div>
                            {userRole === 'admin' && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setPhotoToDelete(photo); }}
                                    className="absolute top-2 right-2 p-2.5 sm:p-2 bg-white/80 sm:bg-red-500/90 text-red-600 sm:text-white rounded-lg hover:bg-red-600 hover:text-white transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 backdrop-blur-sm shadow-sm"
                                    title="Foto löschen"
                                >
                                    <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                                </button>
                            )}
                            <button 
                                onClick={(e) => { e.stopPropagation(); downloadPhoto(photo); }}
                                className="absolute top-2 left-2 p-2.5 sm:p-2 bg-white/80 sm:bg-emerald-500/90 text-emerald-600 sm:text-white rounded-lg hover:bg-emerald-600 hover:text-white transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 backdrop-blur-sm shadow-sm"
                                title="Foto herunterladen"
                            >
                                <Download className="w-5 h-5 sm:w-4 sm:h-4" />
                            </button>
                            <div className="absolute bottom-2 left-2 right-2 text-[10px] sm:text-xs text-white drop-shadow-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 font-medium truncate">
                                {new Date(photo.createdAt?.toDate ? photo.createdAt.toDate() : Date.now()).toLocaleDateString('de-DE')}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
        );
    };

    const ActivitySection = ({ activity, gridPhotos }: { activity: SiteActivity | null, gridPhotos: SitePhoto[] }) => {
        const actId = activity ? activity.id : null;
        const title = activity ? activity.name : 'Allgemein (Ohne Zuordnung)';
        const isArchived = activity?.status === 'archived';
        
        // Hide "Allgemein" if it has no photos, to keep UI clean
        if (!activity && gridPhotos.length === 0) return null;

        return (
            <div className={`mb-6 p-4 sm:p-6 rounded-2xl border ${isArchived ? 'bg-gray-100 border-gray-300 opacity-75' : 'bg-gray-50/50 border-gray-200'}`}>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-5 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-200 gap-3 sm:gap-4">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center flex-wrap gap-2">
                        <span>{title}</span>
                        <span className="text-xs font-medium bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full">{gridPhotos.length}</span>
                        {isArchived && <span className="text-[10px] sm:text-xs bg-brand-primary/10 text-brand-primary px-2 py-1 rounded-full uppercase tracking-wider font-semibold">Archiviert</span>}
                    </h2>
                    
                    {activity && (
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => handleToggleArchiveActivity(activity)}
                                className="p-2.5 text-gray-500 hover:text-brand-primary hover:bg-brand-primary/10 rounded-xl transition-colors shadow-sm bg-white border border-gray-200 hover:border-brand-primary/30"
                                title={isArchived ? "Wiederherstellen" : "Archivieren"}
                            >
                                {isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                            </button>
                            {userRole === 'admin' && (
                                <button 
                                    onClick={() => setActivityToDelete({ activity, photos: gridPhotos })}
                                    className="p-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors shadow-sm bg-white border border-gray-200 hover:border-red-200"
                                    title="Kompletten Arbeitsschritt löschen"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
                
                <PhotoGrid 
                    items={gridPhotos} 
                    actId={actId}
                    emptyMsg="Noch keine Fotos für diesen Arbeitsschritt vorhanden." 
                />
            </div>
        );
    };

    const Lightbox = () => {
        if (!selectedPhoto) return null;
        
        const date = selectedPhoto.createdAt?.toDate ? selectedPhoto.createdAt.toDate() : new Date();
        
        const handleDownload = () => {
            downloadPhoto(selectedPhoto);
        };

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-12 animate-in fade-in duration-200">
                <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setSelectedPhoto(null)}></div>
                
                <button 
                    onClick={() => setSelectedPhoto(null)}
                    className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors z-[60]"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="relative w-full max-w-6xl max-h-[90vh] flex flex-col md:flex-row bg-white rounded-2xl overflow-hidden shadow-2xl z-50">
                    <div className="flex-1 bg-gray-900 flex items-center justify-center relative min-h-[40vh] md:min-h-[60vh] max-h-[50vh] md:max-h-none overflow-hidden">
                        <img 
                            src={selectedPhoto.url} 
                            alt="Baustellenfoto" 
                            className="w-full h-full object-contain" 
                        />
                    </div>

                    <div className="w-full md:w-80 lg:w-96 p-6 flex flex-col bg-white overflow-y-auto">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">Details zum Foto</h3>
                        
                        <div className="space-y-4 mb-8 flex-1">
                            <div className="flex items-start text-gray-600">
                                <Calendar className="w-5 h-5 mr-3 text-brand-primary flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Datum</p>
                                    <p className="text-sm">{date.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start text-gray-600">
                                <Clock className="w-5 h-5 mr-3 text-brand-primary flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Uhrzeit</p>
                                    <p className="text-sm">{date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>
                                </div>
                            </div>

                            {selectedPhoto.location && (
                                <div className="flex items-start text-gray-600 bg-brand-primary/5 p-3 rounded-xl border border-brand-primary/20">
                                    <MapPin className="w-5 h-5 mr-3 text-brand-primary flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">GPS Position</p>
                                        <p className="text-xs mb-2 text-gray-500">Erfasst bei Aufnahme</p>
                                        <a 
                                            href={`https://www.google.com/maps/search/?api=1&query=${selectedPhoto.location.latitude},${selectedPhoto.location.longitude}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center text-xs font-semibold bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            <Map className="w-3 h-3 mr-1.5" />
                                            In Maps öffnen
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 mt-auto pt-4 border-t border-gray-100">
                            {userRole === 'admin' && (
                                <button 
                                    onClick={async () => {
                                        setPhotoToDelete(selectedPhoto);
                                    }}
                                    className="flex-1 flex items-center justify-center font-medium bg-red-50 text-red-600 hover:bg-red-100 px-4 py-3 rounded-xl transition-colors shadow-sm"
                                >
                                    <Trash2 className="w-5 h-5 mr-2" />
                                    Löschen
                                </button>
                            )}
                            <button  
                                onClick={handleDownload}
                                className="flex-1 flex items-center justify-center font-medium bg-brand-primary hover:bg-brand-primary/90 text-white px-4 py-3 rounded-xl transition-colors shadow-sm"
                            >
                                <Download className="w-5 h-5 mr-2" />
                                Herunterladen
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-6 lg:p-8">
            <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
            />
            <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                ref={cameraInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
            />
            
            {uploading && (
                <div className="mb-6 p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm text-brand-primary">
                    <div className="flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-primary mr-3 flex-shrink-0"></div>
                        <span className="font-medium text-sm">
                            {uploadPhase === 'compressing' ? 'Bild wird für schnelles Laden optimiert...' : 'Bild wird hochgeladen...'}
                        </span>
                    </div>
                    {uploadPhase === 'uploading' && (
                        <div className="text-sm font-bold bg-white px-3 py-1 rounded-full shadow-sm">{uploadProgress}%</div>
                    )}
                </div>
            )}

            {loading ? (
                 <div className="flex justify-center p-8 sm:p-12">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                 </div>
            ) : (
                <div className="space-y-4 sm:space-y-6">
                    {/* Activity Creator */}
                    <div className="mb-6 sm:mb-8">
                        {!isAddingActivity ? (
                            <button 
                                onClick={() => setIsAddingActivity(true)}
                                className="w-full flex items-center justify-center font-medium bg-brand-primary text-white px-4 sm:px-5 py-3.5 sm:py-3 rounded-xl hover:bg-brand-primary/90 transition-colors shadow-md border-b-4 border-brand-primary/20 hover:border-transparent hover:translate-y-px"
                            >
                                <Plus className="w-5 h-5 mr-2" />
                                Arbeit / Tätigkeit hinzufügen
                            </button>
                        ) : (
                            <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-200 flex flex-col sm:flex-row gap-3 shadow-inner">
                                <input 
                                    type="text" 
                                    value={newActivityName}
                                    onChange={(e) => setNewActivityName(e.target.value)}
                                    placeholder="z.B. Fenster installieren..."
                                    className="input-premium"
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleAddActivity}
                                        className="flex-1 sm:flex-none justify-center font-bold bg-brand-primary text-white px-6 py-3 rounded-xl hover:bg-brand-primary/90 transition-colors shadow-sm"
                                    >
                                        Speichern
                                    </button>
                                    <button 
                                        onClick={() => setIsAddingActivity(false)}
                                        className="flex-1 sm:flex-none justify-center font-bold bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                                    >
                                        Abbrechen
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Active Activities */}
                    {activities.filter(a => a.status !== 'archived').map(act => (
                        <ActivitySection 
                            key={act.id} 
                            activity={act} 
                            gridPhotos={photos.filter(p => p.activityId === act.id)} 
                        />
                    ))}

                    {/* Legacy / Unassigned Photos */}
                    <ActivitySection 
                        activity={null} 
                        gridPhotos={photos.filter(p => !p.activityId)} 
                    />

                    {/* Archived Activities Toggle & List */}
                    {activities.some(a => a.status === 'archived') && (
                        <div className="mt-12 pt-8 border-t border-gray-200">
                            <button 
                                onClick={() => setShowArchived(!showArchived)}
                                className="flex items-center text-gray-500 hover:text-gray-900 font-medium transition-colors mb-6"
                            >
                                {showArchived ? <ChevronUp className="w-5 h-5 mr-2" /> : <ChevronDown className="w-5 h-5 mr-2" />}
                                {showArchived ? 'Archivierte Tätigkeiten ausblenden' : 'Archivierte Tätigkeiten anzeigen'}
                            </button>

                            {showArchived && (
                                <div className="space-y-6">
                                    {activities.filter(a => a.status === 'archived').map(act => (
                                        <ActivitySection 
                                            key={act.id} 
                                            activity={act} 
                                            gridPhotos={photos.filter(p => p.activityId === act.id)} 
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <Lightbox />
            
            <ConfirmDeleteModal
                isOpen={!!photoToDelete}
                onClose={() => setPhotoToDelete(null)}
                onConfirm={executeDeletePhoto}
                title="Foto löschen"
                itemName="dieses Foto"
            />

            <ConfirmDeleteModal
                isOpen={!!activityToDelete}
                onClose={() => setActivityToDelete(null)}
                onConfirm={executeDeleteActivity}
                title="Kompletten Arbeitsschritt löschen"
                itemName={activityToDelete?.activity.name || ''}
            />
        </div>
    );
};
