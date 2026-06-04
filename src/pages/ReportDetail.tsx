import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardShell } from '../components/DashboardShell';
import { db, APP_ID } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Printer, ArrowLeft, Calendar, User, MapPin, CloudSun, Hash } from 'lucide-react';

const getWeekDateRange = (week: any, year: any): string => {
    const w = Number(week);
    const y = Number(year);
    if (!w || !y) return '-';
    const simple = new Date(y, 0, 1 + (w - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    const endDate = new Date(ISOweekStart);
    endDate.setDate(ISOweekStart.getDate() + 6);
    return `${ISOweekStart.toLocaleDateString('de-DE')} - ${endDate.toLocaleDateString('de-DE')}`;
};

const parseHours = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val.replace(',', '.'));
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};

const formatCombinedHours = (emp: any, multiplyWorkerCount: boolean = false): string => {
    const workerCount = multiplyWorkerCount ? (emp.workerCount || 1) : 1;
    const normal = parseHours(emp.hours) * workerCount;
    const sw = parseHours(emp.badWeatherHours) * workerCount;
    const doc = parseHours(emp.doctorHours) * workerCount;

    let result = [];
    if (normal > 0 || (emp.hours === 0 || emp.hours === '0' || emp.hours === '')) {
        if (normal > 0) result.push(`${normal.toString().replace('.', ',')}h`);
    }
    if (sw > 0) result.push(`${sw.toString().replace('.', ',')}h SW`);
    if (doc > 0) result.push(`${doc.toString().replace('.', ',')}h Arzt`);

    if (normal === 0 && sw === 0 && doc === 0) {
        if (typeof emp.hours === 'string' && (emp.hours.trim().toUpperCase() === 'K' || emp.hours.trim().toUpperCase() === 'U' || emp.hours.trim().toUpperCase() === 'F')) {
            return emp.hours.trim().toUpperCase();
        }
        if (result.length > 0) return result.join(' | ');
        
        // Legacy zero
        if (emp.hours === 0 || emp.hours === '0') return '0';
        return '-';
    }

    return result.length > 0 ? result.join(' | ') : '-';
};

const getCombinedTotalValue = (emp: any) => {
    const workerCount = emp.workerCount || 1;
    return (parseHours(emp.hours) + parseHours(emp.badWeatherHours) + parseHours(emp.doctorHours)) * workerCount;
};

