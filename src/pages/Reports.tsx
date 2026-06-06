import React, { useState, useEffect, useMemo } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { db, APP_ID } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, getDocs, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { FileText, ArrowRight, Calendar, Edit2, Trash2, Printer, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CustomSelect } from '../components/CustomSelect';
import { CustomDatePicker } from '../components/CustomDatePicker';
import toast from 'react-hot-toast';
import { softDelete, getDaysUntilExpiry } from '../lib/softDelete';
import { logger } from '../lib/logger';

const getDayKey = (dateString: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
};

const getIsoYear = (dateString: string) => {
    const date = new Date(dateString);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    return date.getFullYear();
};

const parseHours = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val.replace(',', '.'));
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};

const parseWeeklyCell = (val: string | number) => {
    if (typeof val === 'number') return { normal: val, sw: 0, doc: 0, special: null };
    if (!val || typeof val !== 'string') return { normal: 0, sw: 0, doc: 0, special: null };
    
    const upper = val.trim().toUpperCase();
    if (upper === 'K' || upper === 'U' || upper === 'F') return { normal: 0, sw: 0, doc: 0, special: upper };

    let normal = 0, sw = 0, doc = 0;
    
    const parts = val.split('|');
    parts.forEach(part => {
        const p = part.trim().toLowerCase();
        const numMatch = p.match(/([\d,.]+)/);
        const num = numMatch ? parseFloat(numMatch[1].replace(',', '.')) : 0;
        
        if (p.includes('sw')) {
            sw += num;
        } else if (p.includes('arzt')) {
            doc += num;
        } else if (p === 'k' || p.includes(' k') || p.startsWith('k ') || p === 'u' || p.includes(' u') || p.startsWith('u ') || p === 'f' || p.includes(' f') || p.startsWith('f ')) {
            // Do not add to normal hours
        } else {
            normal += num;
        }
    });

    if (parts.length === 1 && !val.toLowerCase().includes('sw') && !val.toLowerCase().includes('arzt') && !val.toLowerCase().includes('k') && !val.toLowerCase().includes('u') && !val.toLowerCase().includes('f')) {
        const parsed = parseFloat(val.replace(',', '.'));
        if (!isNaN(parsed)) return { normal: parsed, sw: 0, doc: 0, special: null };
    }

    return { normal, sw, doc, special: null };
};

const buildCombinedString = (normal: number, sw: number, doc: number, special: string | null = null) => {
    if (normal === 0 && sw === 0 && doc === 0 && special) {
        return special;
    }
    let result = [];
    if (normal > 0) result.push(`${normal.toString().replace('.', ',')}h`);
    if (sw > 0) result.push(`${sw.toString().replace('.', ',')}h SW`);
    if (doc > 0) result.push(`${doc.toString().replace('.', ',')}h Arzt`);
    return result.length > 0 ? result.join(' | ') : '';
};

