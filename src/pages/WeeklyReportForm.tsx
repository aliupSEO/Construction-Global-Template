import React, { useState, useEffect, useMemo } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { db, APP_ID } from '../lib/firebase';
import { collection, doc, getDoc, setDoc, getDocs, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft } from 'lucide-react';
import { SignaturePad } from '../components/ui/SignaturePad';
import { slugify } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

// Helper to get current ISO week number
function getWeekNumber(d: Date) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}

interface WeeklyEntry {
    id: string; // Unique row ID
    employeeId: string;
    employeeName: string;
    constructionSiteId: string;
    constructionSiteName: string;
    days: {
        monday: number | string;
        tuesday: number | string;
        wednesday: number | string;
        thursday: number | string;
        friday: number | string;
        saturday: number | string;
        sunday: number | string;
    };
}

const DAYS_OF_WEEK = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export const WeeklyReportForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = id && id !== 'new';
    const { userRole } = useAuth();
    const isReadOnly = userRole === 'vorarbeiter' || userRole === 'mitarbeiter';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Dropdown Data
    const [dbEmployees, setDbEmployees] = useState<any[]>([]);
    const [dbBaustellen, setDbBaustellen] = useState<any[]>([]);

    const currentDate = new Date();
    const currentWeek = getWeekNumber(currentDate);
    const currentYear = currentDate.getFullYear();

    const [nextReportNumber, setNextReportNumber] = useState<string>('');

    const [formData, setFormData] = useState({
        reportNumber: '',
        calendarWeek: currentWeek,
        year: currentYear,
        month: currentDate.getMonth() + 1
    });

    const [weeklyEntries, setWeeklyEntries] = useState<WeeklyEntry[]>([]);

    const [holidayDays, setHolidayDays] = useState({
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false
    });

    const toggleHolidayDay = (day: keyof WeeklyEntry['days']) => {
        const nextVal = !holidayDays[day];
        
        if (nextVal) {
            const hasExistingHours = weeklyEntries.some(entry => {
                const val = entry.days[day];
                if (val === undefined || val === null) return false;
                const str = typeof val === 'string' ? val.trim() : String(val).trim();
                return str !== '' && str.toUpperCase() !== 'F';
            });
            
            if (hasExistingHours) {
                const confirmMsg = "Für diesen Wochentag sind bereits Arbeitsstunden oder Abwesenheiten eingetragen. Sind Sie sicher, dass Sie diesen Tag als Feiertag markieren möchten? Alle bestehenden Einträge für diesen Wochentag werden mit 'F' überschrieben.";
                if (!window.confirm(confirmMsg)) {
                    return;
                }
            }
        }

        setHolidayDays(prev => ({ ...prev, [day]: nextVal }));
        
        setWeeklyEntries(entries => entries.map(entry => {
            const currentVal = entry.days[day];
            let newVal = currentVal;
            if (nextVal) {
                newVal = 'F';
            } else if (currentVal === 'F') {
                newVal = '';
            }
            return {
                ...entry,
                days: {
                    ...entry.days,
                    [day]: newVal
                }
            };
        }));
    };

    const totals = useMemo(() => {
        let normal = 0, sw = 0, doc = 0, sick = 0, vacation = 0, holiday = 0;
        weeklyEntries.forEach(entry => {
            Object.values(entry.days).forEach(val => {
                if (typeof val === 'number') normal += val;
                else if (typeof val === 'string' && val.trim() !== '') {
                    const strVal = val.trim().toUpperCase();
                    if (strVal === 'K') { sick += 8; return; }
                    if (strVal === 'U') { vacation += 8; return; }
                    if (strVal === 'F') { holiday += 8; return; }
                    
                    const parts = val.split('|');
                    if (parts.length === 1 && !strVal.includes('SW') && !strVal.includes('ARZT') && !strVal.includes('K') && !strVal.includes('U') && !strVal.includes('F')) {
                        const parsed = parseFloat(val.replace(',', '.'));
                        if (!isNaN(parsed)) normal += parsed;
                    } else {
                        parts.forEach(part => {
                            const p = part.trim().toLowerCase();
                            const numMatch = p.match(/([\d,.]+)/);
                            const num = numMatch ? parseFloat(numMatch[1].replace(',', '.')) : 0;
                            const addNum = numMatch ? num : 8;
                            
                            if (p === 'k' || p.includes(' k') || p.startsWith('k ')) sick += addNum;
                            else if (p === 'u' || p.includes(' u') || p.startsWith('u ')) vacation += addNum;
                            else if (p === 'f' || p.includes(' f') || p.startsWith('f ')) holiday += addNum;
                            else if (p.includes('sw')) sw += num;
                            else if (p.includes('arzt')) doc += num;
                            else normal += num;
                        });
                    }
                }
            });
        });
        return { normal, sw, doc, sick, vacation, holiday, total: normal + sw + doc };
    }, [weeklyEntries]);

    useEffect(() => {
        const fetchDropdownData = async () => {
            try {
                const employeesSnap = await getDocs(collection(db, 'apps', APP_ID, 'employees'));
                setDbEmployees(employeesSnap.docs
                    .filter(doc => {
                        const data = doc.data();
                        const isActive = data.active !== false && (!data.status || data.status === 'active');
                        const isNotAdmin = data.role !== 'admin';
                        return isActive && isNotAdmin;
                    })
                    .map(doc => ({ id: doc.id, ...doc.data() })));

                const baustellenSnap = await getDocs(collection(db, 'apps', APP_ID, 'baustellen'));
                setDbBaustellen(baustellenSnap.docs
                    .filter(doc => !doc.data().status || doc.data().status === 'active')
                    .map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (error) {
                console.error("Error fetching dropdowns:", error);
            }
        };

        const fetchReport = async () => {
            if (isEdit) {
                try {
                    const docSnap = await getDoc(doc(db, 'apps', APP_ID, 'weekly_reports', id!));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setFormData({
                            reportNumber: data.reportNumber || '',
                            calendarWeek: data.calendarWeek || currentWeek,
                            year: data.year || currentYear,
                            month: data.month || currentDate.getMonth() + 1
                        });

                        if (data.weeklyEntries) {
                            // Automatically merge duplicate rows for the same employee + same site
                            const mergedEntries: Record<string, WeeklyEntry> = {};
                            data.weeklyEntries.forEach((entry: any) => {
                                const key = `${entry.employeeId}_${entry.constructionSiteName}`;
                                if (!mergedEntries[key]) {
                                    mergedEntries[key] = { ...entry, days: { ...(entry.days || {}) } };
                                } else {
                                    // Merge the days
                                    const existingDays = mergedEntries[key].days;
                                    const entryDays = entry.days || {};
                                    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
                                        const eStr = typeof existingDays[day] === 'string' ? existingDays[day].trim().toUpperCase() : '';
                                        const nStr = typeof entryDays[day] === 'string' ? entryDays[day].trim().toUpperCase() : '';
                                        if (nStr === 'K' || nStr === 'U' || nStr === 'F') {
                                            existingDays[day] = nStr;
                                        } else if (eStr !== 'K' && eStr !== 'U' && eStr !== 'F') {
                                            const existingNum = typeof existingDays[day] === 'string' ? parseFloat(existingDays[day].replace(',', '.')) : existingDays[day];
                                            const newNum = typeof entryDays[day] === 'string' ? parseFloat(entryDays[day].replace(',', '.')) : entryDays[day];
                                            
                                            const finalExisting = (isNaN(existingNum) ? 0 : existingNum);
                                            const finalNew = (isNaN(newNum) ? 0 : newNum);
                                            
                                            if (finalExisting > 0 || finalNew > 0) {
                                                existingDays[day] = finalExisting + finalNew;
                                            } else if (entryDays[day] !== undefined && entryDays[day] !== '' && !existingDays[day]) {
                                                existingDays[day] = entryDays[day];
                                            }
                                        }
                                    });
                                }
                            });
                            setWeeklyEntries(Object.values(mergedEntries));
                        } else if (data.employeeEntries) {
                            // Backwards compatibility for the intermediate employeeEntries matrix format
                            // We construct a mock ID and map if possible
                            const mappedEntries: WeeklyEntry[] = data.employeeEntries.map((e: any, idx: number) => ({
                                id: `mapped_${idx}_${Date.now()}`,
                                employeeId: e.employeeId,
                                employeeName: e.employeeName,
                                constructionSiteId: '', // Requires manual re-selection if imported
                                constructionSiteName: data.constructionSite || '',
                                days: e.days
                            }));
                            setWeeklyEntries(mappedEntries);
                        } else if (data.dailyEntries) {
                            // Map old data for backwards compatibility
                            const oldEntry: WeeklyEntry = {
                                id: `mapped_legacy_${Date.now()}`,
                                employeeId: data.employeeId || '',
                                employeeName: data.employeeName || '',
                                constructionSiteId: '',
                                constructionSiteName: data.constructionSite || '',
                                days: {
                                    monday: data.dailyEntries.find((e: any) => e.dayOfWeek === 'Montag')?.hours || 0,
                                    tuesday: data.dailyEntries.find((e: any) => e.dayOfWeek === 'Dienstag')?.hours || 0,
                                    wednesday: data.dailyEntries.find((e: any) => e.dayOfWeek === 'Mittwoch')?.hours || 0,
                                    thursday: data.dailyEntries.find((e: any) => e.dayOfWeek === 'Donnerstag')?.hours || 0,
                                    friday: data.dailyEntries.find((e: any) => e.dayOfWeek === 'Freitag')?.hours || 0,
                                    saturday: data.dailyEntries.find((e: any) => e.dayOfWeek === 'Samstag')?.hours || 0,
                                    sunday: data.dailyEntries.find((e: any) => e.dayOfWeek === 'Sonntag')?.hours || 0,
                                }
                            };
                            setWeeklyEntries([oldEntry]);
                        }
                    } else {
                        alert("Bericht nicht gefunden.");
                        navigate('/reports');
                    }
                } catch (error) {
                    console.error("Error fetching report:", error);
                }
            } else {
                try {
                    const counterRef = doc(db, 'apps', APP_ID, 'metadata', 'counters');
                    const counterDoc = await getDoc(counterRef);
                    const nextNumber = `W-${currentYear}-KW${currentWeek}-M${currentDate.getMonth() + 1}`;
                    setNextReportNumber(nextNumber);
                    setFormData(prev => ({ ...prev, reportNumber: nextNumber }));
                } catch (error) {
                    console.error("Error fetching counter:", error);
                }
            }
            setLoading(false);
        };

        Promise.all([fetchDropdownData(), fetchReport()]);
    }, [id, isEdit, navigate, currentWeek, currentYear]);

    // Sync holiday checkbox states when report is loaded
    useEffect(() => {
        if (weeklyEntries.length > 0) {
            const days: (keyof WeeklyEntry['days'])[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const updatedHolidays = { ...holidayDays };
            days.forEach(day => {
                const allHoliday = weeklyEntries.every(entry => {
                    const val = typeof entry.days[day] === 'string' ? entry.days[day].trim().toUpperCase() : '';
                    return val === 'F';
                });
                updatedHolidays[day] = allHoliday;
            });
            setHolidayDays(updatedHolidays);
        }
    }, [loading]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'number' ? parseInt(value) || 0 : value
        });
    };

    const addWeeklyEntry = () => {
        setWeeklyEntries([
            ...weeklyEntries,
            {
                id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                employeeId: '',
                employeeName: '',
                constructionSiteId: '',
                constructionSiteName: '',
                days: {
                    monday: holidayDays.monday ? 'F' : '',
                    tuesday: holidayDays.tuesday ? 'F' : '',
                    wednesday: holidayDays.wednesday ? 'F' : '',
                    thursday: holidayDays.thursday ? 'F' : '',
                    friday: holidayDays.friday ? 'F' : '',
                    saturday: holidayDays.saturday ? 'F' : '',
                    sunday: holidayDays.sunday ? 'F' : ''
                }
            }
        ]);
    };

    const removeWeeklyEntry = (id: string) => {
        setWeeklyEntries(weeklyEntries.filter(e => e.id !== id));
    };

    const updateWeeklyEntryField = (id: string, field: 'employeeId' | 'constructionSiteId', value: string) => {
        setWeeklyEntries(entries => entries.map(entry => {
            if (entry.id === id) {
                if (field === 'employeeId') {
                    const emp = dbEmployees.find(e => e.id === value);
                    return { ...entry, employeeId: value, employeeName: emp ? `${emp.lastName}, ${emp.firstName}` : '' };
                } else if (field === 'constructionSiteId') {
                    const site = dbBaustellen.find(s => s.id === value);
                    return { ...entry, constructionSiteId: value, constructionSiteName: site ? site.name : '' };
                }
            }
            return entry;
        }));
    };

    const updateWeeklyEntryHours = (id: string, day: keyof WeeklyEntry['days'], value: string) => {
        setWeeklyEntries(entries => entries.map(entry => {
            if (entry.id === id) {
                let parsedValue: number | string = value;
                const upperValue = value.trim().toUpperCase();
                // Allow string values like "4 K" to be stored directly
                if (upperValue === 'K' || upperValue === 'U' || upperValue === 'F') {
                    parsedValue = upperValue;
                }
                return {
                    ...entry,
                    days: {
                        ...entry.days,
                        [day]: parsedValue
                    }
                };
            }
            return entry;
        }));

        // If the user changed the hours away from 'F', make sure the day is no longer marked as a holiday
        const upperValue = value.trim().toUpperCase();
        if (upperValue !== 'F') {
            setHolidayDays(prev => ({ ...prev, [day]: false }));
        }
    };



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (weeklyEntries.length === 0) {
            alert("Bitte fügen Sie mindestens eine Zeile hinzu.");
            return;
        }

        // Validate that all rows have employee and site selected
        const isValid = weeklyEntries.every(entry => entry.employeeId && entry.constructionSiteName);
        if (!isValid) {
            alert("Bitte stellen Sie sicher, dass in jeder Zeile ein Mitarbeiter und eine Baustelle ausgewählt sind.");
            return;
        }

        setSaving(true);
        try {
            if (isEdit) {
                const payload = {
                    ...formData,
                    weeklyEntries,
                    totalHours: totals.total,
                    updatedAt: serverTimestamp(),
                };
                await setDoc(doc(db, 'apps', APP_ID, 'weekly_reports', id!), payload, { merge: true });
            } else {
                const userReportNumber = formData.reportNumber;
                const formattedReportNumber = userReportNumber || (`W-${formData.year}-KW${formData.calendarWeek}-M${formData.month}`);

                const reportId = `weekly_report_${formData.year}_kw${formData.calendarWeek}_m${formData.month}_${formattedReportNumber}`;
                const reportRef = doc(db, 'apps', APP_ID, 'weekly_reports', reportId);

                const payload = {
                    ...formData,
                    reportNumber: formattedReportNumber,
                    weeklyEntries,
                    totalHours: totals.total,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };

                await setDoc(reportRef, payload);
            }

            navigate('/reports');
        } catch (error) {
            console.error('Error saving report:', error);
            alert('Fehler beim Speichern des Wochenberichts.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <DashboardShell title="Wochenbericht">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell title={isEdit ? "Wochenbericht bearbeiten" : "Neuen Wochenbericht erfassen"}>
            <div className="mb-6 flex justify-between items-center">
                <button
                    onClick={() => navigate('/reports')}
                    className="inline-flex items-center text-gray-500 hover:text-gray-700"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Zurück zur Übersicht
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Header Data */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Allgemeine Daten</h3>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bericht Nr.</label>
                        <input
                            type="text"
                            name="reportNumber"
                            placeholder="Wird automatisch generiert"
                            value={formData.reportNumber}
                            onChange={handleFormChange}
                            disabled={isReadOnly}
                            className={isReadOnly ? 'input-premium-readonly' : 'input-premium'}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Kalenderwoche (KW) *</label>
                            <input
                                type="number"
                                name="calendarWeek"
                                min="1"
                                max="53"
                                placeholder="z.B. 42"
                                required
                                value={formData.calendarWeek}
                                onChange={handleFormChange}
                                disabled={isReadOnly}
                                className={isReadOnly ? 'input-premium-readonly' : 'input-premium'}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Jahr *</label>
                            <input
                                type="number"
                                name="year"
                                min="2000"
                                placeholder="z.B. 2024"
                                required
                                value={formData.year}
                                onChange={handleFormChange}
                                disabled={isReadOnly}
                                className={isReadOnly ? 'input-premium-readonly' : 'input-premium'}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Monat *</label>
                            <select
                                name="month"
                                required
                                value={formData.month}
                                onChange={handleFormChange}
                                disabled={isReadOnly}
                                className={isReadOnly ? 'input-premium-readonly appearance-none' : 'input-premium appearance-none'}
                            >
                                <option value="" disabled hidden>Bitte Monat wählen...</option>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('de-DE', { month: 'long' })}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Weekly Table Matrix */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-6">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h3 className="text-lg font-medium text-gray-900">Arbeitszeiten (Stunden pro Tag)</h3>
                        <div className="flex items-center space-x-3">
                            <span className="text-xs font-semibold text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-200">
                                K = Krank &nbsp;&bull;&nbsp; U = Urlaub &nbsp;&bull;&nbsp; F = Feiertag
                            </span>
                            {!isReadOnly && (
                                <button
                                    type="button"
                                    onClick={addWeeklyEntry}
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20"
                                >
                                    + Neue Zeile
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Whole week holiday shortcuts */}
                        {weeklyEntries.length > 0 && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Feiertage für die gesamte Woche festlegen:</h4>
                                <p className="text-xs text-gray-500 mb-3">Aktivieren Sie einen Wochentag, um diesen bei allen Einträgen als Feiertag (&quot;F&quot;) zu markieren.</p>
                                <div className="flex flex-wrap gap-4">
                                    {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map(day => {
                                        const labels: Record<string, string> = {
                                            monday: 'Montag',
                                            tuesday: 'Dienstag',
                                            wednesday: 'Mittwoch',
                                            thursday: 'Donnerstag',
                                            friday: 'Freitag',
                                            saturday: 'Samstag',
                                            sunday: 'Sonntag'
                                        };
                                        return (
                                            <label key={day} className="inline-flex items-center space-x-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={holidayDays[day]}
                                                    onChange={() => toggleHolidayDay(day)}
                                                    disabled={isReadOnly}
                                                    className={`h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                />
                                                <span className="text-sm font-medium text-gray-700">{labels[day]}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {weeklyEntries.length === 0 ? (
                            <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                Bitte fügen Sie eine neue Zeile hinzu, um Zeiten zu erfassen.
                            </div>
                        ) : (
                            <>
                                <div className="hidden lg:block overflow-x-auto">
                                    <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="bg-gray-50 text-gray-700 text-xs uppercase">
                                        <tr>
                                            <th className="px-3 py-3 w-48">Mitarbeiter</th>
                                            <th className="px-3 py-3 w-48">Baustelle</th>
                                            {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map(day => {
                                                const labels: Record<string, string> = {
                                                    monday: 'Mo',
                                                    tuesday: 'Di',
                                                    wednesday: 'Mi',
                                                    thursday: 'Do',
                                                    friday: 'Fr',
                                                    saturday: 'Sa',
                                                    sunday: 'So'
                                                };
                                                return (
                                                    <th key={day} className="px-1 py-2 w-14 text-center">
                                                        <div className="flex flex-col items-center space-y-1">
                                                            <span>{labels[day]}</span>
                                                            <label className="inline-flex items-center cursor-pointer" title={`Feiertag für alle am ${labels[day]}`}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={holidayDays[day]}
                                                                    onChange={() => toggleHolidayDay(day)}
                                                                    disabled={isReadOnly}
                                                                    className={`h-3.5 w-3.5 text-brand-primary focus:ring-brand-primary border-gray-300 rounded ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                />
                                                            </label>
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                            <th className="px-2 py-3 w-20 text-center">Summe</th>
                                            <th className="px-1 py-3 w-10 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {weeklyEntries.map((entry) => {
                                            const empTotal = Object.values(entry.days).reduce((acc: number, curr: any) => {
                                                if (typeof curr === 'number') return acc + curr;
                                                if (typeof curr === 'string') {
                                                    const parsed = parseFloat(curr.replace(',', '.'));
                                                    if (!isNaN(parsed)) return acc + parsed;
                                                }
                                                return acc;
                                            }, 0);
                                            return (
                                                <tr key={entry.id} className="hover:bg-gray-50">
                                                    <td className="px-2 py-2">
                                                        <select
                                                            className={isReadOnly ? 'input-premium-sm-readonly appearance-none' : 'input-premium-sm appearance-none'}
                                                            value={entry.employeeId}
                                                            onChange={(e) => updateWeeklyEntryField(entry.id, 'employeeId', e.target.value)}
                                                            required
                                                            disabled={isReadOnly}
                                                        >
                                                            <option value="" disabled>Mitarbeiter wählen</option>
                                                            {dbEmployees.map(emp => (
                                                                <option key={emp.id} value={emp.id}>{emp.lastName}, {emp.firstName}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <select
                                                            className={isReadOnly ? 'input-premium-sm-readonly appearance-none' : 'input-premium-sm appearance-none'}
                                                            value={entry.constructionSiteId}
                                                            onChange={(e) => updateWeeklyEntryField(entry.id, 'constructionSiteId', e.target.value)}
                                                            required
                                                            disabled={isReadOnly}
                                                        >
                                                            <option value="" disabled>Baustelle wählen</option>
                                                            {dbBaustellen.map(site => (
                                                                <option key={site.id} value={site.id}>{site.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map(day => (
                                                        <td key={day} className="px-1 py-2 text-center">
                                                            <input
                                                                type="text"
                                                                value={entry.days[day] === 0 ? '0' : (entry.days[day] || '')}
                                                                onChange={(e) => updateWeeklyEntryHours(entry.id, day, e.target.value)}
                                                                disabled={isReadOnly}
                                                                className={`text-center ${isReadOnly ? 'input-premium-sm-readonly' : 'input-premium-sm'}`}
                                                            />
                                                        </td>
                                                    ))}
                                                    <td className="px-2 py-2 text-center font-medium text-gray-900">
                                                        {empTotal} <span className="text-gray-400 text-xs">h</span>
                                                    </td>
                                                    <td className="px-1 py-2 text-center">
                                                        {!isReadOnly && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeWeeklyEntry(entry.id)}
                                                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                                                                title="Zeile entfernen"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {/* Mobile Card View */}
                            <div className="block lg:hidden space-y-6">
                                {weeklyEntries.map((entry) => {
                                    const empTotal = Object.values(entry.days).reduce((acc: number, curr: any) => {
                                        if (typeof curr === 'number') return acc + curr;
                                        if (typeof curr === 'string') {
                                            const parsed = parseFloat(curr.replace(',', '.'));
                                            if (!isNaN(parsed)) return acc + parsed;
                                        }
                                        return acc;
                                    }, 0);
                                    const dayLabels: Record<string, string> = { monday: 'Mo', tuesday: 'Di', wednesday: 'Mi', thursday: 'Do', friday: 'Fr', saturday: 'Sa', sunday: 'So' };
                                    
                                    return (
                                        <div key={entry.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative">
                                            {!isReadOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeWeeklyEntry(entry.id)}
                                                    className="absolute top-3 right-3 text-red-500 hover:text-red-700 p-1.5 bg-red-50 rounded-md"
                                                    title="Zeile entfernen"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                </button>
                                            )}
                                            
                                            <div className="space-y-4 mt-2">
                                                <div className="pr-10">
                                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Mitarbeiter</label>
                                                    <select
                                                        className={isReadOnly ? 'input-premium-sm-readonly appearance-none' : 'input-premium-sm appearance-none'}
                                                        value={entry.employeeId}
                                                        onChange={(e) => updateWeeklyEntryField(entry.id, 'employeeId', e.target.value)}
                                                        required
                                                        disabled={isReadOnly}
                                                    >
                                                        <option value="" disabled>Mitarbeiter wählen</option>
                                                        {dbEmployees.map(emp => (
                                                            <option key={emp.id} value={emp.id}>{emp.lastName}, {emp.firstName}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Baustelle</label>
                                                    <select
                                                        className={isReadOnly ? 'input-premium-sm-readonly appearance-none' : 'input-premium-sm appearance-none'}
                                                        value={entry.constructionSiteId}
                                                        onChange={(e) => updateWeeklyEntryField(entry.id, 'constructionSiteId', e.target.value)}
                                                        required
                                                        disabled={isReadOnly}
                                                    >
                                                        <option value="" disabled>Baustelle wählen</option>
                                                        {dbBaustellen.map(site => (
                                                            <option key={site.id} value={site.id}>{site.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                
                                                <div className="pt-2 border-t border-gray-100">
                                                    <label className="block text-xs font-semibold text-gray-700 mb-3">Stunden pro Tag</label>
                                                    <div className="grid grid-cols-4 gap-3">
                                                        {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map(day => (
                                                            <div key={day}>
                                                                <label className="block text-[11px] font-medium text-gray-500 text-center mb-1">{dayLabels[day]}</label>
                                                                <input
                                                                    type="text"
                                                                    value={entry.days[day] === 0 ? '0' : (entry.days[day] || '')}
                                                                    onChange={(e) => updateWeeklyEntryHours(entry.id, day, e.target.value)}
                                                                    disabled={isReadOnly}
                                                                    className={`text-center ${isReadOnly ? 'input-premium-sm-readonly' : 'input-premium-sm'}`}
                                                                />
                                                            </div>
                                                        ))}
                                                        <div className="flex flex-col justify-center items-center bg-gray-50 rounded-md border border-gray-200">
                                                            <span className="text-[10px] text-gray-500 mb-0.5">Summe</span>
                                                            <span className="font-bold text-brand-primary text-sm">{empTotal} h</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                        )}
                        <div className="flex justify-end pt-4 pr-2">
                            <div className="bg-brand-dark text-white px-6 py-3 rounded-lg shadow-sm flex flex-col items-end space-y-1">
                                <div className="flex items-center space-x-4">
                                    <span className="font-medium">Gesamtstunden:</span>
                                    <span className="text-2xl font-bold">{totals.total} <span className="text-sm font-normal text-gray-300">h</span></span>
                                </div>
                                {(totals.sw > 0 || totals.doc > 0) && (
                                    <div className="text-sm text-gray-300 flex space-x-3">
                                        <span>davon:</span>
                                        <span>Normal: <strong className="text-white">{totals.normal}h</strong></span>
                                        {totals.sw > 0 && <span>SW: <strong className="text-white">{totals.sw}h</strong></span>}
                                        {totals.doc > 0 && <span>Arzt: <strong className="text-white">{totals.doc}h</strong></span>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submit Action */}
                {!isReadOnly && (
                    <div className="flex justify-end pt-4 pb-8">
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-50"
                        >
                            {saving ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            ) : (
                                <Save className="w-5 h-5 mr-2" />
                            )}
                            Wochenbericht speichern
                        </button>
                    </div>
                )}
            </form>
        </DashboardShell>
    );
};
