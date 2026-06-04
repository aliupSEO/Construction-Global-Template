import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { PDFDocument } from 'pdf-lib';
import { db, APP_ID } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

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

const renderStr = (val: any, fallback: string = ''): string => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'object') {
        // If it's a Firestore Timestamp, try to format it
        if (val.seconds) return new Date(val.seconds * 1000).toLocaleDateString('de-DE');
        return JSON.stringify(val);
    }
    return String(val);
};

const parseHours = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val.replace(',', '.'));
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};

const formatHours = (val: any): string => {
    if (val === null || val === undefined || val === '') return '-';
    
    const isString = typeof val === 'string';
    const strVal = isString ? val.trim() : '';
    const upperStr = strVal.toUpperCase();
    
    if (isString && upperStr === '-') return '-';
    
    // Pure special codes default to 8h (except F and U which are just their letter)
    if (upperStr === 'K') return 'K';
    if (upperStr === 'U') return 'U';
    if (upperStr === 'F') return 'F';

    // If it's a complex string containing text (e.g. '4 K', '5 SW', '4|3 SW')
    if (isString && /[A-Z]/.test(upperStr)) {
        return strVal.replace(/Arzt/gi, 'A'); // Shorten Arzt to A and return
    }
    
    // Parse to number and handle valid format
    if (typeof val === 'number' || (isString && strVal !== '')) {
        const parsed = parseHours(val);
        // Explicitly format 0 as '-' for cleaner tables
        if (parsed === 0) return '-';
        return parsed.toString().replace('.', ',');
    }
    return String(val);
};

const formatCombinedHours = (emp: any, multiplyWorkerCount: boolean = false): string => {
    if (!emp || typeof emp !== 'object') return formatHours(emp);

    const workerCount = multiplyWorkerCount ? (emp.workerCount || 1) : 1;
    const normal = parseHours(emp.hours) * workerCount;
    const sw = parseHours(emp.badWeatherHours) * workerCount;
    const doc = parseHours(emp.doctorHours) * workerCount;

    let result = [];
    if (normal > 0 || (emp.hours === 0 || emp.hours === '0' || emp.hours === '')) {
        if (normal > 0) result.push(`${normal.toString().replace('.', ',')}h`);
    }
    if (sw > 0) result.push(`${sw.toString().replace('.', ',')}h SW`);
    if (doc > 0) result.push(`${doc.toString().replace('.', ',')}h A`);

    if (normal === 0 && sw === 0 && doc === 0) {
        if (typeof emp.hours === 'string' && (emp.hours.trim().toUpperCase() === 'K' || emp.hours.trim().toUpperCase() === 'U' || emp.hours.trim().toUpperCase() === 'F')) {
            return emp.hours.trim().toUpperCase();
        }
        if (result.length > 0) return result.join(' | ');
        
        if (emp.hours === 0 || emp.hours === '0') return '0';
        return '-';
    }

    return result.length > 0 ? result.join(' | ') : '-';
};

const getCombinedTotalValue = (emp: any) => {
    if (!emp || typeof emp !== 'object') return parseHours(emp);
    const workerCount = emp.workerCount || 1;
    return (parseHours(emp.hours) + parseHours(emp.badWeatherHours) + parseHours(emp.doctorHours)) * workerCount;
};

const calculateTotalHoursFromString = (val: any) => {
    let hours = 0;
    let sw = 0;
    let arzt = 0;
    let sick = 0;
    let vacation = 0;
    let holiday = 0;

    if (!val) return { hours, sw, arzt, sick, vacation, holiday };
    if (typeof val === 'number') {
        hours = val;
        return { hours, sw, arzt, sick, vacation, holiday };
    }
    
    const strVal = val.toString().trim().toUpperCase();
    if (strVal === 'K') { sick += 8; return { hours, sw, arzt, sick, vacation, holiday }; }
    if (strVal === 'U') { vacation += 8; return { hours, sw, arzt, sick, vacation, holiday }; }
    if (strVal === 'F') { holiday += 8; return { hours, sw, arzt, sick, vacation, holiday }; }
    if (strVal === '-') return { hours, sw, arzt, sick, vacation, holiday };
    
    const parts = strVal.split('|');
    if (parts.length === 1 && !strVal.includes('SW') && !strVal.includes('ARZT') && !strVal.includes('A') && !strVal.includes('K') && !strVal.includes('U') && !strVal.includes('F')) {
         hours += parseHours(strVal);
    } else {
         parts.forEach((part: string) => {
             const p = part.trim();
             const numMatch = p.match(/([\d,.]+)/);
             const num = numMatch ? parseFloat(numMatch[1].replace(',', '.')) : 0;
             const addNum = numMatch ? num : 8;
             
             if (p === 'K' || p.includes(' K') || p.startsWith('K ')) sick += addNum;
             else if (p === 'U' || p.includes(' U') || p.startsWith('U ')) vacation += addNum;
             else if (p === 'F' || p.includes(' F') || p.startsWith('F ')) holiday += addNum;
             else if (p.includes('SW')) sw += num;
             else if (p.includes('ARZT') || p.endsWith('A') || p.endsWith(' A')) arzt += num;
             else hours += num;
         });
    }
    
    return { hours, sw, arzt, sick, vacation, holiday };
};

