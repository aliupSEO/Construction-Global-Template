import React, { useState, useEffect, useRef } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { FileText, CalendarDays, Camera, X, UploadCloud, CheckCircle, HardHat, Users, ClipboardList, TrendingUp, ArrowRight, Clock, Building2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db, storage, APP_ID } from '../lib/firebase';
import { collection, query, where, onSnapshot, getDocs, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

interface Baustelle { id: string; name: string; status?: string; }

// ── KPI Card ────────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, sub, color }: {
    icon: any; label: string; value: string | number; sub?: string; color: string;
}) => (
    <div className={`relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-start gap-4 hover:shadow-md transition-shadow`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
            <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0">
            <p className="text-sm text-gray-500 font-medium truncate">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
    </div>
);

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const HoursTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white border border-gray-200 shadow-xl rounded-xl px-4 py-2.5">
                <p className="text-xs text-gray-500 font-medium mb-1">KW {label}</p>
                <p className="text-sm font-bold text-brand-primary">{payload[0].value}h</p>
            </div>
        );
    }
    return null;
};

const ROLE_COLORS = ['#e53e3e', '#f59e0b', '#10b981'];

export const Dashboard = () => {
    const { currentUser, userRole, employeeName } = useAuth();
    const [sites, setSites] = useState<Baustelle[]>([]);

    // Stats
    const [activeSites, setActiveSites] = useState(0);
    const [totalEmployees, setTotalEmployees] = useState(0);
    const [reportsThisWeek, setReportsThisWeek] = useState(0);
    const [hoursThisMonth, setHoursThisMonth] = useState(0);

    // Charts
    const [weeklyHoursData, setWeeklyHoursData] = useState<{ week: string; hours: number }[]>([]);
    const [roleData, setRoleData] = useState<{ name: string; value: number }[]>([]);

    // Recent reports
    const [recentReports, setRecentReports] = useState<any[]>([]);

    // Active sites list
    const [activeSitesList, setActiveSitesList] = useState<any[]>([]);

    const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Photo Modal
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [selectedSiteId, setSelectedSiteId] = useState('');
    const [photoTitle, setPhotoTitle] = useState('');
    const [pendingFiles, setPendingFiles] = useState<{ file: File; url: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadPhase, setUploadPhase] = useState<'compressing' | 'uploading' | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [successMsg, setSuccessMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // ── Fetch all data ────────────────────────────────────────────────────────
    useEffect(() => {
        // Live sites list for photo modal
        const unsub = onSnapshot(query(collection(db, 'apps', APP_ID, 'baustellen')), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Baustelle));
            setSites(data.filter(s => s.status !== 'archived'));
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Active sites
                const sitesSnap = await getDocs(collection(db, 'apps', APP_ID, 'baustellen'));
                const active = sitesSnap.docs.filter(d => d.data().status !== 'archived');
                setActiveSites(active.length);
                setActiveSitesList(active.slice(0, 5).map(d => ({ id: d.id, ...d.data() })));

                // Total employees
                const empSnap = await getDocs(query(
                    collection(db, 'apps', APP_ID, 'employees'),
                    where('status', '!=', 'archived')
                ));
                setTotalEmployees(empSnap.size);

                // Role breakdown for pie chart
                const roleCounts: Record<string, number> = { admin: 0, vorarbeiter: 0, mitarbeiter: 0 };
                empSnap.docs.forEach(d => {
                    const role = d.data().role || 'mitarbeiter';
                    if (roleCounts[role] !== undefined) roleCounts[role]++;
                    else roleCounts['mitarbeiter']++;
                });
                setRoleData([
                    { name: 'Admin', value: roleCounts.admin },
                    { name: 'Vorarbeiter', value: roleCounts.vorarbeiter },
                    { name: 'Mitarbeiter', value: roleCounts.mitarbeiter },
                ].filter(r => r.value > 0));

                // Reports this week
                const now = new Date();
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay() + 1);
                startOfWeek.setHours(0, 0, 0, 0);
                const weekStr = startOfWeek.toISOString().split('T')[0];

                const dailySnap = await getDocs(query(
                    collection(db, 'apps', APP_ID, 'daily_reports'),
                    where('date', '>=', weekStr)
                ));
                setReportsThisWeek(dailySnap.size);

                // Recent 5 reports
                const allReports = dailySnap.docs
                    .map(d => ({ id: d.id, type: 'Tagesbericht', ...d.data() }))
                    .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
                setRecentReports(allReports.slice(0, 5));

                // Weekly hours for last 8 weeks
                const weeklySnap = await getDocs(collection(db, 'apps', APP_ID, 'weekly_reports'));
                const weeklyMap: Record<string, number> = {};
                weeklySnap.docs.forEach(d => {
                    const data = d.data();
                    const kw = data.calendarWeek || data.weekNumber;
                    if (!kw) return;
                    const hours = (data.entries || data.rows || []).reduce((sum: number, row: any) => {
                        const h = parseFloat(row.totalHours || row.hours || '0') || 0;
                        return sum + h;
                    }, 0);
                    weeklyMap[kw] = (weeklyMap[kw] || 0) + hours;
                });

                // Also compute from daily reports
                const dailyAllSnap = await getDocs(collection(db, 'apps', APP_ID, 'daily_reports'));
                let monthHours = 0;
                dailyAllSnap.docs.forEach(d => {
                    const data = d.data();
                    const kw = data.calendarWeek;
                    const hrs = (data.employees || []).reduce((sum: number, emp: any) => {
                        if (emp.assignedEmployees) {
                            return sum + emp.assignedEmployees.reduce((s: number, ae: any) => {
                                const h = parseFloat(ae.hours || '0') || 0;
                                const sw = parseFloat(ae.badWeatherHours || '0') || 0;
                                const doc = parseFloat(ae.doctorHours || '0') || 0;
                                return s + h + sw + doc;
                            }, 0);
                        }
                        return sum;
                    }, 0);
                    if (kw) weeklyMap[kw] = (weeklyMap[kw] || 0) + hrs;

                    // Hours this month
                    const date = data.date || '';
                    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                    if (date.startsWith(thisMonth)) monthHours += hrs;
                });

                setHoursThisMonth(Math.round(monthHours));

                // Build chart: last 8 calendar weeks
                const currentKW = getIsoWeek(now);
                const chartData = [];
                for (let i = 7; i >= 0; i--) {
                    const kw = ((currentKW - i - 1 + 52) % 52) + 1;
                    chartData.push({ week: String(kw), hours: Math.round(weeklyMap[kw] || 0) });
                }
                setWeeklyHoursData(chartData);

            } catch (err) {
                console.error('Dashboard stats error:', err);
            }
        };
        fetchStats();
    }, []);

    const getIsoWeek = (date: Date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };

    // ── Photo upload handlers (unchanged) ────────────────────────────────────
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList || fileList.length === 0) return;
        if (!selectedSiteId) { toast.error('Bitte wähle zuerst eine Baustelle aus.'); return; }
        setPendingFiles(prev => [...prev, ...Array.from(fileList).map(f => ({ file: f, url: URL.createObjectURL(f) }))]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const handleConfirmUpload = async () => {
        if (pendingFiles.length === 0) return;
        if (!selectedSiteId) { toast.error('Bitte wähle zuerst eine Baustelle aus.'); return; }
        setUploading(true); setUploadPhase('compressing'); setUploadProgress(0); setSuccessMsg('');
        let location = null;
        if (navigator.geolocation) {
            try { location = await new Promise(resolve => navigator.geolocation.getCurrentPosition(pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }), () => resolve(null), { timeout: 5000 })); } catch {}
        }
        try {
            let activityId = null;
            const finalTitle = photoTitle.trim();
            if (finalTitle) {
                const reqQ = query(collection(db, 'apps', APP_ID, 'site_activities'), where('siteId', '==', selectedSiteId), where('name', '==', finalTitle));
                const snap = await getDocs(reqQ);
                activityId = snap.empty ? (await addDoc(collection(db, 'apps', APP_ID, 'site_activities'), { siteId: selectedSiteId, name: finalTitle, status: 'active', createdAt: serverTimestamp() })).id : snap.docs[0].id;
            }
            const totalFiles = pendingFiles.length;
            let uploadedCount = 0;
            for (let i = 0; i < totalFiles; i++) {
                setUploadPhase('compressing');
                const compressed = await imageCompression(pendingFiles[i].file, { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: false });
                setUploadPhase('uploading');
                const filename = `${Date.now()}_${compressed.name}`;
                const storageRef = ref(storage, `apps/${APP_ID}/sites/${selectedSiteId}/photos/general/${filename}`);
                const task = uploadBytesResumable(storageRef, compressed);
                await new Promise((resolve, reject) => task.on('state_changed', s => { const p = ((uploadedCount + s.bytesTransferred / s.totalBytes) / totalFiles) * 100; setUploadProgress(Math.round(p)); }, reject, async () => { const url = await getDownloadURL(task.snapshot.ref); await addDoc(collection(db, 'apps', APP_ID, 'site_photos'), { siteId: selectedSiteId, url, type: 'general', filename, location: location || null, activityId, createdAt: serverTimestamp() }); uploadedCount++; resolve(null); }));
            }
            setUploading(false); setUploadPhase(null); setUploadProgress(0); setPhotoTitle('');
            pendingFiles.forEach(pf => URL.revokeObjectURL(pf.url)); setPendingFiles([]);
            setSuccessMsg(totalFiles > 1 ? `${totalFiles} Fotos erfolgreich gespeichert!` : 'Foto erfolgreich gespeichert!');
            setTimeout(() => { setSuccessMsg(''); setIsPhotoModalOpen(false); }, 2500);
        } catch (err) {
            console.error(err);
            toast.error('Fehler bei der Bildverarbeitung');
            setUploading(false); setUploadPhase(null);
        }
    };

    const triggerCamera = () => { if (!selectedSiteId) { toast.error('Bitte zuerst eine Baustelle wählen.'); return; } cameraInputRef.current?.click(); };
    const triggerUpload = () => { if (!selectedSiteId) { toast.error('Bitte zuerst eine Baustelle wählen.'); return; } fileInputRef.current?.click(); };

    return (
        <DashboardShell title="Dashboard">
            <div className="max-w-7xl space-y-8 mt-2">

                {/* Welcome Banner */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-dark to-black p-8 border border-white/10 shadow-xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -ml-10 -mb-10" />
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <p className="text-brand-primary text-sm font-semibold uppercase tracking-widest mb-2">{today}</p>
                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">
                                Willkommen zurück{employeeName ? `, ${employeeName}` : (currentUser?.email ? `, ${currentUser.email.split('@')[0]}` : '')}!
                            </h2>
                            <p className="text-slate-400 text-sm">Hier ist Ihre aktuelle Übersicht.</p>
                        </div>
                        <div className="flex gap-3 shrink-0">
                            <Link to="/daily-reports/new" className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-brand-primary/30">
                                <FileText className="w-4 h-4" /> Tagesbericht
                            </Link>
                            <Link to="/weekly-reports/new" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all border border-white/20">
                                <CalendarDays className="w-4 h-4" /> Wochenbericht
                            </Link>
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard icon={Building2} label="Aktive Baustellen" value={activeSites} sub="derzeit laufend" color="bg-gradient-to-br from-brand-primary to-red-700" />
                    <KpiCard icon={Users} label="Mitarbeiter" value={totalEmployees} sub="registriert" color="bg-gradient-to-br from-violet-500 to-violet-700" />
                    <KpiCard icon={ClipboardList} label="Berichte diese Woche" value={reportsThisWeek} sub="Tagesberichte" color="bg-gradient-to-br from-amber-500 to-orange-600" />
                    <KpiCard icon={Clock} label="Stunden diesen Monat" value={`${hoursThisMonth}h`} sub="Gesamtstunden" color="bg-gradient-to-br from-emerald-500 to-emerald-700" />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Weekly Hours Bar Chart */}
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Stunden pro Kalenderwoche</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Letzte 8 Wochen</p>
                            </div>
                            <TrendingUp className="w-5 h-5 text-brand-primary" />
                        </div>
                        {weeklyHoursData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={weeklyHoursData} barSize={28}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `KW${v}`} />
                                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}h`} />
                                    <Tooltip content={<HoursTooltip />} cursor={{ fill: '#f1f5f9', radius: 6 }} />
                                    <Bar dataKey="hours" fill="#e53e3e" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[220px] flex items-center justify-center text-gray-300">
                                <div className="text-center">
                                    <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Noch keine Daten vorhanden</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Role Pie Chart */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Team Rollen</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Mitarbeiterverteilung</p>
                            </div>
                            <Users className="w-5 h-5 text-violet-500" />
                        </div>
                        {roleData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie data={roleData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                                        {roleData.map((_, index) => (
                                            <Cell key={index} fill={ROLE_COLORS[index % ROLE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>} />
                                    <Tooltip formatter={(value) => [`${value} Personen`]} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[220px] flex items-center justify-center text-gray-300">
                                <div className="text-center">
                                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Keine Mitarbeiterdaten</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Row: Recent Reports + Active Sites + Quick Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Recent Reports */}
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-base font-bold text-gray-900">Aktuelle Berichte</h3>
                            <Link to="/reports" className="text-xs text-brand-primary font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                                Alle ansehen <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                        {recentReports.length === 0 ? (
                            <div className="py-10 text-center text-gray-300">
                                <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">Noch keine Berichte diese Woche</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {recentReports.map(report => (
                                    <Link key={report.id} to={`/reports/${report.id}`} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                                        <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0 group-hover:bg-brand-primary/20 transition-colors">
                                            <FileText className="w-4 h-4 text-brand-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{report.constructionSite || 'Unbekannte Baustelle'}</p>
                                            <p className="text-xs text-gray-400">{report.date ? new Date(report.date).toLocaleDateString('de-DE') : '-'} · {report.reportNumber || report.id}</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-primary transition-colors shrink-0" />
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Active Sites + Quick Photo */}
                    <div className="space-y-6">
                        {/* Active Sites */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-base font-bold text-gray-900">Aktive Baustellen</h3>
                                <Link to="/sites" className="text-xs text-brand-primary font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                                    Alle <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                            {activeSitesList.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-4">Keine Baustellen</p>
                            ) : (
                                <div className="space-y-2">
                                    {activeSitesList.map((site: any) => (
                                        <Link key={site.id} to={`/sites/${site.id}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                                            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                                <HardHat className="w-3.5 h-3.5 text-emerald-600" />
                                            </div>
                                            <span className="text-sm font-medium text-gray-700 truncate flex-1">{site.name}</span>
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Quick Photo CTA */}
                        <button
                            onClick={() => setIsPhotoModalOpen(true)}
                            className="w-full group relative bg-gradient-to-br from-brand-primary to-red-700 rounded-2xl p-6 text-left overflow-hidden hover:shadow-xl hover:shadow-brand-primary/20 hover:-translate-y-0.5 transition-all duration-300"
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-6 -mt-6" />
                            <Camera className="w-8 h-8 text-white mb-3 relative z-10 group-hover:scale-110 transition-transform" />
                            <p className="text-white font-bold text-base relative z-10">Schnelles Foto</p>
                            <p className="text-white/70 text-xs mt-1 relative z-10">Jetzt Baustelle dokumentieren</p>
                        </button>
                    </div>
                </div>
            </div>

            {/* Hidden file inputs */}
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
            <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileChange} className="hidden" multiple />

            {/* Quick Photo Modal */}
            {isPhotoModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!uploading) { pendingFiles.forEach(pf => URL.revokeObjectURL(pf.url)); setPendingFiles([]); setIsPhotoModalOpen(false); } }} />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center"><Camera className="w-5 h-5 mr-2 text-brand-primary" />Schnelles Foto</h2>
                            {!uploading && <button onClick={() => { pendingFiles.forEach(pf => URL.revokeObjectURL(pf.url)); setPendingFiles([]); setIsPhotoModalOpen(false); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>}
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
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Baustelle auswählen <span className="text-red-500">*</span></label>
                                        <select value={selectedSiteId} onChange={e => setSelectedSiteId(e.target.value)} disabled={uploading} className="input-premium appearance-none">
                                            <option value="">-- Bitte wählen --</option>
                                            {sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tätigkeit / Titel (Optional)</label>
                                        <input type="text" value={photoTitle} onChange={e => setPhotoTitle(e.target.value)} disabled={uploading} placeholder="z.B. Betonieren, Fliesen verlegen..." className="input-premium" />
                                    </div>
                                    {pendingFiles.length > 0 && !uploading && (
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ausgewählte Fotos ({pendingFiles.length})</label>
                                            <div className="grid grid-cols-4 gap-2">
                                                {pendingFiles.map((p, i) => (
                                                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                                                        <img src={p.url} alt="" className="w-full h-full object-cover" />
                                                        <button type="button" onClick={() => { URL.revokeObjectURL(p.url); setPendingFiles(prev => prev.filter((_, idx) => idx !== i)); }} className="absolute top-1 right-1 bg-white/80 text-red-500 hover:bg-red-500 hover:text-white p-1 rounded-full shadow transition-colors"><X className="w-3 h-3" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {uploading ? (
                                        <div className="mt-4 p-5 bg-brand-primary/5 border border-brand-primary/20 rounded-xl flex flex-col items-center gap-3">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
                                            <span className="font-medium text-brand-primary">{uploadPhase === 'compressing' ? 'Bild wird optimiert...' : 'Wird hochgeladen...'}</span>
                                            {uploadPhase === 'uploading' && <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-brand-primary h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} /></div>}
                                        </div>
                                    ) : (
                                        <div className="mt-4 flex flex-col gap-3">
                                            {pendingFiles.length > 0 ? (
                                                <>
                                                    <button type="button" onClick={handleConfirmUpload} className="w-full flex justify-center items-center font-bold bg-green-500 text-white py-3.5 px-4 rounded-xl hover:bg-green-600 transition-all shadow-md">
                                                        <CheckCircle className="w-5 h-5 mr-2" />{pendingFiles.length} Foto{pendingFiles.length > 1 ? 's' : ''} hochladen
                                                    </button>
                                                    <div className="flex gap-3">
                                                        <button type="button" onClick={triggerUpload} className="flex-1 flex justify-center items-center font-bold bg-brand-primary/10 text-brand-primary py-2 px-2 rounded-xl hover:bg-brand-primary/20 text-sm"><UploadCloud className="w-4 h-4 mr-1.5" />Weitere</button>
                                                        <button type="button" onClick={triggerCamera} className="flex-1 flex justify-center items-center font-bold bg-brand-primary/10 text-brand-primary py-2 px-2 rounded-xl hover:bg-brand-primary/20 text-sm"><Camera className="w-4 h-4 mr-1.5" />Kamera</button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col gap-3 sm:flex-row">
                                                    <button type="button" onClick={triggerUpload} disabled={!selectedSiteId} className="w-full sm:flex-1 flex justify-center items-center font-bold bg-brand-primary/10 text-brand-primary py-3.5 px-4 rounded-xl hover:bg-brand-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"><UploadCloud className="w-5 h-5 mr-2" />Aussuchen</button>
                                                    <button type="button" onClick={triggerCamera} disabled={!selectedSiteId} className="w-full sm:flex-1 flex justify-center items-center font-bold bg-brand-primary text-white py-3.5 px-4 rounded-xl hover:bg-brand-primary/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"><Camera className="w-5 h-5 mr-2" />Aufnehmen</button>
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
