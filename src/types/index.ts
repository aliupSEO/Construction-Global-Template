export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  reason: 'Urlaub' | 'Krankheit' | 'Sonderurlaub' | string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_info';
  adminComment?: string;
  createdAt: number;
}