const formatSummaryTotals = (hours: number, sw: number, arzt: number, sick: number, vac: number, hol: number): string => {
    let result = [];
    if (hours > 0) result.push(`${hours.toString().replace('.', ',')}h`);
    if (sw > 0) result.push(`${sw.toString().replace('.', ',')}h SW`);
    if (arzt > 0) result.push(`${arzt.toString().replace('.', ',')}h A`);
    if (sick > 0) result.push(`${(sick / 8).toString().replace('.', ',')} K`);
    if (vac > 0) result.push(`${(vac / 8).toString().replace('.', ',')} U`);
    if (hol > 0) result.push(`${(hol / 8).toString().replace('.', ',')} F`);
    return result.length > 0 ? result.join(' | ') : '-';
};

const getRowTotals = (days: any) => {
    let hours = 0, sw = 0, arzt = 0, sick = 0, vac = 0, hol = 0;
    Object.values(days || {}).forEach((val: any) => {
        const parsed = calculateTotalHoursFromString(val);
        hours += parsed.hours;
        sw += parsed.sw;
        arzt += parsed.arzt;
        sick += parsed.sick;
        vac += parsed.vacation;
        hol += parsed.holiday;
    });
    return { hours, sw, arzt, sick, vac, hol };
};

const SingleReportPrint = ({ report, companyInfo, isDaily }: { report: any, companyInfo: any, isDaily: boolean }) => {
    const normalizedDailyEmployees = React.useMemo(() => {
        if (!report) return [];
        let arr: any[] = [];
        if (Array.isArray(report.employees)) arr = report.employees;
        else if (Array.isArray(report.employeeEntries)) arr = report.employeeEntries;
        
        return arr.map((e: any) => {
            if (typeof e === 'string') return { workDescription: e, workerCount: 1, hours: 0, assignedEmployees: [] };
            if (!e) return { workDescription: '-', workerCount: 1, hours: 0, assignedEmployees: [] };
            return {
                constructionSite: e.constructionSite || report.constructionSite || '-',
                workDescription: e.workDescription || e.employeeName || e.name || 'Allgemeine Arbeiten',
                workerCount: e.workerCount || 1,
                hours: e.hours || 0,
                assignedEmployees: e.assignedEmployees || []
            };
        });
    }, [report]);

    const dailyTotalHours = React.useMemo(() => {
        if (!isDaily) return 0;
        return normalizedDailyEmployees.reduce((acc: number, curr: any) => {
            if (curr.assignedEmployees && curr.assignedEmployees.length > 0) {
                return acc + curr.assignedEmployees.reduce((sum: number, emp: any) => sum + getCombinedTotalValue(emp), 0);
            }
            return acc + getCombinedTotalValue(curr);
        }, 0);
    }, [isDaily, normalizedDailyEmployees]);

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
        if (isDaily || !report || normalizedWeeklyEntries.length === 0) return [];

        // Group entries by employee name
        const entriesByEmployee: Record<string, any[]> = {};
        normalizedWeeklyEntries.forEach((entry: any) => {
            const name = entry?.employeeName || 'Unbekannt';
            if (!entriesByEmployee[name]) {
                entriesByEmployee[name] = [];
            }
            entriesByEmployee[name].push(entry);
        });

        // Calculate aggregated totals for each employee
        return Object.keys(entriesByEmployee).map(name => {
            const entries = entriesByEmployee[name];
            
            let totalHours = 0;
            let swHours = 0;
            let arztHours = 0;
            let sickDays = 0;
            let vacationDays = 0;
            let holidayDays = 0;
            const aggregatedDays: Record<string, any> = {};

            const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

            weekdays.forEach(day => {
                let dayHours = 0;
                let daySw = 0;
                let dayArzt = 0;
                let daySick = 0;
                let dayVacation = 0;
                let dayHoliday = 0;
                let hasValue = false;

                entries.forEach(entry => {
                    const val = entry?.days?.[day];
                    if (val !== undefined && val !== '') {
                        hasValue = true;
                        const parsed = calculateTotalHoursFromString(val);
                        dayHours += parsed.hours;
                        daySw += parsed.sw;
                        dayArzt += parsed.arzt;
                        // Use max for sick, vacation, holiday
                        daySick = Math.max(daySick, parsed.sick);
                        dayVacation = Math.max(dayVacation, parsed.vacation);
                        dayHoliday = Math.max(dayHoliday, parsed.holiday);
                    }
                });

                if (hasValue) {
                    if (daySick > 0 && dayHours === 0 && daySw === 0 && dayArzt === 0 && dayVacation === 0 && dayHoliday === 0) {
                        aggregatedDays[day] = 'K';
                    } else if (dayVacation > 0 && dayHours === 0 && daySw === 0 && dayArzt === 0 && daySick === 0 && dayHoliday === 0) {
                        aggregatedDays[day] = 'U';
                    } else if (dayHoliday > 0 && dayHours === 0 && daySw === 0 && dayArzt === 0 && daySick === 0 && dayVacation === 0) {
                        aggregatedDays[day] = 'F';
                    } else {
                        aggregatedDays[day] = formatSummaryTotals(dayHours, daySw, dayArzt, daySick, dayVacation, dayHoliday);
                    }

                    // Add to employee total metrics
                    totalHours += dayHours;
                    swHours += daySw;
                    arztHours += dayArzt;
                    sickDays += daySick;
                    vacationDays += dayVacation;
                    holidayDays += dayHoliday;
                }
            });

            return {
                name,
                totalHours,
                swHours,
                arztHours,
                sickDays,
                vacationDays,
                holidayDays,
                days: aggregatedDays
            };
        }).sort((a, b) => {
            const sumA = a.totalHours + a.swHours + a.arztHours;
            const sumB = b.totalHours + b.swHours + b.arztHours;
            return sumB - sumA;
        });
    }, [isDaily, report, normalizedWeeklyEntries]);

    const groupedWeeklyEntries = React.useMemo(() => {
        if (isDaily || !normalizedWeeklyEntries) return {};
        const groups: Record<string, any[]> = {};
        
        normalizedWeeklyEntries.forEach((entry: any) => {
            const site = entry?.constructionSiteName || 'Unbekannt';
            if (!groups[site]) groups[site] = [];
            
            const empName = entry?.employeeName || 'Unbekannt';
            
            // Check if we already have a row for this employee at this site
            const existingIndex = groups[site].findIndex(e => (e?.employeeName || 'Unbekannt') === empName);
            
            if (existingIndex !== -1) {
                // Merge days
                const existingEntry = groups[site][existingIndex];
                const newDays = { ...existingEntry.days };
                const entryDays = entry.days || {};
                
                ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
                    const existingValStr = typeof newDays[day] === 'string' ? newDays[day].trim().toUpperCase() : '';
                    const newValStr = typeof entryDays[day] === 'string' ? entryDays[day].trim().toUpperCase() : '';
                    
                    if (newValStr === 'K' || newValStr === 'U' || newValStr === 'F') {
                        newDays[day] = newValStr;
                    } else if (existingValStr !== 'K' && existingValStr !== 'U' && existingValStr !== 'F') {
                        let existingNum = 0;
                        if (typeof newDays[day] === 'number') existingNum = newDays[day];
                        else if (typeof newDays[day] === 'string') existingNum = parseFloat(newDays[day].replace(',', '.')) || 0;
                        
                        let newNum = 0;
                        if (typeof entryDays[day] === 'number') newNum = entryDays[day];
                        else if (typeof entryDays[day] === 'string') newNum = parseFloat(entryDays[day].replace(',', '.')) || 0;
                        
                        if (existingNum || newNum) {
                            newDays[day] = existingNum + newNum;
                        } else if (entryDays[day] !== undefined && entryDays[day] !== '' && (newDays[day] === undefined || newDays[day] === '')) {
                            newDays[day] = entryDays[day];
                        }
                    }
                });
                
                groups[site][existingIndex] = {
                    ...existingEntry,
                    days: newDays
                };
            } else {
                // Create a deep copy to avoid mutating the original
                groups[site].push(JSON.parse(JSON.stringify(entry)));
            }
        });
        return groups;
    }, [isDaily, normalizedWeeklyEntries]);

    const weeklyGrandTotals = React.useMemo(() => {
        let hours = 0, sw = 0, arzt = 0, sick = 0, vac = 0, hol = 0;
        if (!isDaily && employeeHoursSummary) {
            employeeHoursSummary.forEach(emp => {
                hours += emp.totalHours || 0;
                sw += emp.swHours || 0;
                arzt += emp.arztHours || 0;
                sick += emp.sickDays || 0;
                vac += emp.vacationDays || 0;
                hol += emp.holidayDays || 0;
            });
        }
        return { hours, sw, arzt, sick, vac, hol };
    }, [isDaily, employeeHoursSummary]);

    return (
        <div className="m-0 p-0 bg-white" style={{ fontFamily: 'sans-serif' }}>
            {/* Header / Company Info - Einzeilig & Ohne Logo */}
            <div className="border-b-2 border-slate-800 pb-1.5 mb-2 text-center text-[10px] text-black flex flex-wrap justify-center items-center gap-x-1.5 gap-y-1">
                <span className="font-bold text-sm uppercase tracking-wider">{renderStr(companyInfo?.companyName)}</span>
                
                {(companyInfo?.address || companyInfo?.city) && (
                    <>
                        <span>-</span>
                        <span>{renderStr(companyInfo?.address)}, {renderStr(companyInfo?.postalCode)} {renderStr(companyInfo?.city)}</span>
                    </>
                )}
                
                {companyInfo?.phone && (
                    <>
                        <span>-</span>
                        <span>{renderStr(companyInfo?.phone)}</span>
                    </>
                )}
                
                {companyInfo?.email && (
                    <>
                        <span>-</span>
                        <span>{renderStr(companyInfo?.email)}</span>
                    </>
                )}
                
                {companyInfo?.website && (
                    <>
                        <span>-</span>
                        <span>{renderStr(companyInfo?.website)}</span>
                    </>
                )}
                
                {companyInfo?.vatId && (
                    <>
                        <span>-</span>
                        <span>UID: {renderStr(companyInfo?.vatId)}</span>
                    </>
                )}
                
                {companyInfo?.commercialRegister && (
                    <>
                        <span>-</span>
                        <span>FN: {renderStr(companyInfo?.commercialRegister)}</span>
                    </>
                )}
            </div>

            {/* Document Title */}
            <div className="text-center mb-3">
                <h1 className="text-2xl font-bold uppercase tracking-widest text-black">
                    {isDaily 
                        ? `Bau-Tagesbericht Nr. ${renderStr(report.reportNumber, '-')}` 
                        : `Wochenbericht KW ${renderStr(report.calendarWeek)} / ${renderStr(report.year)}${report.month ? ` (${new Date(2000, report.month - 1).toLocaleString('de-DE', { month: 'long' })})` : ''}`
                    }
                </h1>
            </div>

            {/* Meta Data */}
            <div className="bg-transparent p-2 rounded-lg mb-2 grid grid-cols-3 gap-2 border border-slate-300 text-sm text-black">
                {isDaily ? (
                    <>
                        <div><span className="font-semibold">Datum:</span> {renderStr(report.date, '-')}</div>
                        <div><span className="font-semibold">KW:</span> {renderStr(report.calendarWeek, '-')}</div>
                        <div><span className="font-semibold">Wetter:</span> {renderStr(report.weather, '-')}</div>
                        <div><span className="font-semibold">Baustelle:</span> {renderStr(report.constructionSite, '-')}</div>
                        <div><span className="font-semibold">Bauleiter:</span> {renderStr(report.managerName, '-')}</div>
                    </>
                ) : (
                    <>
                        <div><span className="font-semibold">KW / Jahr:</span> {renderStr(report.calendarWeek)} / {renderStr(report.year)}</div>
                        <div><span className="font-semibold">Zeitraum:</span> {getWeekDateRange(report.calendarWeek, report.year)}</div>
                    </>
                )}
            </div>

            {/* Content Table */}
            <div className="mb-4 flow-root text-black">
                {!isDaily && (
                    <h3 className="text-lg font-bold mb-2 border-b border-slate-300 pb-1">
                        Arbeitszeiten & Leistungen
                    </h3>
                )}

                {isDaily ? (
                    <div className="block flow-root w-full relative">
                        {/* Linke Spalte: Leistungen & Personal (65%) */}
                        <div className="w-[65%] float-left pr-4">
                            <h3 className="text-lg font-bold mb-2 border-b border-slate-300 pb-1">Eingesetztes Personal & Leistungen</h3>
                            
                            {normalizedDailyEmployees.length > 0 ? (
                                normalizedDailyEmployees.map((block: any, i: number) => (
                                    <div key={i} className="mb-3 avoid-break">
                                        <div className="bg-slate-100 p-1 font-bold text-sm mb-1 border-l-4 border-slate-800 text-black">
                                            {renderStr(block.workDescription)}
                                        </div>
                                        
                                        {block.assignedEmployees && block.assignedEmployees.length > 0 ? (
                                            <table className="w-full text-left text-sm border-collapse mb-1">
                                                <thead>
                                                    <tr className="border-b border-slate-300 text-slate-700">
                                                        <th className="py-1 font-medium w-[45%]">Mitarbeiter</th>
                                                        <th className="py-1 font-medium w-[25%] text-left pl-2">Rolle</th>
                                                        <th className="py-1 font-medium w-[30%] text-right">Stunden</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {block.assignedEmployees.map((emp: any, j: number) => (
                                                        <tr key={j} className="border-b border-slate-200 avoid-break">
                                                            <td className="py-1">{renderStr(emp.name)}</td>
                                                            <td className="py-1 text-left pl-2">{renderStr(emp.role, '-')}</td>
                                                            <td className="py-1 text-right whitespace-nowrap">{formatCombinedHours(emp)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            /* Legacy Fallback */
                                            <table className="w-full text-left text-sm border-collapse mb-1">
                                                <thead>
                                                    <tr className="border-b border-slate-300 text-slate-700">
                                                        <th className="py-1 font-medium text-center">Anzahl Mitarbeiter</th>
                                                        <th className="py-1 font-medium text-center">Stunden/MA</th>
                                                        <th className="py-1 font-medium text-right">Gesamt</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr className="border-b border-slate-200 avoid-break">
                                                        <td className="py-1 text-center">{renderStr(block.workerCount || 1)}</td>
                                                        <td className="py-1 text-center whitespace-nowrap">{formatCombinedHours(block, false)}</td>
                                                        <td className="py-1 text-right whitespace-nowrap">{formatCombinedHours(block, true)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 py-2">Keine Tagesleistungen erfasst.</p>
                            )}

                            {/* Gesamtstunden Block - Jetzt mit avoid-break */}
                            <div className="flex justify-end border-t-2 border-slate-800 pt-1 mt-2 avoid-break">
                                <span className="font-bold mr-4">Gesamtstunden:</span>
                                <span className="font-bold">{formatHours(dailyTotalHours)} h</span>
                            </div>
                        </div>

                        {/* Rechte Spalte: Material & Sonstiges (35%) */}
                        <div className="w-[35%] float-right pl-4 flex flex-col gap-4">
                            <div className="avoid-break">
                                <h3 className="text-lg font-bold mb-1 border-b border-slate-300 pb-1">Verwendete Materialien</h3>
                                {typeof report.usedMaterials === 'string' && report.usedMaterials.trim() !== '' ? (
                                    <p className="whitespace-pre-wrap text-sm">{report.usedMaterials}</p>
                                ) : (
                                    <p className="text-sm text-slate-500">- Keine Angaben -</p>
                                )}
                            </div>

                            <div className="avoid-break">
                                <h3 className="text-lg font-bold mb-1 border-b border-slate-300 pb-1">Verwendete Geräte</h3>
                                {typeof report.usedEquipment === 'string' && report.usedEquipment.trim() !== '' ? (
                                    <p className="whitespace-pre-wrap text-sm">{report.usedEquipment}</p>
                                ) : (
                                    <p className="text-sm text-slate-500">- Keine Angaben -</p>
                                )}
                            </div>
                        </div>
                        
                        {/* Clearfix */}
                        <div className="clear-both"></div>
                    </div>
                ) : (
                    // Weekly Report Matrix Tables Grouped by Site
                    <div className="flex flex-col gap-6">
                        {Object.keys(groupedWeeklyEntries).length > 0 ? (
                            Object.keys(groupedWeeklyEntries).map((site, index) => {
                                const siteEntries = groupedWeeklyEntries[site];
                                const siteTotalObj = siteEntries.reduce((acc: any, entry: any) => {
                                    const r = getRowTotals(entry?.days);
                                    return {
                                        hours: acc.hours + r.hours,
                                        sw: acc.sw + r.sw,
                                        arzt: acc.arzt + r.arzt,
                                        sick: acc.sick + r.sick,
                                        vac: acc.vac + r.vac,
                                        hol: acc.hol + r.hol
                                    };
                                }, { hours: 0, sw: 0, arzt: 0, sick: 0, vac: 0, hol: 0 });

                                return (
                                    <div key={index} className="avoid-break shadow-sm border border-slate-300 rounded-lg overflow-hidden">
                                        <div className="bg-slate-100 p-2 font-bold text-sm border-l-4 border-slate-800 text-black">
                                            {site}
                                        </div>
                                        <div className="p-0">
                                            <table className="w-full text-left border-collapse table-fixed">
                                                <thead>
                                                    <tr className="border-b-2 border-slate-800 bg-white">
                                                        <th className="w-[28%] py-2 px-2">Mitarbeiter</th>
                                                        <th className="w-[9%] py-2 text-left px-1 text-xs">Mo</th>
                                                        <th className="w-[9%] py-2 text-left px-1 text-xs">Di</th>
                                                        <th className="w-[9%] py-2 text-left px-1 text-xs">Mi</th>
                                                        <th className="w-[9%] py-2 text-left px-1 text-xs">Do</th>
                                                        <th className="w-[9%] py-2 text-left px-1 text-xs">Fr</th>
                                                        <th className="w-[9%] py-2 text-left px-1 text-xs">Sa</th>
                                                        <th className="w-[18%] py-2 px-2 text-right">Summe</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {siteEntries.map((emp: any, j: number) => {
                                                        const rTotals = getRowTotals(emp?.days);
                                                        return (
                                                            <tr key={j} className="border-b border-slate-200 last:border-0 avoid-break text-black">
                                                                <td className="py-2 px-2 text-sm truncate" title={renderStr(emp.employeeName)}><span className="hidden sm:inline">{renderStr(emp.employeeName)}</span><span className="sm:hidden">{renderStr(emp.employeeName).split(',')[0]}</span></td>
                                                                <td className="py-2 text-left px-1 text-xs whitespace-nowrap font-medium text-black">{formatCombinedHours(emp.days?.monday)}</td>
                                                                <td className="py-2 text-left px-1 text-xs whitespace-nowrap font-medium text-black">{formatCombinedHours(emp.days?.tuesday)}</td>
                                                                <td className="py-2 text-left px-1 text-xs whitespace-nowrap font-medium text-black">{formatCombinedHours(emp.days?.wednesday)}</td>
                                                                <td className="py-2 text-left px-1 text-xs whitespace-nowrap font-medium text-black">{formatCombinedHours(emp.days?.thursday)}</td>
                                                                <td className="py-2 text-left px-1 text-xs whitespace-nowrap font-medium text-black">{formatCombinedHours(emp.days?.friday)}</td>
                                                                <td className="py-2 text-left px-1 text-xs whitespace-nowrap font-medium text-black">{formatCombinedHours(emp.days?.saturday)}</td>
                                                                <td className="py-2 px-2 text-right font-bold text-xs whitespace-nowrap">{formatSummaryTotals(rTotals.hours, rTotals.sw, rTotals.arzt, rTotals.sick, rTotals.vac, rTotals.hol)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                    <tr className="font-bold bg-slate-50 avoid-break text-black">
                                                        <td colSpan={7} className="py-2 text-right pr-4 text-sm">Zwischensumme Baustelle:</td>
                                                        <td className="py-2 pr-3 text-right text-sm font-bold whitespace-nowrap">{formatSummaryTotals(siteTotalObj.hours, siteTotalObj.sw, siteTotalObj.arzt, siteTotalObj.sick, siteTotalObj.vac, siteTotalObj.hol)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-slate-500 text-center py-4">Keine Daten erfasst.</p>
                        )}
                        
                        {Object.keys(groupedWeeklyEntries).length > 0 && (
                            <div className="flex justify-end border-t-2 border-slate-800 pt-2 mt-2 avoid-break text-black">
                                <span className="font-bold mr-4 text-lg">Gesamtsumme alle Baustellen:</span>
                                <span className="font-bold text-lg text-brand-primary whitespace-nowrap">
                                    {formatSummaryTotals(weeklyGrandTotals.hours, weeklyGrandTotals.sw, weeklyGrandTotals.arzt, weeklyGrandTotals.sick, weeklyGrandTotals.vac, weeklyGrandTotals.hol)}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Weekly Report Specific: Employee Hours Summary */}
            {!isDaily && employeeHoursSummary.length > 0 && (
                <div className="mb-6 avoid-break text-black">
                    <h3 className="text-lg font-bold mb-2 border-b border-slate-300 pb-1">Gesamtstunden pro Mitarbeiter (Abrechnungsübersicht)</h3>
                    <div className="bg-transparent border border-slate-300 p-0 rounded-lg">
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead>
                                <tr className="border-b border-slate-300 bg-slate-50">
                                    <th className="w-[28%] py-2 px-2 font-semibold text-black">Mitarbeiter</th>
                                    <th className="w-[9%] py-2 text-left px-1 text-xs font-semibold text-black">Mo</th>
                                    <th className="w-[9%] py-2 text-left px-1 text-xs font-semibold text-black">Di</th>
                                    <th className="w-[9%] py-2 text-left px-1 text-xs font-semibold text-black">Mi</th>
                                    <th className="w-[9%] py-2 text-left px-1 text-xs font-semibold text-black">Do</th>
                                    <th className="w-[9%] py-2 text-left px-1 text-xs font-semibold text-black">Fr</th>
                                    <th className="w-[9%] py-2 text-left px-1 text-xs font-semibold text-black">Sa</th>
                                    <th className="w-[18%] py-2 px-2 text-right font-semibold text-black">Summe</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employeeHoursSummary.map((emp: any, idx: number) => (
                                    <tr key={idx} className="border-b border-slate-200 last:border-0 avoid-break text-black">
                                        <td className="py-2 px-2 text-sm truncate" title={renderStr(emp.name)}><span className="hidden sm:inline">{renderStr(emp.name)}</span><span className="sm:hidden">{renderStr(emp.name).split(',')[0]}</span></td>
                                        <td className="py-2 text-left px-1 text-xs whitespace-nowrap font-medium text-black">{formatHours(emp.days?.monday)}</td>
                                        <td className="py-2 text-left px-1 text-xs whitespace-nowrap font-medium text-black">{formatHours(emp.days?.tuesday)}</td>
                                        <td className="py-2 text-left px-1 text-xs whitespace-nowrap font-medium text-black">{formatHours(emp.days?.wednesday)}</td>
                                        <td className="py-2 text-left px-1 text-xs whitespace-nowrap font-medium text-black">{formatHours(emp.days?.thursday)}</td>
                                        <td className="py-2 text-left px-1 text-xs whitespace-nowrap font-medium text-black">{formatHours(emp.days?.friday)}</td>
                                        <td className="py-2 text-left px-1 text-xs whitespace-nowrap font-medium text-black">{formatHours(emp.days?.saturday)}</td>
                                        <td className="py-2 px-2 text-right font-bold text-xs whitespace-nowrap">
                                            {formatSummaryTotals(emp.totalHours, emp.swHours, emp.arztHours, emp.sickDays, emp.vacationDays, emp.holidayDays)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}


            {/* Signatures Area - Platzsparend optimiert & Page-Break sicher */}
            {isDaily && (
                <div 
                    className="flex justify-around mt-4 pt-4 border-t border-slate-300 text-black" 
                    style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                >
                    <div className="text-center w-[40%]">
                        <div className="h-12 mb-2 border-b border-slate-400 flex items-end justify-center">
                            {report.managerSignature ? (
                                <img 
                                    src={report.managerSignature} 
                                    alt="Unterschrift Bauleiter" 
                                    className="max-h-20 max-w-full w-auto mx-auto -mb-3" 
                                />
                            ) : null}
                        </div>
                        <p className="font-bold text-sm text-black">Bauleiter</p>
                        <p className="text-xs text-slate-500">Unterschrift</p>
                    </div>

                    <div className="text-center w-[40%]">
                        <div className="h-12 mb-2 border-b border-slate-400 flex items-end justify-center">
                            {report.clientSignature ? (
                                <img 
                                    src={report.clientSignature} 
                                    alt="Unterschrift Bauherr/-Vertretung" 
                                    className="max-h-20 max-w-full w-auto mx-auto -mb-3" 
                                />
                            ) : null}
                        </div>
                        <p className="font-bold text-sm text-black">Bauherr/-Vertretung</p>
                        <p className="text-xs text-slate-500">Unterschrift</p>
                    </div>
                </div>
            )}

            {/* Fix für html2pdf leere Seite Bug */}
            <div className="h-0 w-full bg-transparent overflow-hidden"></div>
        </div>
    );
};

const SingleLeavePrint = ({ report, companyInfo }: { report: any, companyInfo: any }) => {
    
    const calculateDays = (start: string, end: string): number => {
        if (!start || !end) return 0;
        const s = new Date(start);
        const e = new Date(end);
        const diffTime = Math.abs(e.getTime() - s.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
        return diffDays;
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('de-DE');
    };

    const formatDateTime = (timestampMs: number) => {
        if (!timestampMs) return '-';
        const d = new Date(timestampMs);
        return `${d.toLocaleDateString('de-DE')} um ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    };

    return (
        <div className="m-0 p-0 bg-white" style={{ fontFamily: 'sans-serif' }}>
            {/* Header / Company Info - Einzeilig & Ohne Logo */}
            <div className="border-b-2 border-slate-800 pb-1.5 mb-4 text-center text-[10px] text-black flex flex-wrap justify-center items-center gap-x-1.5 gap-y-1">
                <span className="font-bold text-sm uppercase tracking-wider">{renderStr(companyInfo?.companyName)}</span>
                
                {(companyInfo?.address || companyInfo?.city) && (
                    <>
                        <span>-</span>
                        <span>{renderStr(companyInfo?.address)}, {renderStr(companyInfo?.postalCode)} {renderStr(companyInfo?.city)}</span>
                    </>
                )}
                
                {companyInfo?.phone && (
                    <>
                        <span>-</span>
                        <span>{renderStr(companyInfo?.phone)}</span>
                    </>
                )}
                
                {companyInfo?.email && (
                    <>
                        <span>-</span>
                        <span>{renderStr(companyInfo?.email)}</span>
                    </>
                )}
                
                {companyInfo?.website && (
                    <>
                        <span>-</span>
                        <span>{renderStr(companyInfo?.website)}</span>
                    </>
                )}
                
                {companyInfo?.vatId && (
                    <>
                        <span>-</span>
                        <span>UID: {renderStr(companyInfo?.vatId)}</span>
                    </>
                )}
                
                {companyInfo?.commercialRegister && (
                    <>
                        <span>-</span>
                        <span>FN: {renderStr(companyInfo?.commercialRegister)}</span>
                    </>
                )}
            </div>

            {/* Document Title */}
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold uppercase tracking-widest text-black">
                    Genehmigter Urlaubsantrag
                </h1>
            </div>

            {/* Meta Data */}
            <div className="bg-transparent p-3 rounded-lg mb-6 grid grid-cols-3 gap-3 border border-slate-300 text-sm text-black">
                <div><span className="font-semibold">Mitarbeiter:</span> {renderStr(report.employeeName, '-')}</div>
                <div><span className="font-semibold">Zeitraum:</span> {formatDate(report.startDate)} - {formatDate(report.endDate)}</div>
                <div><span className="font-semibold">Status:</span> Genehmigt</div>
                <div><span className="font-semibold">Gesamtdauer:</span> {calculateDays(report.startDate, report.endDate)} Kalendertage</div>
                <div><span className="font-semibold">Eingereicht am:</span> {formatDateTime(report.createdAt)}</div>
                <div><span className="font-semibold">Typ:</span> {renderStr(report.reason, '-')}</div>
            </div>

            {/* Main Content */}
            <div className="mb-8 text-black">
                {/* Urlaubs-Informationen */}
                <div className="border border-slate-300 rounded-lg p-5 bg-slate-50/50 flex flex-col justify-between w-full">
                    <div>
                        <h3 className="text-base font-bold mb-4 border-b border-slate-300 pb-2 uppercase tracking-wider text-slate-800">
                            Antragsdetails
                        </h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="text-slate-500 block text-xs">Grund des Antrags</span>
                                <span className="font-bold text-lg text-brand-primary">{renderStr(report.reason, '-')}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block text-xs">Zeitspanne</span>
                                <span className="font-medium text-black">
                                    {formatDate(report.startDate)} bis einschließlich {formatDate(report.endDate)}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-500 block text-xs">Genehmigungsstatus</span>
                                <span className="font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded border border-green-200 inline-block text-xs uppercase tracking-wider mt-1">
                                    Freigegeben / Genehmigt
                                </span>
                            </div>
                            {report.adminComment && (
                                <div className="mt-3 p-3 bg-slate-100 rounded border border-slate-200 text-xs italic">
                                    <span className="font-semibold not-italic block text-[10px] text-slate-500 uppercase tracking-wide">Anmerkung Admin:</span>
                                    {report.adminComment}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="text-[10px] text-slate-400 mt-6 border-t border-slate-200 pt-3">
                        Dieses Dokument dient als offizieller Nachweis über den genehmigten Abwesenheitszeitraum des Mitarbeiters im Zeiterfassungssystem.
                    </div>
                </div>
            </div>


            {/* Fix für html2pdf leere Seite Bug */}
            <div className="h-0 w-full bg-transparent overflow-hidden"></div>
        </div>
    );
};

export const PrintReport = () => {
    const { type, id } = useParams<{ type: string, id: string }>();
    const [reports, setReports] = useState<any[]>([]);
    const [companyInfo, setCompanyInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const reportRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    
    const isDaily = type === 'daily';
    const isLeave = type === 'leave';

    useEffect(() => {
        const fetchPrintData = async () => {
            if (!type || !id) return;

            try {
                // Fetch company settings for header
                const companySnap = await getDoc(doc(db, 'apps', APP_ID, 'metadata', 'company_profile'));
                if (companySnap.exists()) {
                    setCompanyInfo(companySnap.data());
                } else {
                    // Fallback stub in case setting wasn't configured yet
                    setCompanyInfo({
                        companyName: "Construction Global Template",
                        address: "Musterstraße 1, 1010 Wien",
                        phone: "+43 1 2345 6789",
                        email: "office@satler-bau.example.com"
                    });
                }

                // Fetch report data based on type
                const collectionName = isLeave ? 'leave_requests' : (type === 'daily' ? 'daily_reports' : 'weekly_reports');
                const ids = id.split('--id--');

                const reportPromises = ids.map(singleId => getDoc(doc(db, 'apps', APP_ID, collectionName, singleId)));
                const reportSnaps = await Promise.all(reportPromises);
                
                const fetchedReports = reportSnaps.filter(snap => snap.exists()).map(snap => snap.data());
                
                setReports(fetchedReports);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching print data:", error);
                setLoading(false);
            }
        };

        fetchPrintData();
    }, [type, id, isLeave]);

    useEffect(() => {
        if (!loading && reports.length > 0 && reportRefs.current.length > 0 && !isGeneratingPDF) {
            const generatePDF = async () => {
                setIsGeneratingPDF(true);
                
                try {
                    const mergedPdf = await PDFDocument.create();

                    for (let x = 0; x < reports.length; x++) {
                        const element = reportRefs.current[x];
                        if (!element) continue;

                        const opt: any = {
                            margin: [10, 10, 8, 10], // top, left, bottom, right
                            filename: isDaily ? 'Tagesbericht.pdf' : isLeave ? `Urlaubsantrag_${reports[x]?.employeeName || 'Mitarbeiter'}.pdf` : 'Wochenbericht.pdf',
                            image: { type: 'jpeg', quality: 0.98 },
                            html2canvas: { scale: 2, useCORS: true },
                            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                            pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.avoid-break'] }
                        };

                        const pdfArrayBuffer = await (html2pdf()
                            .set(opt)
                            .from(element)
                            .toPdf()
                            .get('pdf')
                            .then((pdf: any) => {
                                const totalPages = pdf.internal.getNumberOfPages();
                                for (let i = 1; i <= totalPages; i++) {
                                    pdf.setPage(i);
                                    pdf.setFontSize(10);
                                    pdf.setTextColor(100);
                                    const pageWidth = pdf.internal.pageSize.getWidth();
                                    const pageHeight = pdf.internal.pageSize.getHeight();
                                    pdf.text(`Seite ${i} / ${totalPages}`, pageWidth - 25, pageHeight - 8);
                                }
                            }) as any)
                            .output('arraybuffer');

                        const reportPdf = await PDFDocument.load(pdfArrayBuffer);
                        const copiedPages = await mergedPdf.copyPages(reportPdf, reportPdf.getPageIndices());
                        copiedPages.forEach((page) => mergedPdf.addPage(page));
                    }

                    const mergedPdfBytes = await mergedPdf.save();
                    const pdfBlob = new Blob([mergedPdfBytes as any], { type: 'application/pdf' });
                    const pdfUrl = URL.createObjectURL(pdfBlob);
                    
                    // Ersetzt die aktuelle HTML-Ansicht durch den nativen PDF-Viewer des Browsers
                    window.location.replace(pdfUrl);
                } catch (error) {
                    console.error("Fehler bei der PDF-Generierung:", error);
                    setIsGeneratingPDF(false);
                }
            };

            // Kurze Verzögerung, damit Bilder (Logos/Unterschriften) sicher gerendert sind
            setTimeout(generatePDF, 800);
        }
    }, [loading, reports, isDaily, isLeave, isGeneratingPDF]);

    if (loading) {
        return <div className="p-10 text-center">Lade Bericht(e) für den Druck...</div>;
    }

    if (reports.length === 0) {
        return <div className="p-10 text-center text-red-600">Bericht(e) nicht gefunden.</div>;
    }

    return (
        <>
            {isGeneratingPDF && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mb-4"></div>
                    <div className="text-lg font-medium text-gray-700">Generiere PDF... Bitte warten.</div>
                </div>
            )}
            
            <div className="bg-white min-h-screen text-black">
                {reports.map((report, idx) => (
                    <div 
                        key={idx} 
                        ref={(el) => { reportRefs.current[idx] = el; }} 
                        className="bg-white w-[715px] pb-4 mb-4 print:p-0 print:m-0 mx-auto print:w-full"
                    >
                        {isLeave ? (
                            <SingleLeavePrint report={report} companyInfo={companyInfo} />
                        ) : (
                            <SingleReportPrint report={report} companyInfo={companyInfo} isDaily={isDaily} />
                        )}
                    </div>
                ))}
            </div>
        </>
    );
};
