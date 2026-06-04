import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { createLeaveRequest, getLeaveRequestsByEmployee, getAllPendingRequests, getHandledRequests, updateLeaveRequestStatus, replyToLeaveRequestQuery } from '../services/leaveRequests';
import { translateToGerman } from '../lib/translate';
import { LeaveRequest } from '../types';
import { DashboardShell } from '../components/DashboardShell';
import { CalendarRange, Check, X, Clock, FileText, MessageCircle, Printer, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, APP_ID } from '../lib/firebase';
import toast from 'react-hot-toast';

export const LeaveRequests = () => {
    const { currentUser, userRole } = useAuth();
    const [searchParams] = useSearchParams();
    
    // Tab State
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'pending');
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 8;
    
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

    // Update tab if URL changes via sidebar
    useEffect(() => {
        const urlTab = searchParams.get('tab');
        if (urlTab) {
            setActiveTab(urlTab);
            setCurrentPage(1);
        }
    }, [searchParams]);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setCurrentPage(1);
    };

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
            
            let targetEmail = 'office@example.com';
            try {
                const docSnap = await getDoc(doc(db, 'apps', APP_ID, 'metadata', 'company_profile'));
                if (docSnap.exists() && docSnap.data().email) {
                    targetEmail = docSnap.data().email;
                }
            } catch(e) {}
            
            const subject = encodeURIComponent(`Genehmigter Urlaubsantrag: ${req.employeeName}`);
            const body = encodeURIComponent(`Hallo Office-Team,\n\nder folgende Urlaubsantrag wurde genehmigt:\n\nMitarbeiter: ${req.employeeName}\nZeitraum: ${formatDate(req.startDate)} - ${formatDate(req.endDate)}\nGrund: ${req.reason}\n\nBitte im System vermerken.\n\nLiebe Grüße`);
            window.location.href = `mailto:${targetEmail}?subject=${subject}&body=${body}`;
            
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
            case 'pending': return <span className="bg-yellow-100 text-yellow-800 text-xs px-2.5 py-1 rounded-full font-semibold flex items-center w-max"><Clock className="w-3.5 h-3.5 mr-1"/> Ausstehend</span>;
            case 'needs_info': return <span className="bg-orange-100 text-orange-800 text-xs px-2.5 py-1 rounded-full font-semibold flex items-center w-max"><MessageCircle className="w-3.5 h-3.5 mr-1"/> Rückfrage v. Admin</span>;
            case 'approved': return <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-semibold flex items-center w-max"><Check className="w-3.5 h-3.5 mr-1"/> Genehmigt</span>;
            case 'rejected': return <span className="bg-red-100 text-red-800 text-xs px-2.5 py-1 rounded-full font-semibold flex items-center w-max"><X className="w-3.5 h-3.5 mr-1"/> Abgelehnt</span>;
            default: return null;
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    let displayList: LeaveRequest[] = [];
    if (userRole === 'admin') {
        if (activeTab === 'pending') displayList = pendingRequests;
        else if (activeTab === 'approved') displayList = handledRequests.filter(r => r.status === 'approved').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        else if (activeTab === 'rejected') displayList = handledRequests.filter(r => r.status === 'rejected').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
        displayList = myRequests;
    }

    // Pagination Calculation
    const totalPages = Math.max(Math.ceil(displayList.length / ITEMS_PER_PAGE), 1);
    const paginatedList = displayList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const renderPagination = () => {
        if (displayList.length <= ITEMS_PER_PAGE) return null;
        return (
            <div className="flex justify-between items-center bg-white py-3 px-5 rounded-2xl shadow-sm border border-gray-100 mt-auto w-full">
                <span className="text-sm text-gray-500">
                    Seite <span className="font-semibold text-gray-900">{currentPage}</span> von <span className="font-semibold text-gray-900">{totalPages}</span>
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage >= totalPages}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <DashboardShell title="Urlaubsanträge">
                <div className="flex justify-center items-center min-h-[50vh]">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell title="Urlaubsanträge">
            <div className="max-w-7xl mx-auto flex flex-col min-h-[calc(100vh-8rem)]">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Urlaubsanträge</h1>
                        <p className="text-sm text-gray-500 mt-1">Verwaltung von Abwesenheiten und Urlaub</p>
                    </div>
                </div>

                {userRole === 'admin' ? (
                    // ADMIN VIEW
                    <div className="flex flex-col flex-1">
                        
                        {/* Tab Navigation */}
                        <div className="flex overflow-x-auto space-x-2 bg-white/50 p-1.5 rounded-2xl mb-6 shadow-sm border border-gray-100 w-max max-w-full backdrop-blur-md">
                            <button 
                                onClick={() => handleTabChange('pending')} 
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center ${activeTab === 'pending' ? 'bg-white text-brand-primary shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
                            >
                                <Clock className="w-4 h-4 mr-2" />
                                Offene Anträge
                                {pendingRequests.length > 0 && (
                                    <span className="ml-2 bg-yellow-100 text-yellow-700 py-0.5 px-2 rounded-full text-xs">{pendingRequests.length}</span>
                                )}
                            </button>
                            <button 
                                onClick={() => handleTabChange('approved')} 
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center ${activeTab === 'approved' ? 'bg-white text-brand-primary shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
                            >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Genehmigt
                            </button>
                            <button 
                                onClick={() => handleTabChange('rejected')} 
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center ${activeTab === 'rejected' ? 'bg-white text-brand-primary shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
                            >
                                <XCircle className="w-4 h-4 mr-2" />
                                Abgelehnt
                            </button>
                        </div>

                        {/* List Content */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 flex-1 flex flex-col">
                            {displayList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-16 text-center h-full">
                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                        <CalendarRange className="w-10 h-10 text-gray-300" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Keine Anträge gefunden</h3>
                                    <p className="text-gray-500 max-w-sm">
                                        {activeTab === 'pending' ? 'Es gibt aktuell keine offenen Urlaubsanträge zur Bearbeitung.' : 
                                         activeTab === 'approved' ? 'Es gibt keine genehmigten Anträge.' : 
                                         activeTab === 'rejected' ? 'Es gibt keine abgelehnten Anträge.' : 
                                         'Es gibt keine Anträge.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                                                <th className="py-4 px-6">Mitarbeiter</th>
                                                <th className="py-4 px-6">Zeitraum</th>
                                                <th className="py-4 px-6">Grund</th>
                                                <th className="py-4 px-6">Status</th>
                                                <th className="py-4 px-6 text-right">Aktionen</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {paginatedList.map((req) => (
                                                <tr key={req.id} className="hover:bg-gray-50/50 transition-colors group">
                                                    <td className="py-4 px-6">
                                                        <div className="font-bold text-gray-900">{req.employeeName}</div>
                                                        <div className="text-xs text-gray-400 mt-1">Eingereicht: {formatDate(req.createdAt)}</div>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center text-sm font-medium text-gray-700">
                                                            <CalendarRange className="w-4 h-4 mr-2 text-gray-400 group-hover:text-brand-primary transition-colors" />
                                                            {formatDate(req.startDate)} - {formatDate(req.endDate)}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="text-sm text-gray-600 font-medium max-w-xs truncate" title={req.reason}>
                                                            {req.reason}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        {getStatusBadge(req.status)}
                                                        {req.adminComment && req.status !== 'pending' && (
                                                            <div className="text-xs text-gray-500 mt-2 italic max-w-xs truncate" title={req.adminComment}>
                                                                Notiz: {req.adminComment}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        {activeTab === 'pending' || req.status === 'needs_info' ? (
                                                            <div className="flex flex-col items-end gap-2">
                                                                {rejectingId === req.id || queryingId === req.id ? (
                                                                    <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-lg absolute right-6 z-10 animate-in fade-in zoom-in duration-200">
                                                                        <input 
                                                                            type="text" 
                                                                            placeholder={rejectingId ? "Ablehnungsgrund..." : "Deine Rückfrage..."}
                                                                            value={adminComment}
                                                                            onChange={e => setAdminComment(e.target.value)}
                                                                            className="text-sm border-none ring-0 focus:ring-0 bg-transparent p-2 w-48"
                                                                            autoFocus
                                                                        />
                                                                        <button onClick={() => { setRejectingId(null); setQueryingId(null); }} className="p-2 text-gray-400 hover:text-gray-600 rounded-md transition-colors"><X className="w-4 h-4"/></button>
                                                                        <button 
                                                                            onClick={() => rejectingId ? handleReject(req.id) : handleQuery(req.id)} 
                                                                            className={`px-4 py-1.5 text-sm font-bold text-white rounded-md transition-colors ${rejectingId ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'}`}
                                                                        >
                                                                            Senden
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex justify-end gap-2">
                                                                        <button 
                                                                            onClick={() => handleApprove(req)}
                                                                            className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                                                                            title="Genehmigen"
                                                                        >
                                                                            <Check className="w-4 h-4" />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => setQueryingId(req.id)}
                                                                            className="p-2 bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white rounded-lg transition-all"
                                                                            title="Rückfrage"
                                                                        >
                                                                            <MessageCircle className="w-4 h-4" />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => setRejectingId(req.id)}
                                                                            className="p-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                                                                            title="Ablehnen"
                                                                        >
                                                                            <X className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex justify-end items-center">
                                                                {req.status === 'approved' && (
                                                                    <a 
                                                                        href={`/print/leave/${req.id}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center px-3 py-1.5 bg-gray-50 text-gray-700 hover:bg-brand-primary hover:text-white rounded-lg transition-colors font-medium text-sm border border-gray-200 hover:border-transparent"
                                                                    >
                                                                        <Printer className="w-4 h-4 mr-1.5" /> Drucken
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {renderPagination()}

                    </div>
                ) : (
                    // EMPLOYEE/VORARBEITER VIEW
                    <div className="flex flex-col xl:flex-row gap-8 flex-1">
                        {/* Left: Request Form */}
                        <div className="w-full xl:w-[400px] shrink-0 flex flex-col">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 flex-1">
                                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                                    <CalendarRange className="w-5 h-5 mr-2 text-brand-primary" />
                                    Neuen Antrag stellen
                                </h2>
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Grund / Art</label>
                                        <select 
                                            value={reason} 
                                            onChange={e => setReason(e.target.value)}
                                            className="input-premium appearance-none bg-gray-50"
                                            required
                                        >
                                            <option value="Urlaub">Urlaub</option>
                                            <option value="Sonderurlaub">Sonderurlaub</option>
                                        </select>
                                    </div>
                                    {reason === 'Sonderurlaub' && (
                                        <div className="animate-in fade-in slide-in-from-top-2">
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Details zum Sonderurlaub</label>
                                            <select 
                                                value={specialReason} 
                                                onChange={e => setSpecialReason(e.target.value)}
                                                className="input-premium appearance-none bg-gray-50"
                                                required
                                            >
                                                {SONDERURLAUB_GRUENDE.map((grund, idx) => (
                                                    <option key={idx} value={grund}>{grund}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {reason === 'Sonderurlaub' && specialReason === 'Sonstiges' && (
                                        <div className="animate-in fade-in slide-in-from-top-2">
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Bitte beschreiben (Sprache egal)</label>
                                            <textarea
                                                value={otherReason}
                                                onChange={e => setOtherReason(e.target.value)}
                                                className="input-premium bg-gray-50 resize-none"
                                                rows={3}
                                                required
                                                placeholder="Beschreibe den Grund kurz..."
                                            />
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Startdatum</label>
                                            <input 
                                                type="date" 
                                                required
                                                value={startDate}
                                                onChange={e => setStartDate(e.target.value)}
                                                className="input-premium bg-gray-50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Enddatum</label>
                                            <input 
                                                type="date" 
                                                required
                                                value={endDate}
                                                onChange={e => setEndDate(e.target.value)}
                                                className="input-premium bg-gray-50"
                                            />
                                        </div>
                                    </div>
                                    <div className="pt-4 mt-auto">
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 hover:shadow-lg transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-50 disabled:hover:translate-y-0"
                                        >
                                            {submitting ? (
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            ) : (
                                                'Antrag einreichen'
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* Right: Own Request History */}
                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col flex-1 overflow-hidden mb-6">
                                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/80">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center">
                                        <Clock className="w-5 h-5 mr-2 text-gray-400" />
                                        Meine Anträge
                                    </h2>
                                </div>
                                
                                {displayList.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-16 text-center h-full">
                                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                            <FileText className="w-10 h-10 text-gray-300" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-1">Keine Anträge</h3>
                                        <p className="text-gray-500 text-sm">Du hast bisher noch keine Urlaubsanträge gestellt.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto flex-1">
                                        <table className="min-w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wider font-semibold">
                                                    <th className="py-4 px-6">Antrag Details</th>
                                                    <th className="py-4 px-6">Status</th>
                                                    <th className="py-4 px-6 text-right">PDF</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {paginatedList.map((req) => (
                                                    <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="py-5 px-6">
                                                            <div className="font-bold text-gray-900 mb-1">{req.reason}</div>
                                                            <div className="flex items-center text-sm font-medium text-gray-600">
                                                                <CalendarRange className="w-4 h-4 mr-1.5 text-gray-400" />
                                                                {formatDate(req.startDate)} - {formatDate(req.endDate)}
                                                            </div>
                                                            <div className="text-xs text-gray-400 mt-2">Eingereicht am {formatDate(req.createdAt)}</div>
                                                        </td>
                                                        <td className="py-5 px-6">
                                                            {getStatusBadge(req.status)}
                                                            
                                                            {/* Status Context Messages */}
                                                            {req.status === 'rejected' && req.adminComment && (
                                                                <div className="mt-3 p-3 bg-red-50/50 rounded-lg border border-red-100 text-sm text-red-800 max-w-sm">
                                                                    <span className="font-bold text-red-900 block mb-0.5">Ablehnungsgrund:</span>
                                                                    {req.adminComment}
                                                                </div>
                                                            )}
                                                            {req.status === 'needs_info' && req.adminComment && (
                                                                <div className="mt-3 p-4 bg-orange-50/80 rounded-xl border border-orange-100 max-w-md">
                                                                    <div className="text-sm text-orange-900 font-bold mb-1 flex items-center">
                                                                        <MessageCircle className="w-4 h-4 mr-1.5 text-orange-500" />
                                                                        Rückfrage vom Admin:
                                                                    </div>
                                                                    <div className="text-sm text-orange-800 mb-3 italic">"{req.adminComment}"</div>
                                                                    <div className="flex gap-2">
                                                                        <input 
                                                                            type="text" 
                                                                            placeholder="Deine Antwort eingeben..." 
                                                                            value={replyText}
                                                                            onChange={e => setReplyText(e.target.value)}
                                                                            className="text-sm border-orange-200 rounded-lg p-2.5 flex-1 bg-white focus:ring-orange-500 focus:border-orange-500 shadow-sm"
                                                                        />
                                                                        <button 
                                                                            onClick={() => handleReply(req.id, req.reason)}
                                                                            className="px-4 py-2.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold shadow-md transition-colors whitespace-nowrap"
                                                                        >
                                                                            Antworten
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="py-5 px-6 text-right">
                                                            {req.status === 'approved' && (
                                                                <a 
                                                                    href={`/print/leave/${req.id}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center px-4 py-2 bg-gray-50 text-gray-700 hover:bg-brand-primary hover:text-white rounded-xl transition-all font-bold text-sm border border-gray-200 hover:border-transparent shadow-sm hover:shadow-md"
                                                                    title="PDF drucken"
                                                                >
                                                                    <Printer className="w-4 h-4 md:mr-2" />
                                                                    <span className="hidden md:inline">PDF laden</span>
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

                            {renderPagination()}

                        </div>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
};
