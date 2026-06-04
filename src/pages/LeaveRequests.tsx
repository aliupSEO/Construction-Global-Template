import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { createLeaveRequest, getLeaveRequestsByEmployee, getAllPendingRequests, getHandledRequests, updateLeaveRequestStatus, replyToLeaveRequestQuery } from '../services/leaveRequests';
import { translateToGerman } from '../lib/translate';
import { LeaveRequest } from '../types';
import { DashboardShell } from '../components/DashboardShell';
import { CalendarRange, Check, X, Clock, Play, FileText, MessageCircle, Printer } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, APP_ID } from '../lib/firebase';
import toast from 'react-hot-toast';

export const LeaveRequests = () => {
    const { currentUser, userRole } = useAuth();
    const [searchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'pending';
    
    // Forms
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('Urlaub');
    const [specialReason, setSpecialReason] = useState('Eigene Eheschließung');
    const [otherReason, setOtherReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    
    const SONDERURLAUB_GRUENDE = [
        "Eigene Eheschließung",
        "Eheschließung von Geschwistern/Kindern",
        "Geburt eines Kindes",
        "Wohnungswechsel (Umzug)",
        "Todesfall (Ehepartner/Kind/Lebensgefährte)",
        "Todesfall (Elternteil)",
        "Todesfall (Großeltern/Geschwister/Schwiegereltern)",
        "Unaufschiebbarer Arztbesuch/Behördengang",
        "Pflegefreistellung",
        "Sonstiges"
    ];
    
    // Data Loading
    const [loading, setLoading] = useState(true);
    const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
    const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
    const [handledRequests, setHandledRequests] = useState<LeaveRequest[]>([]);
    
    // Admin Manage Data
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [queryingId, setQueryingId] = useState<string | null>(null);
    const [adminComment, setAdminComment] = useState('');
    
    // Employee Reply Data
    const [replyText, setReplyText] = useState('');

    useEffect(() => {
        loadData();
    }, [userRole, currentUser]);

    const loadData = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            if (userRole === 'admin') {
                const pending = await getAllPendingRequests();
                const handled = await getHandledRequests();
                setPendingRequests(pending);
                setHandledRequests(handled);
            } else {
                const mine = await getLeaveRequestsByEmployee(currentUser.uid);
                setMyRequests(mine);
            }
        } catch (error) {
            console.error("Error loading leave requests:", error);
            toast.error("Fehler beim Laden der Anträge");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) {
            toast.error("Sie müssen eingeloggt sein");
            return;
        }
        if (new Date(startDate) > new Date(endDate)) {
            toast.error("Das Enddatum darf nicht vor dem Startdatum liegen");
            return;
        }
        
        setSubmitting(true);
        
        let finalReason = reason;
        if (reason === 'Sonderurlaub') {
            if (specialReason === 'Sonstiges') {
                const translatedOther = await translateToGerman(otherReason);
                finalReason = `Sonderurlaub: Sonstiges - ${translatedOther}`;
            } else {
                finalReason = `Sonderurlaub: ${specialReason}`;
            }
        }
        
        try {
            // Hole Mitarbeiter-Namen aus der DB, falls displayName leer ist
            let employeeName = currentUser.displayName;
            if (!employeeName) {
                const q = query(
                    collection(db, 'apps', APP_ID, 'employees'),
                    where('authUid', '==', currentUser.uid)
                );
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const empData = snapshot.docs[0].data();
                    employeeName = `${empData.firstName} ${empData.lastName}`.trim();
                } else {
                    employeeName = currentUser.email || 'Unbekannter Mitarbeiter';
                }
            }

            await createLeaveRequest({
                employeeId: currentUser.uid,
                employeeName: employeeName,
                startDate,
                endDate,
                reason: finalReason,
                status: 'pending'
            });
            toast.success("Antrag erfolgreich eingereicht");
            setStartDate('');
            setEndDate('');
            setReason('Urlaub');
            setSpecialReason(SONDERURLAUB_GRUENDE[0]);
            setOtherReason('');
            loadData();
        } catch (error) {
            console.error("Error creating leave request:", error);
            toast.error("Fehler beim Senden des Antrags");
        } finally {
            setSubmitting(false);
        }
    };

    const handleApprove = async (req: LeaveRequest) => {
        try {
            await updateLeaveRequestStatus(req.id, 'approved');
            toast.success("Antrag genehmigt");
            
            // Open email client
            const subject = encodeURIComponent(`Genehmigter Urlaubsantrag: ${req.employeeName}`);
            const body = encodeURIComponent(`Hallo Office-Team,\n\nder folgende Urlaubsantrag wurde genehmigt:\n\nMitarbeiter: ${req.employeeName}\nZeitraum: ${formatDate(req.startDate)} - ${formatDate(req.endDate)}\nGrund: ${req.reason}\n\nBitte im System vermerken.\n\nLiebe Grüße`);
            window.location.href = `mailto:office@satler.com?subject=${subject}&body=${body}`;
            
            loadData();
        } catch (error) {
            console.error(error);
            toast.error("Fehler beim Genehmigen");
        }
    };

    const handleReject = async (id: string) => {
        try {
            await updateLeaveRequestStatus(id, 'rejected', adminComment);
            toast.success("Antrag abgelehnt");
            setRejectingId(null);
            setAdminComment('');
            loadData();
        } catch (error) {
            console.error(error);
            toast.error("Fehler beim Ablehnen");
        }
    };

    const handleQuery = async (id: string) => {
        try {
            await updateLeaveRequestStatus(id, 'needs_info', adminComment);
            toast.success("Rückfrage gesendet");
            setQueryingId(null);
            setAdminComment('');
            loadData();
        } catch (error) {
            console.error(error);
            toast.error("Fehler beim Senden der Rückfrage");
        }
    };

    const handleReply = async (id: string, currentReason: string) => {
        if (!replyText.trim()) return toast.error("Bitte eine Antwort eingeben");
        try {
            await replyToLeaveRequestQuery(id, currentReason, replyText);
            toast.success("Antwort gesendet");
            setReplyText('');
            loadData();
        } catch (error) {
            console.error(error);
            toast.error("Fehler beim Antworten");
        }
    };

    const getStatusBadge = (status: string) => {
        switch(status) {
            case 'pending': return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full flex items-center"><Clock className="w-3 h-3 mr-1"/> Ausstehend</span>;
            case 'needs_info': return <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full flex items-center"><MessageCircle className="w-3 h-3 mr-1"/> Rückfrage v. Admin</span>;
            case 'approved': return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center"><Check className="w-3 h-3 mr-1"/> Genehmigt</span>;
            case 'rejected': return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full flex items-center"><X className="w-3 h-3 mr-1"/> Abgelehnt</span>;
            default: return null;
        }
    };

    const getStatusDot = (status: string) => {
        switch(status) {
            case 'pending':
            case 'needs_info': return <div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm" title="Ausstehend / Rückfrage" />;
            case 'approved': return <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm" title="Genehmigt" />;
            case 'rejected': return <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm" title="Abgelehnt" />;
            default: return null;
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('de-DE');
    };

    if (loading) {
        return (
            <DashboardShell title="Urlaubsanträge">
                <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div></div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell title="Urlaubsanträge">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Urlaubsanträge</h1>
                    <p className="text-sm text-gray-500">Verwaltung von Abwesenheiten und Urlaub</p>
                </div>
            </div>

            {userRole === 'admin' ? (
                // ADMIN VIEW
                <div className="space-y-8">
                    {/* Pending Requests */}
                    {activeTab === 'pending' && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                <h2 className="text-lg font-semibold text-gray-900 flex items-center"><Clock className="w-5 h-5 mr-2 text-yellow-500" /> Offene Anträge zur Freigabe</h2>
                            </div>
                        {pendingRequests.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 italic">Keine offenen Anträge vorhanden.</div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {pendingRequests.map(req => (
                                    <li key={req.id} className="p-6 hover:bg-gray-50 transition-colors relative">
                                        <div className="absolute top-4 right-4">{getStatusDot(req.status)}</div>
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div>
                                                <div className="font-medium text-gray-900 text-lg mb-1">{req.employeeName}</div>
                                                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                                                    <span className="flex items-center"><CalendarRange className="w-4 h-4 mr-1" /> {formatDate(req.startDate)} - {formatDate(req.endDate)}</span>
                                                    <span className="flex items-center"><FileText className="w-4 h-4 mr-1" /> Grund: <strong className="ml-1">{req.reason}</strong></span>
                                                    <span className="text-xs text-gray-400">Einreicht am {new Date(req.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="flex space-x-2 mt-2 md:mt-0">
                                                {rejectingId === req.id ? (
                                                    <div className="flex flex-col space-y-2 items-end">
                                                        <input 
                                                            type="text" 
                                                            placeholder="Ablehnungsgrund (optional)..." 
                                                            value={adminComment}
                                                            onChange={e => setAdminComment(e.target.value)}
                                                            className="text-sm border-gray-300 rounded-md p-2 w-64 bg-white"
                                                        />
                                                        <div className="flex space-x-2">
                                                            <button onClick={() => setRejectingId(null)} className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Abbrechen</button>
                                                            <button onClick={() => handleReject(req.id)} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">Bestätigen</button>
                                                        </div>
                                                    </div>
                                                ) : queryingId === req.id ? (
                                                    <div className="flex flex-col space-y-2 items-end">
                                                        <input 
                                                            type="text" 
                                                            placeholder="Deine Rückfrage an den Mitarbeiter..." 
                                                            value={adminComment}
                                                            onChange={e => setAdminComment(e.target.value)}
                                                            className="text-sm border-gray-300 rounded-md p-2 w-64 bg-white border"
                                                        />
                                                        <div className="flex space-x-2">
                                                            <button onClick={() => setQueryingId(null)} className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Abbrechen</button>
                                                            <button onClick={() => handleQuery(req.id)} className="px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600">Absenden</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex space-x-2">
                                                        <button 
                                                            onClick={() => handleApprove(req)}
                                                            className="flex items-center px-4 py-2 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-md transition-colors"
                                                        >
                                                            <Check className="w-4 h-4 mr-1"/> Genehmigen
                                                        </button>
                                                        <button 
                                                            onClick={() => setQueryingId(req.id)}
                                                            className="flex items-center px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 rounded-md transition-colors"
                                                        >
                                                            <MessageCircle className="w-4 h-4 mr-1"/> Rückfrage
                                                        </button>
                                                        <button 
                                                            onClick={() => setRejectingId(req.id)}
                                                            className="flex items-center px-4 py-2 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-md transition-colors"
                                                        >
                                                            <X className="w-4 h-4 mr-1"/> Ablehnen
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    )}

                    {/* Handled Requests */}
                    <div className="space-y-6">
                        {(() => {
                            const todayDateStr = new Date().toISOString().split('T')[0];
                            const upcomingHandled = handledRequests.filter(r => r.status === 'approved' && r.endDate >= todayDateStr);
                            const pastHandled = handledRequests.filter(r => r.status === 'rejected' || r.endDate < todayDateStr);

                            return (
                                <>
                                    {/* Upcoming */}
                                    {activeTab === 'approved' && (
                                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                                <h2 className="text-lg font-semibold text-gray-900 flex items-center">Aktiv & Zukünftig (Genehmigt)</h2>
                                        </div>
                                        {upcomingHandled.length === 0 ? (
                                            <div className="p-8 text-center text-gray-500 italic">Keine anstehenden Urlaube gefunden.</div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mitarbeiter</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zeitraum</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grund</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">PDF</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200 relative">
                                                        {upcomingHandled.map((req) => (
                                                            <tr key={req.id}>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                    <div className="flex items-center space-x-2">
                                                                        {getStatusDot(req.status)}
                                                                        <span>{req.employeeName}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(req.startDate)} - {formatDate(req.endDate)}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{req.reason}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    {getStatusBadge(req.status)}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                    <a 
                                                                        href={`/print/leave/${req.id}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-brand-primary hover:text-brand-primary/80 p-1 rounded-md hover:bg-gray-50 inline-flex items-center"
                                                                        title="PDF drucken"
                                                                    >
                                                                        <Printer className="w-4 h-4 mr-1" /> PDF
                                                                    </a>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                    )}

                                    {/* History / Past */}
                                    {activeTab === 'rejected' && (
                                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                                <h2 className="text-lg font-semibold text-gray-900 flex items-center">Historie (Abgelehnt oder Vergangen)</h2>
                                        </div>
                                        {pastHandled.length === 0 ? (
                                            <div className="p-8 text-center text-gray-500 italic">Noch keine Anträge bearbeitet.</div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mitarbeiter</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zeitraum</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grund</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">PDF</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200 relative">
                                                        {pastHandled.map((req) => (
                                                            <tr key={req.id}>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                    <div className="flex items-center space-x-2">
                                                                        {getStatusDot(req.status)}
                                                                        <span>{req.employeeName}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(req.startDate)} - {formatDate(req.endDate)}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{req.reason}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    {getStatusBadge(req.status)}
                                                                    {req.adminComment && <div className="text-xs text-red-500 mt-1">Grund: {req.adminComment}</div>}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                    {req.status === 'approved' && (
                                                                        <a 
                                                                            href={`/print/leave/${req.id}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-brand-primary hover:text-brand-primary/80 p-1 rounded-md hover:bg-gray-50 inline-flex items-center"
                                                                            title="PDF drucken"
                                                                        >
                                                                            <Printer className="w-4 h-4 mr-1" /> PDF
                                                                        </a>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>
            ) : (
                // EMPLOYEE/VORARBEITER VIEW
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Submission Form */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Neuen Antrag stellen</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Grund / Art</label>
                                    <select 
                                        value={reason} 
                                        onChange={e => setReason(e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-2.5 border"
                                        required
                                    >
                                        <option value="Urlaub">Urlaub</option>
                                        <option value="Sonderurlaub">Sonderurlaub</option>
                                    </select>
                                </div>
                                {reason === 'Sonderurlaub' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Details zum Sonderurlaub</label>
                                        <select 
                                            value={specialReason} 
                                            onChange={e => setSpecialReason(e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-2.5 border bg-gray-50"
                                            required
                                        >
                                            {SONDERURLAUB_GRUENDE.map((grund, idx) => (
                                                <option key={idx} value={grund}>{grund}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {reason === 'Sonderurlaub' && specialReason === 'Sonstiges' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Bitte beschreiben (Sprache egal)</label>
                                        <textarea
                                            value={otherReason}
                                            onChange={e => setOtherReason(e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-2.5 border bg-white"
                                            rows={2}
                                            required
                                            placeholder="Beschreibe den Grund kurz..."
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Startdatum</label>
                                    <input 
                                        type="date" 
                                        required
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-2.5 border"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Enddatum</label>
                                    <input 
                                        type="date" 
                                        required
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-2.5 border"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-50 mt-6"
                                >
                                    {submitting ? 'Wird gesendet...' : 'Antrag einreichen'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Own Request History */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Meine bisherigen Anträge
                                </h2>
                            </div>
                            
                            {myRequests.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 italic">Sie haben noch keine Anträge gestellt.</div>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {myRequests.map((req) => (
                                        <li key={req.id} className="p-6 hover:bg-gray-50 relative">
                                            <div className="absolute top-4 right-4">{getStatusDot(req.status)}</div>
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                                <div>
                                                        <div className="flex items-center space-x-3 mb-1">
                                                            <span className="font-bold text-gray-900">{req.reason}</span>
                                                            {getStatusBadge(req.status)}
                                                            {req.status === 'approved' && (
                                                                <a 
                                                                    href={`/print/leave/${req.id}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-brand-primary hover:text-brand-primary/80 px-2 py-0.5 rounded border border-brand-primary/20 hover:border-brand-primary/50 text-xs font-semibold inline-flex items-center bg-brand-primary/5 transition-colors"
                                                                    title="PDF drucken"
                                                                >
                                                                    <Printer className="w-3.5 h-3.5 mr-1" /> PDF
                                                                </a>
                                                            )}
                                                        </div>
                                                    <div className="text-sm text-gray-600 flex items-center">
                                                        <CalendarRange className="w-4 h-4 mr-1 opacity-70" />
                                                        {formatDate(req.startDate)} - {formatDate(req.endDate)}
                                                    </div>
                                                    {req.status === 'rejected' && req.adminComment && (
                                                        <div className="text-sm text-red-600 mt-2 p-2 bg-red-50 rounded italic border border-red-100">
                                                            <span className="font-semibold not-italic">Grund für Ablehnung:</span> {req.adminComment}
                                                        </div>
                                                    )}
                                                    {req.status === 'needs_info' && req.adminComment && (
                                                        <div className="mt-3 p-3 bg-orange-50 rounded-md border border-orange-100">
                                                            <div className="text-sm text-orange-800 font-medium mb-1 flex items-center">
                                                                <MessageCircle className="w-4 h-4 mr-1" />
                                                                Admin fragt: {req.adminComment}
                                                            </div>
                                                            <div className="flex mt-2 gap-2">
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="Ihre Antwort..." 
                                                                    value={replyText}
                                                                    onChange={e => setReplyText(e.target.value)}
                                                                    className="text-sm border-gray-300 rounded-md p-1.5 flex-1 border bg-white focus:ring-orange-500 focus:border-orange-500"
                                                                />
                                                                <button 
                                                                    onClick={() => handleReply(req.id, req.reason)}
                                                                    className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 font-medium"
                                                                >
                                                                    Antworten
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-400 text-right">
                                                    Eingereicht am<br/>
                                                    {new Date(req.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </DashboardShell>
    );
};