export const ReportDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [report, setReport] = useState<any>(null);
    const [companyInfo, setCompanyInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [managerDetails, setManagerDetails] = useState<any>(null);

    useEffect(() => {
        const fetchReport = async () => {
            if (!id) return;
            try {
                // Fetch company settings for the print header
                const companySnap = await getDoc(doc(db, 'apps', APP_ID, 'metadata', 'company_profile'));
                if (companySnap.exists()) {
                    setCompanyInfo(companySnap.data());
                } else {
                    setCompanyInfo({ companyName: "Construction Global Template" });
                }

                // Fetch the actual daily report
                const docSnap = await getDoc(doc(db, 'apps', APP_ID, 'daily_reports', id));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setReport(data);

                    // Attempt to fetch manager name if managerId is set
                    if (data.managerId) {
                        const mSnap = await getDoc(doc(db, 'apps', APP_ID, 'managers', data.managerId));
                        if (mSnap.exists()) {
                            setManagerDetails(mSnap.data());
                        }
                    }

                } else {
                    alert('Dieser Bericht existiert nicht.');
                    navigate('/reports');
                }
            } catch (error) {
                console.error("Error fetching report detail:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [id, navigate]);

    const handlePrint = () => {
        window.open(`/print/daily/${id}`, '_blank');
    };

    const normalizedDailyEmployees = React.useMemo(() => {
        if (!report) return [];
        let arr: any[] = [];
        if (Array.isArray(report.employees)) arr = report.employees;
        else if (Array.isArray(report.employeeEntries)) arr = report.employeeEntries;
        
        let flattened: any[] = [];
        arr.forEach((e: any) => {
            if (typeof e === 'string') {
                flattened.push({ workDescription: e, workerCount: 1, hours: 0 });
            } else if (!e) {
                flattened.push({ workDescription: '-', workerCount: 1, hours: 0 });
            } else if (e.assignedEmployees && e.assignedEmployees.length > 0) {
                e.assignedEmployees.forEach((assigned: any) => {
                    flattened.push({
                        workDescription: e.workDescription ? `${e.workDescription} - ${assigned.name}` : assigned.name,
                        workerCount: 1,
                        hours: assigned.hours,
                        badWeatherHours: assigned.badWeatherHours,
                        doctorHours: assigned.doctorHours
                    });
                });
            } else {
                flattened.push({
                    workDescription: e.workDescription || e.employeeName || e.name || 'Allgemeine Arbeiten',
                    workerCount: e.workerCount || 1,
                    hours: e.hours || 0
                });
            }
        });
        return flattened;
    }, [report]);

    const normalizedWeeklyEntries = React.useMemo(() => {
        if (!report) return [];
        if (Array.isArray(report.weeklyEntries)) return report.weeklyEntries;
        if (Array.isArray(report.employeeEntries)) {
            return report.employeeEntries.map((e: any) => ({
                employeeName: e.employeeName || 'Unbekannt',
                constructionSiteName: report.constructionSite || '-',
                days: e.days || {}
            }));
        }
        if (Array.isArray(report.dailyEntries)) {
            return [{
                employeeName: report.employeeName || 'Unbekannt',
                constructionSiteName: report.constructionSite || '-',
                days: {
                    monday: report.dailyEntries.find((e: any) => e.dayOfWeek === 'Montag')?.hours || 0,
                    tuesday: report.dailyEntries.find((e: any) => e.dayOfWeek === 'Dienstag')?.hours || 0,
                    wednesday: report.dailyEntries.find((e: any) => e.dayOfWeek === 'Mittwoch')?.hours || 0,
                    thursday: report.dailyEntries.find((e: any) => e.dayOfWeek === 'Donnerstag')?.hours || 0,
                    friday: report.dailyEntries.find((e: any) => e.dayOfWeek === 'Freitag')?.hours || 0,
                    saturday: report.dailyEntries.find((e: any) => e.dayOfWeek === 'Samstag')?.hours || 0,
                    sunday: report.dailyEntries.find((e: any) => e.dayOfWeek === 'Sonntag')?.hours || 0,
                }
            }];
        }
        return [];
    }, [report]);

    // Calculate Weekly Report Employee Hours Summary
    const employeeHoursSummary = React.useMemo(() => {
        if (!report || report.type === 'daily' || normalizedWeeklyEntries.length === 0) return [];

        const summaryMap = normalizedWeeklyEntries.reduce((acc: Record<string, number>, entry: any) => {
            const name = entry?.employeeName || 'Unbekannt';
            const hours = parseHours(entry?.days?.monday) +
                parseHours(entry?.days?.tuesday) +
                parseHours(entry?.days?.wednesday) +
                parseHours(entry?.days?.thursday) +
                parseHours(entry?.days?.friday) +
                parseHours(entry?.days?.saturday) +
                parseHours(entry?.days?.sunday);

            if (!acc[name]) {
                acc[name] = 0;
            }
            acc[name] += hours;
            return acc;
        }, {});

        // Convert back to an array for easy rendering, sorted alphabetically
        return Object.keys(summaryMap).map(name => ({
            name,
            totalHours: summaryMap[name]
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [report, normalizedWeeklyEntries]);

    if (loading) {
        return (
            <DashboardShell title="Laden...">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                </div>
            </DashboardShell>
        );
    }

    if (!report) return null;

    return (
        <DashboardShell title={`Tagesbericht Nr. ${report.reportNumber || '-'}`}>
            {/* ACTION BAR (Hidden on Print) */}
            <div className="mb-6 flex justify-between items-center print:hidden">
                <button
                    onClick={() => navigate('/reports')}
                    className="inline-flex items-center text-gray-500 hover:text-gray-700"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Zurück
                </button>

                <button
                    onClick={handlePrint}
                    className="inline-flex items-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors"
                >
                    <Printer className="w-5 h-5 mr-2" />
                    Drucken / PDF
                </button>
            </div>

            {/* PRINT OPTIMIZED CONTAINER */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8 print:p-0 print:border-none print:shadow-none print:w-full print:m-0">

                {/* Print Only Header */}
                <div className="hidden print:block border-b-2 border-brand-dark pb-6 mb-8 mt-4">
                    <div className="flex justify-between items-start">
                        <div>
                            {companyInfo?.logoBase64 ? (
                                <img src={companyInfo.logoBase64} alt="Company Logo" className="h-16 object-contain mb-2" />
                            ) : (
                                <h2 className="text-2xl font-bold uppercase tracking-wider">{companyInfo?.companyName}</h2>
                            )}
                        </div>
                        <div className="text-right text-sm text-black">
                            <p className="font-bold text-base">{companyInfo?.companyName}</p>
                            <p>{companyInfo?.address}</p>
                            {(companyInfo?.postalCode || companyInfo?.city) && (
                                <p>{companyInfo?.postalCode} {companyInfo?.city}</p>
                            )}
                            <p>{companyInfo?.phone}</p>
                            <p>{companyInfo?.email}</p>
                        </div>
                    </div>
                    <div className="mt-8 text-center">
                        <h1 className="text-3xl font-bold uppercase tracking-widest text-black">
                            Bau-Tagesbericht Nr. {report.reportNumber || '-'}
                        </h1>
                    </div>
                </div>

                {/* Grid Metadata */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8 p-4 bg-gray-50 rounded-lg print:bg-transparent print:p-0 print:border print:border-gray-300 print:mb-8 print:grid-cols-3">
                    <div className="flex items-center space-x-3 print:p-3">
                        <MapPin className="w-5 h-5 text-gray-400 print:hidden" />
                        <div>
                            <span className="block text-xs text-gray-500 uppercase font-semibold">Baustelle</span>
                            <span className="text-base font-bold text-gray-900">{report.constructionSite || '-'}</span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3 print:p-3">
                        <Calendar className="w-5 h-5 text-gray-400 print:hidden" />
                        <div>
                            <span className="block text-xs text-gray-500 uppercase font-semibold">Datum</span>
                            <span className="text-base font-bold text-gray-900">
                                {report.date ? new Date(report.date).toLocaleDateString('de-DE') : '-'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3 print:p-3">
                        <Hash className="w-5 h-5 text-gray-400 print:hidden" />
                        <div>
                            <span className="block text-xs text-gray-500 uppercase font-semibold">KW</span>
                            <span className="text-base font-bold text-gray-900">{report.calendarWeek || '-'}</span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3 print:p-3">
                        <Calendar className="w-5 h-5 text-gray-400 print:hidden" />
                        <div>
                            <span className="block text-xs text-gray-500 uppercase font-semibold">Zeitraum</span>
                            <span className="text-base font-medium text-gray-900">{getWeekDateRange(report.calendarWeek, report.year || (report.date ? new Date(report.date).getFullYear() : new Date().getFullYear()))}</span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3 print:p-3 print:border-t print:border-gray-200">
                        <User className="w-5 h-5 text-gray-400 print:hidden" />
                        <div>
                            <span className="block text-xs text-gray-500 uppercase font-semibold">Bauleiter</span>
                            <span className="text-base font-medium text-gray-900">
                                {report.managerName || (managerDetails ? `${managerDetails.firstName} ${managerDetails.lastName}` : 'Unbekannt')}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3 print:p-3 print:border-t print:border-gray-200">
                        <CloudSun className="w-5 h-5 text-gray-400 print:hidden" />
                        <div>
                            <span className="block text-xs text-gray-500 uppercase font-semibold">Wetter</span>
                            <span className="text-base font-medium text-gray-900">{report.weather || '-'}</span>
                        </div>
                    </div>
                </div>

                {/* Employees Table */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2 print:border-black">
                        Eingesetztes Personal & Stunden
                    </h3>

                    <div className="overflow-hidden">
                        <table className="min-w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-gray-200 print:border-black text-sm">
                                    <th className="py-3 px-2 font-semibold text-gray-700 print:text-black">Arbeitsleistung</th>
                                    <th className="py-3 px-2 font-semibold text-gray-700 print:text-black text-center">Anzahl Mitarbeiter</th>
                                    <th className="py-3 px-2 font-semibold text-gray-700 print:text-black text-center">Stunden pro Mitarbeiter</th>
                                    <th className="py-3 px-2 font-semibold text-gray-700 print:text-black text-right">Gesamtstunden</th>
                                </tr>
                            </thead>
                            <tbody>
                                {normalizedDailyEmployees.length > 0 ? (
                                    normalizedDailyEmployees.map((emp: any, i: number) => (
                                        <tr key={i} className="border-b border-gray-100 print:border-gray-300 text-sm">
                                            <td className="py-3 px-2 text-gray-800 print:text-black">{emp.workDescription || '-'}</td>
                                            <td className="py-3 px-2 text-gray-800 print:text-black text-center">{emp.workerCount || 1}</td>
                                            <td className="py-3 px-2 text-gray-800 print:text-black text-center">{formatCombinedHours(emp, false)}</td>
                                            <td className="py-3 px-2 text-gray-800 print:text-black text-right font-medium">{formatCombinedHours(emp, true)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="py-4 text-center text-gray-500">Keine Mitarbeiter erfasst.</td>
                                    </tr>
                                )}
                                <tr className="font-bold border-t-2 border-gray-200 print:border-black bg-gray-50 print:bg-transparent">
                                    <td colSpan={3} className="py-3 px-2 text-gray-900 print:text-black text-right pr-4">Gesamtsumme:</td>
                                    <td className="py-3 px-2 text-gray-900 print:text-black text-right border-l border-gray-100 print:border-0 pl-4">
                                        {normalizedDailyEmployees.reduce((acc: number, curr: any) => acc + getCombinedTotalValue(curr), 0).toString().replace('.', ',')} h
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Weekly Report Specific Matrix Table (if it were implemented here) - currently only daily report uses employees array in ReportDetail.tsx */}
                {/* Normally ReportDetail.tsx doesn't show weekly reports according to its existing structure (it looks hardcoded for daily based on 'report.employees' mapping without weeklyEntries mapping), but adding the summary here conditionally if it WAS a weekly report */}

                {/* Weekly Report Specific: Employee Hours Summary */}
                {report.type !== 'daily' && employeeHoursSummary.length > 0 && (
                    <div className="mb-12 print:break-inside-avoid">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2 print:border-black">
                            Gesamtstunden pro Mitarbeiter (Abrechnungsübersicht)
                        </h3>
                        <div className="bg-gray-50 print:bg-transparent p-4 rounded-lg print:border print:border-gray-300 print:p-0">
                            <table className="min-w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-300 text-sm">
                                        <th className="py-2 px-4 print:px-2 font-semibold text-gray-700 print:text-black">Mitarbeiter</th>
                                        <th className="py-2 px-4 print:px-2 text-right font-semibold text-gray-700 print:text-black">Gesamtstunden</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employeeHoursSummary.map((emp: any, idx: number) => (
                                        <tr key={idx} className="border-b border-gray-200 last:border-0 text-sm">
                                            <td className="py-2 px-4 print:px-2 text-gray-800 print:text-black">{emp.name}</td>
                                            <td className="py-2 px-4 print:px-2 text-right font-medium text-gray-800 print:text-black">{(emp.totalHours || 0).toString().replace('.', ',')} h</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Used Materials */}
                {typeof report.usedMaterials === 'string' && report.usedMaterials.trim() !== '' && (
                    <div className="mb-12 print:break-inside-avoid">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2 print:border-black">
                            Verwendete Materialien
                        </h3>
                        <p className="whitespace-pre-wrap text-gray-800 print:text-black bg-gray-50 p-4 rounded-lg print:bg-transparent print:p-0 print:mt-2">
                            {report.usedMaterials}
                        </p>
                    </div>
                )}

                {/* Used Equipment */}
                {typeof report.usedEquipment === 'string' && report.usedEquipment.trim() !== '' && (
                    <div className="mb-12 print:break-inside-avoid">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2 print:border-black">
                            Verwendete Geräte
                        </h3>
                        <p className="whitespace-pre-wrap text-gray-800 print:text-black bg-gray-50 p-4 rounded-lg print:bg-transparent print:p-0 print:mt-2">
                            {report.usedEquipment}
                        </p>
                    </div>
                )}

                {/* Signatures */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 mt-16 print:mt-24 print:break-inside-avoid print:grid-cols-2">
                    <div className="text-center">
                        <div className="h-32 mb-4 border-b border-gray-400 flex items-end justify-center pb-2 relative">
                            {report.managerSignature ? (
                                <img src={report.managerSignature} alt="Unterschrift Bauleiter" className="max-h-20 w-auto object-contain pb-2" />
                            ) : null}
                        </div>
                        <p className="font-bold text-gray-900 print:text-black">Bauleiter</p>
                        <p className="text-sm text-gray-500 print:text-black">Unterschrift</p>
                    </div>

                    <div className="text-center">
                        <div className="h-32 mb-4 border-b border-gray-400 flex items-end justify-center pb-2 relative">
                            {report.clientSignature ? (
                                <img src={report.clientSignature} alt="Unterschrift Bauherr/-Vertretung" className="max-h-20 w-auto object-contain pb-2" />
                            ) : null}
                        </div>
                        <p className="font-bold text-gray-900 print:text-black">Bauherr/-Vertretung</p>
                        <p className="text-sm text-gray-500 print:text-black">Unterschrift</p>
                    </div>
                </div>

                {/* Print Footer */}
                <div className="hidden print:block mt-16 text-center text-xs text-gray-500">
                    <p>Generiert aus Construction Global Template am {new Date().toLocaleDateString('de-DE')} um {new Date().toLocaleTimeString('de-DE')}</p>
                </div>

            </div>
        </DashboardShell>
    );
};