export const Reports = () => {
    const navigate = useNavigate();
    const { userRole, currentUser, employeeName } = useAuth();
    const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');
    const [dailyReports, setDailyReports] = useState<any[]>([]);
    const [weeklyReports, setWeeklyReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);

    const [selectedDaily, setSelectedDaily] = useState<string[]>([]);
    const [selectedWeekly, setSelectedWeekly] = useState<string[]>([]);

    const [dbBaustellen, setDbBaustellen] = useState<any[]>([]);
    const [siteFilterStatus, setSiteFilterStatus] = useState<'active' | 'archived' | 'all'>('active');

    // Filter für Tagesberichte
    const [filterDailyDate, setFilterDailyDate] = useState('');
    const [filterDailySite, setFilterDailySite] = useState('');

    // Filter für Wochenberichte
    const [filterWeeklyWeek, setFilterWeeklyWeek] = useState('');
    const [filterWeeklyDateFrom, setFilterWeeklyDateFrom] = useState('');
    const [filterWeeklyDateTo, setFilterWeeklyDateTo] = useState('');

    useEffect(() => {
        const qDaily = query(
            collection(db, 'apps', APP_ID, 'daily_reports'),
            orderBy('createdAt', 'desc')
        );

        const unDaily = onSnapshot(qDaily, (snapshot) => {
            const data = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as any))
                .filter((r: any) => !r.isDeleted);

            // local sort to reinforce date order if createdAt fluctuates
            data.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
            setDailyReports(data);
            setLoading(false);
        });

        const qWeekly = collection(db, 'apps', APP_ID, 'weekly_reports');
        const unWeekly = onSnapshot(qWeekly, (snapshot) => {
            const data = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as any))
                .filter((r: any) => !r.isDeleted);

            // Sort by year desc, week desc
            data.sort((a: any, b: any) => {
                const yearDiff = (b.year || 0) - (a.year || 0);
                if (yearDiff !== 0) return yearDiff;
                return (b.calendarWeek || 0) - (a.calendarWeek || 0);
            });
            setWeeklyReports(data);
        });

        return () => {
            unDaily();
            unWeekly();
        };
    }, []);

    useEffect(() => {
        const fetchBaustellen = async () => {
            try {
                const snap = await getDocs(collection(db, 'apps', APP_ID, 'baustellen'));
                setDbBaustellen(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (error) {
                console.error("Fehler beim Laden der Baustellen:", error);
            }
        };
        fetchBaustellen();
    }, []);

    const filteredDailyReports = useMemo(() => {
        return dailyReports.filter(report => {
            let matchDate = true;
            let matchSite = true;
            if (filterDailyDate) {
                // Ensure format matches YYYY-MM-DD for comparison if date input gives that
                matchDate = report.date === filterDailyDate;
            }
            if (filterDailySite) {
                matchSite = report.constructionSite?.trim() === filterDailySite?.trim();
            }
            return matchDate && matchSite;
        });
    }, [dailyReports, filterDailyDate, filterDailySite]);

    const groupedDailyReports = useMemo(() => {
        const groups: Record<string, any[]> = {};
        filteredDailyReports.forEach(report => {
            const dateStr = report.date ? new Date(report.date).toLocaleDateString('de-DE') : 'Ohne Datum';
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(report);
        });
        return groups;
    }, [filteredDailyReports]);

    const filteredWeeklyReports = useMemo(() => {
        return weeklyReports.filter(report => {
            let matchWeek = true;
            let matchDateRange = true;
            
            if (filterWeeklyWeek) {
                matchWeek = report.calendarWeek?.toString() === filterWeeklyWeek;
            }

            if (filterWeeklyDateFrom || filterWeeklyDateTo) {
                const year = report.year || new Date().getFullYear();
                const week = report.calendarWeek || 1;
                // Startdatum der Woche berechnen
                const simple = new Date(year, 0, 1 + (week - 1) * 7);
                const dow = simple.getDay();
                const weekStart = new Date(simple);
                if (dow <= 4) {
                    weekStart.setDate(simple.getDate() - simple.getDay() + 1);
                } else {
                    weekStart.setDate(simple.getDate() + 8 - simple.getDay());
                }
                weekStart.setHours(0,0,0,0);
                
                // Enddatum der Woche
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                weekEnd.setHours(23,59,59,999);

                if (filterWeeklyDateFrom) {
                    const fromDate = new Date(filterWeeklyDateFrom);
                    fromDate.setHours(0,0,0,0);
                    if (weekEnd < fromDate) matchDateRange = false;
                }
                if (filterWeeklyDateTo) {
                    const toDate = new Date(filterWeeklyDateTo);
                    toDate.setHours(23,59,59,999);
                    if (weekStart > toDate) matchDateRange = false;
                }
            }
            
            return matchWeek && matchDateRange;
        });
    }, [weeklyReports, filterWeeklyWeek, filterWeeklyDateFrom, filterWeeklyDateTo]);

    const groupedWeeklyReports = useMemo(() => {
        const groups: Record<number, Record<string, any[]>> = {};
        filteredWeeklyReports.forEach(report => {
            const year = report.year || new Date().getFullYear();
            
            let monthName = '';
            if (report.month) {
                const d = new Date();
                d.setMonth(report.month - 1);
                monthName = d.toLocaleString('de-DE', { month: 'long' });
            } else {
                const week = report.calendarWeek || 1;
                const simple = new Date(year, 0, 1 + (week - 1) * 7);
                const dow = simple.getDay();
                const ISOweekStart = simple;
                if (dow <= 4) {
                    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
                } else {
                    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
                }
                monthName = ISOweekStart.toLocaleString('de-DE', { month: 'long' });
            }
            
            if (!groups[year]) groups[year] = {};
            if (!groups[year][monthName]) groups[year][monthName] = [];
            groups[year][monthName].push(report);
        });
        return groups;
    }, [weeklyReports]);

    const handleBulkPrint = () => {
        const ids = activeTab === 'daily' ? selectedDaily : selectedWeekly;
        if (ids.length === 0) return;
        window.open(`/print/${activeTab}/${ids.join('--id--')}`, '_blank');
    };

    const allVisibleDailyIds = useMemo(() => filteredDailyReports.map((r: any) => r.id), [filteredDailyReports]);
    const isAllDailySelected = allVisibleDailyIds.length > 0 && selectedDaily.length === allVisibleDailyIds.length;
    const handleSelectAllDaily = () => {
        if (isAllDailySelected) setSelectedDaily([]);
        else setSelectedDaily(allVisibleDailyIds);
    };

    const allVisibleWeeklyIds = useMemo(() => filteredWeeklyReports.map((r: any) => r.id), [filteredWeeklyReports]);
    const isAllWeeklySelected = allVisibleWeeklyIds.length > 0 && selectedWeekly.length === allVisibleWeeklyIds.length;
    const handleSelectAllWeekly = () => {
        if (isAllWeeklySelected) setSelectedWeekly([]);
        else setSelectedWeekly(allVisibleWeeklyIds);
    };

    const toggleSelectDaily = (id: string) => {
        setSelectedDaily(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectWeekly = (id: string) => {
        setSelectedWeekly(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAllDailyInGroup = (dateKey: string) => {
        const groupIds = groupedDailyReports[dateKey].map((r: any) => r.id);
        const allSelected = groupIds.length > 0 && groupIds.every((id: string) => selectedDaily.includes(id));
        
        if (allSelected) {
            setSelectedDaily(prev => prev.filter(id => !groupIds.includes(id)));
        } else {
            setSelectedDaily(prev => Array.from(new Set([...prev, ...groupIds])));
        }
    };

    const toggleSelectAllWeeklyInGroup = (year: number, month: string) => {
        const groupIds = groupedWeeklyReports[year][month].map((r: any) => r.id);
        const allSelected = groupIds.length > 0 && groupIds.every((id: string) => selectedWeekly.includes(id));

        if (allSelected) {
            setSelectedWeekly(prev => prev.filter(id => !groupIds.includes(id)));
        } else {
            setSelectedWeekly(prev => Array.from(new Set([...prev, ...groupIds])));
        }
    };

    const generatePastWeeklyReports = async () => {
        setShowGenerateConfirm(false);
        setIsGenerating(true);
        try {
            const currentDate = new Date();
            const isLastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() === currentDate.getDate();
            
            // Grenze für "vergangene Wochen"
            // Neu: Bereits ab Samstag darf die aktuelle Woche generiert werden
            const limitDate = new Date();
            if (currentDate.getDay() === 6) { // Samstag
                limitDate.setDate(currentDate.getDate() + 1);
            } else if (currentDate.getDay() === 0) { // Sonntag
                // Bleibt auf heute (Sonntag)
            } else {
                // Montag bis Freitag: Letzter Sonntag
                limitDate.setDate(currentDate.getDate() - currentDate.getDay());
            }
            limitDate.setHours(23, 59, 59, 999);
            
            const reportsByWeek: Record<string, any[]> = {};
            
            // 1. Tagesberichte gruppieren (mit Monats-Split)
            dailyReports.forEach(report => {
                if (!report.date || !report.calendarWeek) return;
                const reportDate = new Date(report.date);
                
                const isPastWeek = reportDate <= limitDate;
                const isPastMonth = reportDate.getMonth() !== currentDate.getMonth() || reportDate.getFullYear() !== currentDate.getFullYear();
                const isReadyForBilling = isPastWeek || isPastMonth || (isLastDayOfMonth && reportDate <= currentDate);
                
                if (!isReadyForBilling) return;
                
                const rYear = getIsoYear(report.date);
                const rKw = parseInt(report.calendarWeek, 10);
                const rMonth = reportDate.getMonth() + 1;
                const groupKey = `${rYear}_${rKw}_${rMonth}`;
                
                if (!reportsByWeek[groupKey]) reportsByWeek[groupKey] = [];
                reportsByWeek[groupKey].push(report);
            });

            // 2. Prüfen, welche Wochenberichte schon existieren (Abwärtskompatibilität für alte Berichte ohne Monat)
            const existingKeys = new Set();
            weeklyReports.forEach(wr => {
                const y = wr.year || getIsoYear(new Date().toISOString());
                const kw = wr.calendarWeek;
                if (wr.month) {
                    existingKeys.add(`${y}_${kw}_${wr.month}`);
                } else {
                    for(let m=1; m<=12; m++) {
                        existingKeys.add(`${y}_${kw}_${m}`);
                    }
                }
            });
            
            const weeksToGenerate = Object.keys(reportsByWeek).filter(key => !existingKeys.has(key));
            
            if (weeksToGenerate.length === 0) {
                toast.error('Alle vergangenen Wochenberichte sind bereits vorhanden.');
                setIsGenerating(false);
                return;
            }

            // 3. Counter abrufen
            const counterRef = doc(db, 'apps', APP_ID, 'metadata', 'counters');
            const counterDoc = await getDoc(counterRef);
            let currentWeeklyCount = counterDoc.exists() && counterDoc.data().weeklyReportCount ? counterDoc.data().weeklyReportCount : 1000;

            const batch = writeBatch(db);
            let generatedCount = 0;

            // 4. Für jede fehlende Woche den Bericht zusammenbauen
            for (const weekKey of weeksToGenerate) {
                const [yearStr, kwStr, monthStr] = weekKey.split('_');
                const year = parseInt(yearStr, 10);
                const kw = parseInt(kwStr, 10);
                const rMonth = parseInt(monthStr, 10);
                const entryMap: Record<string, any> = {};
                
                reportsByWeek[weekKey].forEach(dr => {
                    const dayKey = getDayKey(dr.date);
                    if (!dayKey) return;
                    
                    const siteName = dr.constructionSite || 'Unbekannt';
                    const siteObj = dbBaustellen.find(b => b.name === siteName);
                    const siteId = siteObj ? siteObj.id : '';

                    if (dr.employees && Array.isArray(dr.employees)) {
                        dr.employees.forEach((emp: any) => {
                            if (emp.assignedEmployees && Array.isArray(emp.assignedEmployees)) {
                                emp.assignedEmployees.forEach((assigned: any) => {
                                    const addNormal = parseHours(assigned.hours);
                                    const addSw = parseHours(assigned.badWeatherHours);
                                    const addDoc = parseHours(assigned.doctorHours);
                                    const specialCode = typeof assigned.hours === 'string' && ['K', 'U', 'F'].includes(assigned.hours.trim().toUpperCase()) ? assigned.hours.trim().toUpperCase() : null;

                                    if (addNormal <= 0 && addSw <= 0 && addDoc <= 0 && !specialCode) return;
                                    
                                    const mapKey = `${assigned.employeeId}_${siteName}`;
                                    if (!entryMap[mapKey]) {
                                        entryMap[mapKey] = {
                                            id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                                            employeeId: assigned.employeeId,
                                            employeeName: assigned.name,
                                            constructionSiteId: siteId,
                                            constructionSiteName: siteName,
                                            days: { monday: '', tuesday: '', wednesday: '', thursday: '', friday: '', saturday: '', sunday: '' }
                                        };
                                    }
                                    
                                    const prev = parseWeeklyCell((entryMap[mapKey].days as any)[dayKey]);
                                    (entryMap[mapKey].days as any)[dayKey] = buildCombinedString(
                                        prev.normal + addNormal,
                                        prev.sw + addSw,
                                        prev.doc + addDoc,
                                        specialCode || prev.special
                                    );
                                });
                            }
                        });
                    }
                });
                
                const weeklyEntries = Object.values(entryMap);
                if (weeklyEntries.length === 0) continue;
                
                let totalHours = 0;
                weeklyEntries.forEach((entry: any) => {
                    const entryHours = Object.values(entry.days).reduce((sum: number, val: any) => {
                        const p = parseWeeklyCell(val as string | number);
                        return sum + p.normal + p.sw + p.doc;
                    }, 0) as number;
                    totalHours += entryHours;
                });
                
                currentWeeklyCount++;
                const reportNumber = `W-${year}-KW${kw}-M${rMonth}`;
                const reportId = `weekly_report_${year}_kw${kw}_m${rMonth}_${reportNumber}`;
                
                batch.set(doc(db, 'apps', APP_ID, 'weekly_reports', reportId), {
                    reportNumber,
                    calendarWeek: kw,
                    year: year,
                    month: rMonth,
                    weeklyEntries,
                    totalHours,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    isAutoGenerated: true
                });
                generatedCount++;
            }
            
            if (generatedCount > 0) {
                batch.set(counterRef, { weeklyReportCount: currentWeeklyCount }, { merge: true });
                await batch.commit();
                toast(`${generatedCount} Wochenbericht(e) erfolgreich generiert!`);
            } else {
                toast('Keine generierbaren Daten gefunden (z.B. keine Stunden eingetragen).');
            }
        } catch (error) {
            logger.error('Report generation error:', error);
            toast.error("Fehler bei der Generierung.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDelete = async (collectionName: string, id: string) => {
        try {
            await softDelete(collectionName, id, {
                uid: currentUser?.uid || 'system',
                name: employeeName || currentUser?.email || 'Admin',
            });
            toast.success('Bericht in den Papierkorb verschoben.');
        } catch (error) {
            logger.error('Fehler beim Löschen:', error);
            toast.error('Fehler beim Löschen.');
        }
    };

    if (loading) {
        return (
            <DashboardShell title="Bauberichte">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell title="Bauberichte Historie">

            {/* Header / Tabs */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-6 border-b border-gray-200 pb-4 sm:pb-0">
                <div className="flex space-x-2">
                    <button
                        onClick={() => setActiveTab('daily')}
                        className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${activeTab === 'daily'
                            ? 'border-brand-primary text-brand-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Tagesberichte
                    </button>
                    <button
                        onClick={() => setActiveTab('weekly')}
                        className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${activeTab === 'weekly'
                            ? 'border-brand-primary text-brand-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Wochenberichte
                    </button>
                </div>
                
                <div className="flex space-x-3 w-full sm:w-auto">
                    <button
                        onClick={() => navigate('/daily-reports/new')}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-brand-primary/20 text-sm font-medium rounded-xl text-brand-primary bg-brand-primary/10 hover:bg-brand-primary hover:text-white hover:shadow-lg hover:shadow-brand-primary/30 transition-all duration-200 group"
                    >
                        <Plus className="w-4 h-4 mr-2 group-hover:text-white" />
                        Neuer Tagesbericht
                    </button>
                    <button
                        onClick={() => navigate('/weekly-reports/new')}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-brand-primary shadow-lg shadow-brand-primary/30 hover:bg-brand-primary/90 transition-colors"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Neuer Wochenbericht
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
                {activeTab === 'daily' ? (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-5">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Datum</label>
                            <CustomDatePicker
                                selected={filterDailyDate ? new Date(filterDailyDate) : null}
                                onChange={(date) => {
                                    if (date) {
                                        // Adjust for timezone offset to get local YYYY-MM-DD
                                        const offset = date.getTimezoneOffset() * 60000;
                                        const localISOTime = (new Date(date.getTime() - offset)).toISOString().split('T')[0];
                                        setFilterDailyDate(localISOTime);
                                    } else {
                                        setFilterDailyDate('');
                                    }
                                }}
                            />
                        </div>
                        <div className="md:col-span-5">
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-medium text-gray-500">Baustelle</label>
                                <CustomSelect 
                                    value={siteFilterStatus} 
                                    onChange={(val) => {
                                        setSiteFilterStatus(val as any);
                                        setFilterDailySite('');
                                    }}
                                    options={[
                                        { value: 'active', label: 'Nur Aktive' },
                                        { value: 'archived', label: 'Nur Archivierte' },
                                        { value: 'all', label: 'Alle anzeigen' }
                                    ]}
                                    variant="inline"
                                />
                            </div>
                            <CustomSelect
                                value={filterDailySite}
                                onChange={(val) => setFilterDailySite(val)}
                                placeholder="- Alle Baustellen -"
                                options={[
                                    { value: '', label: '- Alle Baustellen -' },
                                    ...dbBaustellen
                                        .filter(b => {
                                            const isActive = !b.status || b.status === 'active';
                                            if (siteFilterStatus === 'active') return isActive;
                                            if (siteFilterStatus === 'archived') return !isActive;
                                            return true;
                                        })
                                        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                                        .map(b => ({ value: b.name, label: b.name }))
                                ]}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <button
                                onClick={() => { 
                                    setFilterDailyDate(''); 
                                    setFilterDailySite(''); 
                                    setSiteFilterStatus('active'); 
                                }}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 transition-colors shadow-sm h-[46px] flex items-center justify-center"
                            >
                                Zurücksetzen
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Datum von</label>
                            <CustomDatePicker
                                selected={filterWeeklyDateFrom ? new Date(filterWeeklyDateFrom) : null}
                                onChange={(date) => {
                                    if (date) {
                                        const offset = date.getTimezoneOffset() * 60000;
                                        const localISOTime = (new Date(date.getTime() - offset)).toISOString().split('T')[0];
                                        setFilterWeeklyDateFrom(localISOTime);
                                    } else {
                                        setFilterWeeklyDateFrom('');
                                    }
                                }}
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Datum bis</label>
                            <CustomDatePicker
                                selected={filterWeeklyDateTo ? new Date(filterWeeklyDateTo) : null}
                                onChange={(date) => {
                                    if (date) {
                                        const offset = date.getTimezoneOffset() * 60000;
                                        const localISOTime = (new Date(date.getTime() - offset)).toISOString().split('T')[0];
                                        setFilterWeeklyDateTo(localISOTime);
                                    } else {
                                        setFilterWeeklyDateTo('');
                                    }
                                }}
                            />
                        </div>
                        <div className="md:col-span-4">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Kalenderwoche (KW)</label>
                            <input
                                type="number"
                                placeholder="z.B. 10"
                                value={filterWeeklyWeek}
                                onChange={(e) => setFilterWeeklyWeek(e.target.value)}
                                className="input-premium"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <button
                                onClick={() => { setFilterWeeklyWeek(''); setFilterWeeklyDateFrom(''); setFilterWeeklyDateTo(''); }}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 transition-colors shadow-sm h-[46px] flex items-center justify-center"
                            >
                                Zurücksetzen
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bulk Selection Interface */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                        <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary transition-colors cursor-pointer"
                            checked={activeTab === 'daily' ? isAllDailySelected : isAllWeeklySelected}
                            onChange={activeTab === 'daily' ? handleSelectAllDaily : handleSelectAllWeekly}
                        />
                    </div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Alle sichtbaren Berichte auswählen</span>
                </label>
                
                {(activeTab === 'daily' ? selectedDaily.length > 0 : selectedWeekly.length > 0) && (
                    <button onClick={handleBulkPrint} className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-xl text-white bg-brand-primary hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/30 transition-all duration-200 w-full sm:w-auto">
                        <Printer className="w-4 h-4 mr-2" />
                        {activeTab === 'daily' ? selectedDaily.length : selectedWeekly.length} {(activeTab === 'daily' ? selectedDaily.length : selectedWeekly.length) === 1 ? 'Bericht' : 'Berichte'} drucken
                    </button>
                )}
            </div>

            {/* Daily Reports View */}
            {activeTab === 'daily' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {filteredDailyReports.length === 0 ? (
                        <div className="p-16 text-center flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm">
                            <div className="w-24 h-24 bg-brand-primary/5 rounded-full flex items-center justify-center mb-6">
                                <FileText className="w-12 h-12 text-brand-primary/40" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Keine Tagesberichte</h3>
                            <p className="text-gray-500 mb-8 max-w-md">Es wurden noch keine Tagesberichte erfasst, die diesen Filterkriterien entsprechen.</p>
                            <button 
                                onClick={() => navigate('/daily-reports/new')} 
                                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-brand-primary bg-brand-primary/10 hover:bg-brand-primary hover:text-white hover:shadow-lg hover:shadow-brand-primary/30 transition-all duration-200 group"
                            >
                                <Plus className="w-4 h-4 mr-2 group-hover:text-white transition-colors" />
                                Ersten Bericht anlegen
                            </button>
                        </div>
                    ) : (
                        <div className="p-4 sm:p-6">
                            {Object.keys(groupedDailyReports).map(dateKey => (
                                <div key={dateKey} className="mb-8 last:mb-0">
                                    <h3 className="text-md font-semibold text-gray-700 mt-2 mb-4">{dateKey}</h3>
                                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th scope="col" className="px-6 py-3 text-left w-12">
                                                        <input 
                                                            type="checkbox" 
                                                            className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
                                                            checked={groupedDailyReports[dateKey].length > 0 && groupedDailyReports[dateKey].every(r => selectedDaily.includes(r.id))}
                                                            onChange={() => toggleSelectAllDailyInGroup(dateKey)}
                                                        />
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nr. / Baustelle</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Status</th>
                                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {groupedDailyReports[dateKey].map((report) => (
                                                    <tr key={report.id} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4">
                                                            <input 
                                                                type="checkbox" 
                                                                className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
                                                                checked={selectedDaily.includes(report.id)}
                                                                onChange={() => toggleSelectDaily(report.id)}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-gray-900 text-sm mb-1">{report.constructionSite || 'Unbekannt'}</span>
                                                                <span className="text-xs text-gray-500">{report.reportNumber || '-'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 hidden md:table-cell text-sm">
                                                            {report.managerSignature ? (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                    Unterschrieben
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                                    Offen
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <div className="flex items-center justify-end space-x-3">
                                                                <button
                                                                    onClick={() => window.open(`/print/daily/${report.id}`, '_blank')}
                                                                    className="text-gray-500 hover:text-brand-primary"
                                                                    title="Ansehen / Drucken"
                                                                >
                                                                    <Printer className="w-5 h-5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => navigate(`/daily-reports/${report.id}`)}
                                                                    className="text-gray-500 hover:text-brand-primary"
                                                                    title="Bearbeiten"
                                                                >
                                                                    <Edit2 className="w-5 h-5" />
                                                                </button>
                                                                {userRole !== 'mitarbeiter' && (
                                                                    <button
                                                                        onClick={() => handleDelete('daily_reports', report.id)}
                                                                        className="text-red-400 hover:text-red-600"
                                                                        title="Löschen"
                                                                    >
                                                                        <Trash2 className="w-5 h-5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Weekly Reports View */}
            {activeTab === 'weekly' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Generate Reports Banner */}
                    <div className="p-4 border-b border-gray-100 bg-brand-primary/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-brand-primary" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900">Fehlende Berichte generieren</h4>
                                <p className="text-xs text-gray-500">Automatisch Wochenberichte für vergangene Zeiten erstellen.</p>
                            </div>
                        </div>
                        {showGenerateConfirm ? (
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">Wirklich generieren?</span>
                                <button onClick={generatePastWeeklyReports} disabled={isGenerating} className="px-4 py-2 bg-brand-primary text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-brand-primary/90 transition-colors">
                                    {isGenerating ? 'Generiere...' : 'Ja, generieren'}
                                </button>
                                <button onClick={() => setShowGenerateConfirm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors">
                                    Abbrechen
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowGenerateConfirm(true)}
                                disabled={isGenerating}
                                className={`w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-brand-primary/20 text-sm font-medium rounded-xl text-brand-primary bg-white hover:bg-brand-primary hover:text-white shadow-sm transition-all duration-200 group ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isGenerating ? (
                                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-primary group-hover:border-white mr-2"></div> Generiere...</>
                                ) : (
                                    'Berichte generieren'
                                )}
                            </button>
                        )}
                    </div>

                    {filteredWeeklyReports.length === 0 ? (
                        <div className="p-16 text-center flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm mt-4 mx-4 mb-4">
                            <div className="w-24 h-24 bg-brand-primary/5 rounded-full flex items-center justify-center mb-6">
                                <FileText className="w-12 h-12 text-brand-primary/40" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Keine Wochenberichte</h3>
                            <p className="text-gray-500 mb-8 max-w-md">Es wurden noch keine Wochenberichte erfasst, die diesen Filterkriterien entsprechen.</p>
                            <button 
                                onClick={() => navigate('/weekly-reports/new')} 
                                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-brand-primary hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/30 transition-all duration-200 group"
                            >
                                <Plus className="w-4 h-4 mr-2 text-white" />
                                Ersten Wochenbericht anlegen
                            </button>
                        </div>
                    ) : (
                        <div className="p-4 sm:p-6">
                            {Object.keys(groupedWeeklyReports).sort((a, b) => Number(b) - Number(a)).map(year => (
                                <div key={year} className="mb-12 last:mb-0">
                                    <h1 className="text-xl font-bold text-gray-900 mt-2 mb-6 border-b border-gray-200 pb-2">{year}</h1>
                                    {Object.keys(groupedWeeklyReports[Number(year)]).map(month => (
                                        <div key={`${year}-${month}`} className="mb-8 last:mb-0 pl-4 border-l-2 border-brand-primary/20">
                                            <h2 className="text-lg font-semibold text-gray-700 mt-4 mb-4">{month}</h2>
                                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th scope="col" className="px-6 py-3 text-left w-12">
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
                                                                    checked={groupedWeeklyReports[Number(year)][month].length > 0 && groupedWeeklyReports[Number(year)][month].every(r => selectedWeekly.includes(r.id))}
                                                                    onChange={() => toggleSelectAllWeeklyInGroup(Number(year), month)}
                                                                />
                                                            </th>
                                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nr. / Mitarbeiter</th>
                                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Woche</th>
                                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Stunden</th>
                                                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {groupedWeeklyReports[Number(year)][month].map((report) => (
                                                            <tr key={report.id} className="hover:bg-gray-50">
                                                                <td className="px-6 py-4">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
                                                                        checked={selectedWeekly.includes(report.id)}
                                                                        onChange={() => toggleSelectWeekly(report.id)}
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium text-gray-900 text-sm mb-1">Wochenbericht KW-{report.calendarWeek || '-'}</span>
                                                                        <span className="text-xs text-gray-500">{report.reportNumber || '-'}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 hidden sm:table-cell">
                                                                    <div className="text-sm text-gray-900 border border-gray-100 bg-gray-50 inline-flex items-center px-2 py-1 rounded">
                                                                        <Calendar className="w-3.5 h-3.5 mr-1.5 text-brand-primary" />
                                                                        KW {report.calendarWeek}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 hidden md:table-cell text-sm font-semibold text-brand-primary">
                                                                    {report.totalHours || 0} h
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                    <div className="flex items-center justify-end space-x-3">
                                                                        <button
                                                                            onClick={() => window.open(`/print/weekly/${report.id}`, '_blank')}
                                                                            className="text-gray-500 hover:text-brand-primary"
                                                                            title="Ansehen / Drucken"
                                                                        >
                                                                            <Printer className="w-5 h-5" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => navigate(`/weekly-reports/${report.id}`)}
                                                                            className="text-gray-500 hover:text-brand-primary"
                                                                            title="Bearbeiten"
                                                                        >
                                                                            <Edit2 className="w-5 h-5" />
                                                                        </button>
                                                                        {userRole !== 'mitarbeiter' && (
                                                                            <button
                                                                                onClick={() => handleDelete('weekly_reports', report.id)}
                                                                                className="text-red-400 hover:text-red-600"
                                                                                title="Löschen"
                                                                            >
                                                                                <Trash2 className="w-5 h-5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </DashboardShell>
    );
};
