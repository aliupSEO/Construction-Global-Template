import React, { useState, useEffect } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { db, APP_ID } from '../lib/firebase';
import { collection, doc, getDoc, setDoc, getDocs, serverTimestamp, runTransaction, query, where } from 'firebase/firestore';
import { CustomSelect } from '../components/CustomSelect';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { SignaturePad } from '../components/ui/SignaturePad';
import { useTaskSync } from '../hooks/useTaskSync';
import { getIsoWeekNumber } from '../lib/utils';
import { translateToGerman } from '../lib/translate';
import { useAuth } from '../contexts/AuthContext';

interface AssignedEmployee {
    employeeId: string;
    name: string;
    role: string;
    hours: number | string;
    badWeatherHours?: number | string;
    doctorHours?: number | string;
}

interface EmployeeReport {
    constructionSite?: string;
    workDescription: string;
    isDescriptionDone?: boolean;
    assignedEmployees?: AssignedEmployee[];
    // Legacy Felder (für alte Berichte)
    workerCount?: number | string;
    hours?: number | string;
}

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(word => word[0]?.toUpperCase()).join('');
};

export const DailyReportForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { createAction } = useTaskSync();
    const isEdit = id && id !== 'new';
    const { userRole } = useAuth();
    const isReadOnly = userRole === 'mitarbeiter';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showErrors, setShowErrors] = useState(false);

    // Dropdown Data
    const [dbManagers, setDbManagers] = useState<any[]>([]);
    const [dbClients, setDbClients] = useState<any[]>([]);
    const [dbBaustellen, setDbBaustellen] = useState<any[]>([]);
    const [dbEmployees, setDbEmployees] = useState<any[]>([]);

    const [nextReportNumber, setNextReportNumber] = useState<string>('');

    const [formData, setFormData] = useState({
        reportNumber: '',
        date: new Date().toISOString().split('T')[0],
        calendarWeek: getIsoWeekNumber(new Date().toISOString().split('T')[0]).toString(),
        weather: '',
        constructionSite: '',
        managerId: '',
        managerName: '',
        clientId: '',
        clientName: '',
        usedMaterials: '',
        usedEquipment: '',
        managerSignature: '',
        clientSignature: ''
    });

    // Auto-update calendar week when date changes
    useEffect(() => {
        if (formData.date) {
            setFormData(prev => ({ ...prev, calendarWeek: getIsoWeekNumber(formData.date).toString() }));
        }
    }, [formData.date]);

    const [employees, setEmployees] = useState<EmployeeReport[]>([]);

    useEffect(() => {
        const fetchDropdownData = async () => {
            try {
                const managersSnap = await getDocs(collection(db, 'apps', APP_ID, 'managers'));
                setDbManagers(managersSnap.docs
                    .filter(doc => !doc.data().status || doc.data().status === 'active')
                    .map(doc => ({
                        id: doc.id,
                        name: doc.data().firstName + ' ' + doc.data().lastName,
                        signature: doc.data().signature,
                        ...doc.data()
                    })));

                const clientsSnap = await getDocs(collection(db, 'apps', APP_ID, 'clients'));
                setDbClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

                const baustellenSnap = await getDocs(collection(db, 'apps', APP_ID, 'baustellen'));
                setDbBaustellen(baustellenSnap.docs
                    .filter(doc => !doc.data().status || doc.data().status === 'active')
                    .map(doc => ({ id: doc.id, ...doc.data() })));

                const employeesSnap = await getDocs(collection(db, 'apps', APP_ID, 'employees'));
                setDbEmployees(employeesSnap.docs
                    .filter(doc => {
                        const data = doc.data();
                        const isActive = !data.status || data.status === 'active';
                        const isNotAdmin = data.role !== 'admin';
                        return isActive && isNotAdmin;
                    })
                    .map(doc => ({ id: doc.id, ...doc.data() } as any))
                    .sort((a, b) => a.lastName.localeCompare(b.lastName))
                );
            } catch (error) {
                console.error("Error fetching dropdowns:", error);
            }
        };

        const fetchReportOrCounter = async () => {
            if (isEdit) {
                try {
                    const docSnap = await getDoc(doc(db, 'apps', APP_ID, 'daily_reports', id!));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setFormData({
                            reportNumber: data.reportNumber || '',
                            date: data.date || new Date().toISOString().split('T')[0],
                            calendarWeek: data.calendarWeek || getIsoWeekNumber(data.date || new Date().toISOString().split('T')[0]).toString(),
                            weather: data.weather || '',
                            constructionSite: data.constructionSite || '',
                            managerId: data.managerId || '',
                            managerName: data.managerName || '',
                            clientId: data.clientId || '',
                            clientName: data.clientName || '',
                            usedMaterials: data.usedMaterials || '',
                            usedEquipment: data.usedEquipment || '',
                            managerSignature: data.managerSignature || '',
                            clientSignature: data.clientSignature || ''
                        });
                        setEmployees(data.employees || []);
                    } else {
                        alert("Bericht nicht gefunden.");
                        navigate('/reports');
                    }
                } catch (error) {
                    console.error("Error fetching report:", error);
                }
            } else {
                // Initial empty report number, will be set when construction site is chosen by a separate useEffect
                setNextReportNumber('');
                setFormData(prev => ({ ...prev, reportNumber: '' }));
            }
            setLoading(false);
        };

        Promise.all([fetchDropdownData(), fetchReportOrCounter()]);
    }, [id, isEdit, navigate]);

    useEffect(() => {
        const generateSiteSpecificReportNumber = async () => {
            if (isEdit || !formData.constructionSite) return;

            try {
                const initials = getInitials(formData.constructionSite);
                
                // Dynamically fetch all reports for this site to find the highest number
                const q = query(
                    collection(db, 'apps', APP_ID, 'daily_reports'),
                    where('constructionSite', '==', formData.constructionSite)
                );
                const querySnapshot = await getDocs(q);
                
                let currentCount = 0;
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.reportNumber) {
                        // Extract number part, assuming format is like "XY-005" or similar
                        const match = data.reportNumber.match(/\d+$/);
                        if (match) {
                            const num = parseInt(match[0], 10);
                            if (!isNaN(num) && num > currentCount) {
                                currentCount = num;
                            }
                        }
                    }
                });

                const nextNr = `${initials}-${(currentCount + 1).toString().padStart(3, '0')}`;
                setNextReportNumber(nextNr);
                setFormData(prev => ({ ...prev, reportNumber: nextNr }));
            } catch (error) {
                console.error("Error generating report number:", error);
            }
        };

        generateSiteSpecificReportNumber();
    }, [formData.constructionSite, isEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        if (name === 'managerId') {
            const selectedManager = dbManagers.find(m => m.id === value);
            setFormData(prev => ({
                ...prev,
                managerId: value,
                managerName: selectedManager?.name || '',
                // Automatically populate the manager signature from Stammdaten
                managerSignature: selectedManager?.signature || ''
            }));
        } else if (name === 'clientId') {
            const selectedClient = dbClients.find(c => c.id === value);
            setFormData(prev => ({
                ...prev,
                clientId: value,
                clientName: selectedClient?.companyOrName || ''
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleAddEmployeeRow = () => {
        let hasError = false;
        let missingEmployeeName = "";
        employees.forEach(emp => {
            if (emp.assignedEmployees) {
                emp.assignedEmployees.forEach(assigned => {
                    const noNormal = assigned.hours === '' || assigned.hours === undefined;
                    const noSW = assigned.badWeatherHours === '' || assigned.badWeatherHours === undefined;
                    const noDoc = assigned.doctorHours === '' || assigned.doctorHours === undefined;
                    if (noNormal && noSW && noDoc) {
                        hasError = true;
                        if (!missingEmployeeName) missingEmployeeName = assigned.name;
                    }
                });
            }
        });

        if (hasError) {
            setShowErrors(true);
            alert(`Bitte tragen Sie für den Mitarbeiter "${missingEmployeeName}" mindestens einen Stunden-Wert (Normal, SW oder Arzt) ein.`);
            return;
        }

        setShowErrors(false);
        setEmployees([...employees, { workDescription: '', assignedEmployees: [], isDescriptionDone: false }]);
    };

    const handleRemoveEmployeeRow = (index: number) => {
        const newEmployees = [...employees];
        newEmployees.splice(index, 1);
        setEmployees(newEmployees);
    };

    const handleEmployeeChange = (index: number, field: keyof EmployeeReport, value: any) => {
        const newEmployees = [...employees];
        (newEmployees[index][field] as any) = value;
        setEmployees(newEmployees);
    };

    const handleToggleAssignedEmployee = (entryIndex: number, employee: any, isChecked: boolean) => {
        const newEmployees = [...employees];
        if (!newEmployees[entryIndex].assignedEmployees) {
            newEmployees[entryIndex].assignedEmployees = [];
        }
        
        if (isChecked) {
            newEmployees[entryIndex].assignedEmployees!.push({
                employeeId: employee.id,
                name: `${employee.lastName}, ${employee.firstName}`,
                role: employee.position || employee.role || '',
                hours: '',
                badWeatherHours: '',
                doctorHours: ''
            });
        } else {
            newEmployees[entryIndex].assignedEmployees = newEmployees[entryIndex].assignedEmployees!.filter(
                e => e.employeeId !== employee.id
            );
        }
        setEmployees(newEmployees);
    };

    const handleAssignedEmployeeFieldChange = (entryIndex: number, employeeId: string, field: keyof AssignedEmployee, value: string) => {
        const newEmployees = [...employees];
        const empIndex = newEmployees[entryIndex].assignedEmployees?.findIndex(e => e.employeeId === employeeId);
        if (empIndex !== undefined && empIndex > -1) {
            (newEmployees[entryIndex].assignedEmployees![empIndex] as any)[field] = value;
            setEmployees(newEmployees);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let hasError = false;
        let missingEmployeeName = "";
        employees.forEach(emp => {
            if (emp.assignedEmployees) {
                emp.assignedEmployees.forEach(assigned => {
                    const noNormal = assigned.hours === '' || assigned.hours === undefined;
                    const noSW = assigned.badWeatherHours === '' || assigned.badWeatherHours === undefined;
                    const noDoc = assigned.doctorHours === '' || assigned.doctorHours === undefined;
                    
                    // Check if they left everything empty
                    if (noNormal && noSW && noDoc) {
                        hasError = true;
                        if (!missingEmployeeName) missingEmployeeName = assigned.name;
                    }
                });
            }
        });

        if (hasError) {
            setShowErrors(true);
            alert(`Bitte tragen Sie für den Mitarbeiter "${missingEmployeeName}" mindestens einen Stunden-Wert (Normal, SW oder Arzt) ein, bevor Sie speichern.`);
            return;
        }
        setShowErrors(false);

        setSaving(true);
        try {
            // --- NEU: Übersetzungs-Logik ---
            const translatedWeather = await translateToGerman(formData.weather);
            const translatedMaterials = await translateToGerman(formData.usedMaterials);
            const translatedEquipment = await translateToGerman(formData.usedEquipment);
            
            const translatedEmployees = await Promise.all(
                employees.map(async (emp) => ({
                    ...emp,
                    workDescription: await translateToGerman(emp.workDescription)
                }))
            );

            const finalFormData = {
                ...formData,
                weather: translatedWeather,
                usedMaterials: translatedMaterials,
                usedEquipment: translatedEquipment
            };
            // --------------------------------

            let savedReportId = id;

            if (isEdit) {
                const payload = {
                    ...finalFormData,
                    employees: translatedEmployees,
                    updatedAt: serverTimestamp(),
                };
                await setDoc(doc(db, 'apps', APP_ID, 'daily_reports', id!), payload, { merge: true });
            } else {
                // Use already generated reportNumber or fetch new dynamically if empty
                let finalReportNumber = finalFormData.reportNumber;
                
                if (!finalReportNumber) {
                    const initials = getInitials(finalFormData.constructionSite);
                    const q = query(
                        collection(db, 'apps', APP_ID, 'daily_reports'),
                        where('constructionSite', '==', finalFormData.constructionSite)
                    );
                    const querySnapshot = await getDocs(q);
                    let currentCount = 0;
                    querySnapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.reportNumber) {
                            const match = data.reportNumber.match(/\d+$/);
                            if (match) {
                                const num = parseInt(match[0], 10);
                                if (!isNaN(num) && num > currentCount) currentCount = num;
                            }
                        }
                    });
                    finalReportNumber = `${initials}-${(currentCount + 1).toString().padStart(3, '0')}`;
                }

                const reportId = `report_${finalReportNumber}`;
                const payload = {
                    ...finalFormData,
                    reportNumber: finalReportNumber,
                    employees: translatedEmployees,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };

                await setDoc(doc(db, 'apps', APP_ID, 'daily_reports', reportId), payload);
                savedReportId = reportId;
            }

            // Sync with n8n workflow system
            await createAction('report_saved', {
                reportId: savedReportId,
                isEdit,
                type: 'daily'
            });

            navigate('/reports');
        } catch (error) {
            console.error('Error saving report:', error);
            alert('Fehler beim Speichern.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <DashboardShell title="Tagesbericht">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell title={isEdit ? "Tagesbericht bearbeiten" : "Neuen Tagesbericht erfassen"}>
            <div className="mb-4">
                <button
                    type="button"
                    onClick={() => navigate('/reports')}
                    className="inline-flex items-center text-gray-500 hover:text-gray-700 p-2 -ml-2 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Zurück
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 pb-24 lg:pb-0">

                {/* General Info */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 flex flex-col space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Allgemeine Daten</h3>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Baustelle *</label>
                        <CustomSelect
                            options={dbBaustellen.map(b => ({ value: b.name, label: b.name }))}
                            value={formData.constructionSite}
                            onChange={(value) => setFormData(prev => ({ ...prev, constructionSite: value }))}
                            placeholder="Bitte Baustelle wählen..."
                            disabled={isReadOnly}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bauleiter *</label>
                        <CustomSelect
                            options={dbManagers.map(m => ({ value: m.id, label: m.name }))}
                            value={formData.managerId}
                            onChange={(value) => setFormData(prev => ({ ...prev, managerId: value }))}
                            placeholder="Bitte Bauleiter wählen..."
                            disabled={isReadOnly}
                        />
                        {formData.managerSignature && (
                            <div className="mt-2 text-xs text-green-600 flex items-center bg-green-50 p-2 rounded border border-green-100">
                                <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                Unterschrift automatisch hinterlegt
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
                        <CustomDatePicker
                            selected={formData.date ? new Date(formData.date) : null}
                            onChange={(date) => {
                                const localDateString = date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '';
                                setFormData(prev => ({ ...prev, date: localDateString }));
                            }}
                            disabled={isReadOnly}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Kalenderwoche (KW)</label>
                            <input
                                type="number"
                                name="calendarWeek"
                                placeholder="z.B. 42"
                                value={formData.calendarWeek}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className={isReadOnly ? 'input-premium-readonly' : 'input-premium'}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Wetter (Temp. / Verhältnisse)</label>
                            <input
                                type="text"
                                name="weather"
                                placeholder="z.B. 15°C, sonnig"
                                value={formData.weather}
                                onChange={handleChange}
                                disabled={isReadOnly}
                                className={isReadOnly ? 'input-premium-readonly' : 'input-premium'}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bericht Nr.</label>
                        <input
                            type="text"
                            name="reportNumber"
                            placeholder="Wird automatisch generiert"
                            value={formData.reportNumber}
                            onChange={handleChange}
                            disabled={isReadOnly}
                            className={isReadOnly ? 'input-premium-readonly' : 'input-premium'}
                        />
                    </div>


                </div>

                {/* Employees / Personal */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 flex flex-col space-y-4">
                    <div className="border-b pb-2 mb-4">
                        <h3 className="text-lg font-medium text-gray-900">Personal & Stunden</h3>
                    </div>

                    {employees.length === 0 ? (
                        <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            <p className="text-sm text-gray-500 italic mb-4">Noch keine Arbeitsleistung erfasst.</p>
                            {!isReadOnly && (
                                <button
                                    type="button"
                                    onClick={handleAddEmployeeRow}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-brand-primary/90 transition-colors"
                                >
                                    <Plus className="w-4 h-4 mr-1" /> Erste Arbeitsleistung hinzufügen
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {employees.map((emp, index) => (
                                <div key={index} className="flex flex-col gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 mr-4">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Arbeitsleistung / Tätigkeit</label>
                                            <input
                                                type="text"
                                                value={emp.workDescription || ''}
                                                onChange={(e) => handleEmployeeChange(index, 'workDescription', e.target.value)}
                                                placeholder="z.B. Maurerarbeiten"
                                                disabled={isReadOnly}
                                                className={isReadOnly ? 'input-premium-readonly' : 'input-premium'}
                                            />
                                        </div>
                                        {!isReadOnly && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveEmployeeRow(index)}
                                                className="mt-5 h-12 w-12 flex items-center justify-center rounded-md text-red-500 bg-white border border-red-200 hover:bg-red-50 transition-colors shrink-0"
                                                title="Eintrag entfernen"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                        {!emp.isDescriptionDone ? (
                                            <button
                                                type="button"
                                                onClick={() => handleEmployeeChange(index, 'isDescriptionDone', true)}
                                                className="mt-1 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                                            >
                                                Fertig
                                            </button>
                                        ) : (
                                            <div className="flex justify-end mt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEmployeeChange(index, 'isDescriptionDone', false)}
                                                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors"
                                                >
                                                    Mitarbeiter einklappen
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {emp.isDescriptionDone && (
                                        <div className="mt-4 bg-white p-4 rounded-md border border-gray-200 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <h4 className="text-sm font-medium text-gray-700 mb-3 border-b pb-2">Mitarbeiter auswählen & Stunden eintragen</h4>
                                            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                                {dbEmployees.map(dbEmp => {
                                                    const isAssigned = emp.assignedEmployees?.some(e => e.employeeId === dbEmp.id) || false;
                                                    const assignedData = emp.assignedEmployees?.find(e => e.employeeId === dbEmp.id);
                                                    
                                                    return (
                                                        <div key={dbEmp.id} className={`flex items-center justify-between p-2 rounded-md transition-colors ${isAssigned ? 'bg-brand-primary/5 border border-brand-primary/20' : 'hover:bg-gray-50 border border-transparent'}`}>
                                                            <label className="flex items-center space-x-3 cursor-pointer flex-1">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isAssigned}
                                                                    onChange={(e) => handleToggleAssignedEmployee(index, dbEmp, e.target.checked)}
                                                                    disabled={isReadOnly}
                                                                    className={`h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                />
                                                                <span className="text-sm text-gray-900 font-medium">
                                                                    {dbEmp.lastName}, {dbEmp.firstName} <span className="text-gray-500 text-xs font-normal">({dbEmp.position || dbEmp.role || '-'})</span>
                                                                </span>
                                                            </label>
                                                            
                                                            {isAssigned && (
                                                                <div className="flex items-center space-x-2 ml-4 shrink-0">
                                                                    <div className="flex items-center space-x-1.5 mr-2">
                                                                        <input
                                                                            type="checkbox"
                                                                            id={`sick-${index}-${dbEmp.id}`}
                                                                            checked={assignedData?.hours === 'K'}
                                                                            onChange={(e) => {
                                                                                setShowErrors(false);
                                                                                if (e.target.checked) {
                                                                                    handleAssignedEmployeeFieldChange(index, dbEmp.id, 'hours', 'K');
                                                                                    handleAssignedEmployeeFieldChange(index, dbEmp.id, 'badWeatherHours', '');
                                                                                    handleAssignedEmployeeFieldChange(index, dbEmp.id, 'doctorHours', '');
                                                                                } else {
                                                                                    handleAssignedEmployeeFieldChange(index, dbEmp.id, 'hours', '');
                                                                                }
                                                                            }}
                                                                            disabled={isReadOnly}
                                                                            className={`h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                        />
                                                                        <label htmlFor={`sick-${index}-${dbEmp.id}`} className="text-sm text-gray-600 cursor-pointer">Krank</label>
                                                                    </div>
                                                                    <div className="flex space-x-2 w-[240px]">
                                                                        <div className="flex-1">
                                                                            <input
                                                                                type="text"
                                                                                inputMode="decimal"
                                                                                placeholder="Std."
                                                                                title="Normale Stunden"
                                                                                value={assignedData?.hours === 'K' ? '' : (assignedData?.hours || '')}
                                                                                onChange={(e) => {
                                                                                    setShowErrors(false);
                                                                                    handleAssignedEmployeeFieldChange(index, dbEmp.id, 'hours', e.target.value);
                                                                                }}
                                                                                disabled={isReadOnly || assignedData?.hours === 'K'}
                                                                                className={
                                                                                    showErrors && (!assignedData?.hours && !assignedData?.badWeatherHours && !assignedData?.doctorHours)
                                                                                        ? 'input-premium-sm !border-red-500 !bg-red-50 !ring-red-500/20'
                                                                                        : isReadOnly || assignedData?.hours === 'K' ? 'input-premium-sm-readonly' : 'input-premium-sm'
                                                                                }
                                                                            />
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <input
                                                                                type="text"
                                                                                inputMode="decimal"
                                                                                placeholder="SW"
                                                                                title="Schlechtwetter"
                                                                                value={assignedData?.badWeatherHours || ''}
                                                                                onChange={(e) => {
                                                                                    setShowErrors(false);
                                                                                    handleAssignedEmployeeFieldChange(index, dbEmp.id, 'badWeatherHours', e.target.value);
                                                                                }}
                                                                                disabled={isReadOnly || assignedData?.hours === 'K'}
                                                                                className={isReadOnly || assignedData?.hours === 'K' ? 'input-premium-sm-readonly' : 'input-premium-sm'}
                                                                            />
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <input
                                                                                type="text"
                                                                                inputMode="decimal"
                                                                                placeholder="Arzt"
                                                                                title="Arztbesuch"
                                                                                value={assignedData?.doctorHours || ''}
                                                                                onChange={(e) => {
                                                                                    setShowErrors(false);
                                                                                    handleAssignedEmployeeFieldChange(index, dbEmp.id, 'doctorHours', e.target.value);
                                                                                }}
                                                                                disabled={isReadOnly || assignedData?.hours === 'K'}
                                                                                className={isReadOnly || assignedData?.hours === 'K' ? 'input-premium-sm-readonly' : 'input-premium-sm'}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Legacy Support View */}
                                    {(emp.workerCount || emp.hours) && (
                                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                                            <p className="text-xs text-amber-800 font-medium mb-2">Legacy-Daten (Alter Bericht)</p>
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <span className="block text-[10px] text-amber-600 uppercase tracking-wider">Anzahl</span>
                                                    <span className="font-semibold text-amber-900">{emp.workerCount}</span>
                                                </div>
                                                <div className="flex-1">
                                                    <span className="block text-[10px] text-amber-600 uppercase tracking-wider">Stunden p.P.</span>
                                                    <span className="font-semibold text-amber-900">{emp.hours}h</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {!isReadOnly && (
                                <div className="pt-2 pb-4">
                                    <button
                                        type="button"
                                        onClick={handleAddEmployeeRow}
                                        className="w-full flex justify-center items-center px-4 py-3 border-2 border-dashed border-brand-primary/50 text-sm font-medium rounded-lg text-brand-primary hover:bg-brand-primary/5 hover:border-brand-primary transition-all"
                                    >
                                        <Plus className="w-5 h-5 mr-2" /> Weitere Arbeitsleistung hinzufügen
                                    </button>
                                </div>
                            )}

                            <div className="text-right text-base font-bold text-gray-900 pt-4 border-t border-gray-200">
                                Gesamtstunden: {employees.reduce((acc, curr) => {
                                    if (curr.assignedEmployees && curr.assignedEmployees.length > 0) {
                                        return acc + curr.assignedEmployees.reduce((sum, emp) => {
                                            const parseVal = (v: any) => {
                                                if (typeof v === 'string') {
                                                    const p = parseFloat(v.replace(',', '.'));
                                                    return isNaN(p) ? 0 : p;
                                                }
                                                return Number(v) || 0;
                                            };
                                            return sum + parseVal(emp.hours) + parseVal(emp.badWeatherHours) + parseVal(emp.doctorHours);
                                        }, 0);
                                    }
                                    // Legacy Fallback für alte Berichte
                                    let legacyHours = 0;
                                    if (typeof curr.hours === 'string') legacyHours = parseFloat(curr.hours.replace(',', '.')) || 0;
                                    else legacyHours = Number(curr.hours) || 0;
                                    return acc + (legacyHours * (Number(curr.workerCount) || 0));
                                }, 0)} h
                            </div>
                        </div>
                    )}
                </div>

                {/* Used Materials */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 flex flex-col space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Verwendete Materialien (Optional)</h3>
                    <textarea
                        name="usedMaterials"
                        value={formData.usedMaterials}
                        onChange={handleChange}
                        disabled={isReadOnly}
                        placeholder="Materialien, Lieferscheinnummern, etc. hier eintragen..."
                        className={`min-h-[6rem] ${isReadOnly ? 'input-premium-readonly' : 'input-premium'}`}
                    />
                </div>

                {/* Used Equipment */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 flex flex-col space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Verwendete Geräte (Optional)</h3>
                    <textarea
                        name="usedEquipment"
                        value={formData.usedEquipment}
                        onChange={handleChange}
                        disabled={isReadOnly}
                        placeholder="Bagger, Kran, Rüttelplatte, etc. hier eintragen..."
                        className={`min-h-[6rem] ${isReadOnly ? 'input-premium-readonly' : 'input-premium'}`}
                    />
                </div>

                {/* Signatures */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 flex flex-col space-y-6">
                    <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Unterschriften</h3>

                    <div className="flex flex-col space-y-6">
                        {formData.managerSignature ? (
                            <div className="border border-green-200 rounded-md p-4 bg-green-50 flex flex-col items-center">
                                <span className="text-sm font-bold text-green-700 mb-2">Unterschrift Bauleiter (automatisch)</span>
                                <img src={formData.managerSignature} alt="Unterschrift Bauleiter" className="max-h-24 object-contain" />
                            </div>
                        ) : !isReadOnly ? (
                            <div className="mb-4">
                                <SignaturePad
                                    label="Unterschrift Bauleiter (Manuell)"
                                    initialData={formData.managerSignature}
                                    onSave={(base64) => setFormData({ ...formData, managerSignature: base64 })}
                                />
                            </div>
                        ) : (
                            <div className="p-4 bg-gray-50 border border-gray-200 rounded text-gray-500 text-center">
                                Noch keine Unterschrift vorhanden (Bauleiter)
                            </div>
                        )}

                        <div className="border-t border-gray-100 pt-6">
                            {isReadOnly && formData.clientSignature ? (
                                <div className="border border-green-200 rounded-md p-4 bg-green-50 flex flex-col items-center">
                                    <span className="text-sm font-bold text-green-700 mb-2">Unterschrift Bauherr/-Vertretung</span>
                                    <img src={formData.clientSignature} alt="Unterschrift Bauherr" className="max-h-24 object-contain" />
                                </div>
                            ) : !isReadOnly ? (
                                <SignaturePad
                                    label="Unterschrift Bauherr/-Vertretung"
                                    initialData={formData.clientSignature}
                                    onSave={(base64) => setFormData({ ...formData, clientSignature: base64 })}
                                />
                            ) : (
                                <div className="p-4 bg-gray-50 border border-gray-200 rounded text-gray-500 text-center">
                                    Noch keine Unterschrift vorhanden (Bauherr/-Vertretung)
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Submit Action (Sticky on Mobile, standard on Desktop) */}
                {!isReadOnly && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 lg:pl-64 lg:static lg:bg-transparent lg:border-0 lg:p-0 lg:shadow-none">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full flex justify-center items-center p-4 border border-transparent rounded-lg shadow-sm text-lg font-bold text-white bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-50 transition-colors"
                        >
                            {saving ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-2"></div>
                            ) : (
                                <Save className="w-6 h-6 mr-2" />
                            )}
                            Tagesbericht speichern
                        </button>
                    </div>
                )}
            </form>
        </DashboardShell>
    );
};
