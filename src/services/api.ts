import axios from 'axios';
import type { AuthResponse, Ground, Slot, Booking, BookingDetail, Payment, GroundFilters, BookingFilters, DashboardStats, AdminReport, Seller, GroundPayload, BatchBookingResponse, CreateBookingResult, PaymentInitResult, City, GroundRatingInfo, NotificationListResponse, AppNotification } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('maidan_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('maidan_token');
      localStorage.removeItem('maidan_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data: FormData | { name: string; email: string; password: string; phone?: string; role?: string }) =>
    api.post<AuthResponse>('/auth/register', data, {
      headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    }),
  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data),
  sendOtp: (phone: string) =>
    api.post<{ message: string }>('/auth/verify-phone', { phone }),
  verifyOtp: (phone: string, code: string) =>
    api.post<{ message: string; user: AuthResponse['user'] }>('/auth/verify-phone/confirm', { phone, code }),
  resendOtp: (phone: string) =>
    api.post<{ message: string }>('/auth/resend-otp', { phone }),
  me: () =>
    api.get<{ user: AuthResponse['user'] }>('/auth/me'),
  submitKyc: (data: FormData) =>
    api.post<{ message: string; user: AuthResponse['user'] }>('/auth/kyc', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  forgotPassword: (identifier: { email?: string; phone?: string }) =>
    api.post<{ message: string; found?: boolean; name?: string; maskedContact?: string; phone?: string }>(
      '/auth/forgot-password',
      identifier
    ),
  resetPassword: (data: { phone: string; code: string; newPassword: string }) =>
    api.post<{ message: string }>('/auth/reset-password', data),
  firebaseGoogle: (idToken: string) =>
    api.post<AuthResponse>('/auth/firebase/google', { idToken }),
  addPhone: (phone: string) =>
    api.post<{ message: string }>('/auth/me/phone', { phone }),
};

export const groundsAPI = {
  getAll: (filters?: GroundFilters) =>
    api.get<{ grounds: Ground[]; total: number }>('/grounds', { params: filters }),
  getById: (id: string) =>
    api.get<Ground>(`/grounds/${id}`),
  getSlots: (groundId: string, date: string) =>
    api.get<Slot[]>(`/grounds/${groundId}/slots`, { params: { date } }),
  getAvailableToday: (city?: string) =>
    api.get('/grounds/available-today', { params: city ? { city } : {} }),
  getRatingInfo: (id: string) =>
    api.get<GroundRatingInfo>(`/grounds/${id}/rating`),
  rateGround: (id: string, rating: number) =>
    api.post<{ message: string; average: number; count: number; myRating: number }>(`/grounds/${id}/rate`, { rating }),
};

export const bookingsAPI = {
  create: (data: { groundId?: string; slotId?: string; bookingDate?: string; startTime?: string; numberOfPlayers?: number; specialRequests?: string; paymentMethod?: 'online' | 'counter' | 'cash' }) =>
    api.post<CreateBookingResult>('/bookings', data),
  createBatch: (data: { slotIds: string[]; numberOfPlayers?: number; specialRequests?: string }) =>
    api.post<BatchBookingResponse>('/bookings/batch', data),
  createWalkIn: (data: { groundId?: string; slotId?: string; bookingDate?: string; startTime?: string; numberOfPlayers?: number; specialRequests?: string; customerName: string; customerPhone: string; paymentMethod?: 'cash' | 'unpaid' }) =>
    api.post<{ message: string; booking: Booking }>('/bookings/walk-in', data),
  getMyBookings: (filters?: BookingFilters) =>
    api.get<{ bookings: Booking[]; total: number; page: number; limit: number }>('/bookings', { params: filters }),
  getById: (id: string) =>
    api.get<BookingDetail>(`/bookings/${id}`),
  getActiveCount: () =>
    api.get<{ count: number }>('/bookings/active-count'),
  cancel: (id: string, reason?: string) =>
    api.patch<{ message: string; booking: Booking & { refundAmount?: number } }>(`/bookings/${id}/cancel`, { reason }),
};

export const paymentsAPI = {
  initiate: (data: { bookingId?: string; batchGroupId?: string; gateway: 'khalti' | 'esewa' }) =>
    api.post<PaymentInitResult>('/payments/initiate', data),
  getStatus: (bookingId: string) =>
    api.get<{ payment: Payment; booking: Booking }>(`/payments/status/${bookingId}`),
};

export const citiesAPI = {
  getCities: (includeInactive?: boolean) =>
    api.get<{ cities: City[] }>('/cities', {
      params: includeInactive ? { includeInactive: 'true' } : {},
    }),
};

export const adminAPI = {
  getDashboard: () =>
    api.get<DashboardStats>('/admin/dashboard'),
  getSellers: (params?: { status?: string; search?: string; page?: number; limit?: number }) =>
    api.get<{ sellers: Seller[]; total: number; page: number; limit: number }>('/admin/sellers', { params }),
  getSeller: (id: string) =>
    api.get<{ seller: Seller }>(`/admin/sellers/${id}`),
  reviewKyc: (id: string, data: { status: 'approved' | 'declined' | 'pending'; note?: string }) =>
    api.patch<{ message: string; seller: Seller }>(`/admin/sellers/${id}/kyc`, data),
  getAllBookings: (filters?: BookingFilters) =>
    api.get<{ bookings: Booking[]; total: number }>('/admin/bookings', { params: filters }),
  getBooking: (id: string) =>
    api.get<{ booking: Booking }>(`/admin/bookings/${id}`),
  getAllUsers: (params?: { role?: string; search?: string; page?: number; limit?: number }) =>
    api.get<{ users: { id: string; name: string; email: string; phone: string; role: string; isPhoneVerified: boolean; createdAt: string }[]; total: number }>('/admin/users', { params }),
  createGround: (data: GroundPayload) =>
    api.post<{ message: string; ground: Ground; slotsGenerated: number }>('/admin/grounds', data),
  updateGround: (id: string, data: GroundPayload) =>
    api.put<{ message: string; ground: Ground }>(`/admin/grounds/${id}`, data),
  deleteGround: (id: string) =>
    api.delete<{ message: string }>(`/admin/grounds/${id}`),
  uploadGroundPhotos: (data: FormData) =>
    api.post<{ urls: string[] }>('/admin/grounds/upload', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateSlots: (groundId: string, date: string, slots: { startTime: string; status?: string; price?: number }[]) =>
    api.put(`/grounds/${groundId}/slots`, { date, slots }),
  generateSlots: (groundId: string, data?: { startDate?: string; days?: number }) =>
    api.post<{ message: string; generated: number; skipped: number }>(`/admin/grounds/${groundId}/slots/generate`, data),
  getReports: (params?: { startDate?: string; endDate?: string; groundId?: string }) =>
    api.get<AdminReport>('/admin/reports', { params }),
  cancelBooking: (id: string, reason: string) =>
    api.patch<{ message: string; booking: { id: string; status: string } }>(`/admin/bookings/${id}/cancel`, { reason }),
  approveBooking: (id: string) =>
    api.patch<{ message: string; booking: { id: string; status: string; requiresApproval: boolean } }>(`/bookings/${id}/approve`),
  createStaff: (data: { name: string; email: string; phone?: string; password: string; permissions: string[] }) =>
    api.post<{ message: string; user: { id: string; name: string; email: string; phone: string; role: string; permissions: string[]; createdAt: string } }>('/admin/staff', data),
  listStaff: () =>
    api.get<{ staff: { id: string; name: string; email: string; phone: string; role: string; permissions: string[]; createdAt: string }[] }>('/admin/staff'),
  updateStaff: (id: string, data: { permissions?: string[]; password?: string }) =>
    api.patch<{ message: string; user: { id: string; name: string; email: string; phone: string; role: string; permissions: string[]; createdAt: string } }>(`/admin/staff/${id}`, data),
  deleteStaff: (id: string) =>
    api.delete<{ message: string }>(`/admin/staff/${id}`),
  markPaid: (id: string) =>
    api.patch<{ message: string; booking: { id: string; paymentStatus: string; paymentMethod?: string } }>(`/bookings/${id}/mark-paid`),
  refundDeposit: (id: string) =>
    api.patch<{ message: string; refundAmount: number; booking: { id: string; depositRefunded: boolean; paymentStatus: string } }>(`/bookings/${id}/refund-deposit`),
  createCity: (data: { name: string; latitude?: number | null; longitude?: number | null }) =>
    api.post<{ city: City }>('/admin/cities', data),
  updateCity: (id: string, data: { name?: string; latitude?: number | null; longitude?: number | null; isActive?: boolean }) =>
    api.patch<{ city: City }>(`/admin/cities/${id}`, data),
};

export const notificationsAPI = {
  list: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    api.get<NotificationListResponse>('/notifications', { params }),
  getUnreadCount: () =>
    api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) =>
    api.patch<{ notification: AppNotification }>(`/notifications/${id}/read`),
  markAllRead: () =>
    api.patch<{ message: string; updated: number }>('/notifications/read-all'),
  dismiss: (id: string) =>
    api.delete<{ message: string }>(`/notifications/${id}`),
  clearAll: () =>
    api.delete<{ message: string; deleted: number }>('/notifications'),
};

export default api;
