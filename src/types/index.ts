export type UserRole = 'player' | 'owner' | 'admin' | 'subadmin';
export type KycStatus = 'none' | 'pending' | 'approved' | 'declined';
export type PermKey = 'grounds' | 'slots' | 'bookings' | 'reports' | 'sellers' | 'users';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isPhoneVerified: boolean;
  emailVerifiedAt?: string;
  kycStatus?: KycStatus;
  kycNote?: string | null;
  kycDocumentUrl?: string | null;
  permissions?: string[];
  createdAt: string;
}

export interface Seller {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessName: string | null;
  businessType: string[];
  businessCity: string | null;
  businessAddress: string | null;
  businessContact: string | null;
  registrationNumber: string | null;
  businessDescription: string | null;
  kycStatus: KycStatus;
  kycDocumentUrl: string | null;
  kycNote: string | null;
  kycReviewedAt: string | null;
  createdAt: string;
  groundCount: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Ground {
  id: string;
  name: string;
  address: string;
  city: string;
  contact: string;
  description: string;
  basePrice: number;
  peakPrice?: number;
  sportType?: string;
  imageUrl?: string;
  gallery?: string[] | null;
  rating?: number;
  ratingCount?: number;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  ownerId: string;
  isActive?: boolean;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}

export interface Slot {
  id: string;
  groundId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'held' | 'booked' | 'maintenance' | 'blocked';
  price: number;
}

export interface City {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
}

export interface GroundPayload {
  name: string;
  address?: string;
  city?: string;
  contact?: string;
  basePrice: number;
  peakPrice?: number;
  sportType?: string;
  description?: string;
  operatingStart?: string;
  operatingEnd?: string;
  isActive?: boolean;
  latitude?: number;
  longitude?: number;
  gallery?: string[];
  imageUrl?: string;
}

export interface Booking {
  id: string;
  userId: string | null;
  groundId: string;
  slotId?: string | null;
  groundName: string;
  groundContact?: string;
  groundAddress?: string;
  groundCity?: string;
  groundLatitude?: number | null;
  groundLongitude?: number | null;
  groundSportType?: string;
  groundDescription?: string | null;
  groundImageUrl?: string | null;
  operatingStart?: string;
  operatingEnd?: string;
  groundOwner?: {
    id?: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    business?: string | null;
  } | null;
  userPhone?: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'late_cancelled';
  totalPrice: number;
  numberOfPlayers?: number;
  specialRequests?: string;
  source?: 'online' | 'walk_in';
  customerName?: string;
  customerPhone?: string;
  userName?: string;
  userEmail?: string;
  paymentStatus?: 'unpaid' | 'pending' | 'paid' | 'refunded' | 'partial_refund';
  paymentMethod?: string;
  bookingRef?: string;
  paymentDeadline?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  isLateCancellation?: boolean;
  lateCancellationFee?: number;
  requiresApproval?: boolean;
  depositAmount?: number;
  balanceAmount?: number;
  depositPaid?: boolean;
  depositRefunded?: boolean;
  batchGroupId?: string;
  depositOnly?: boolean;
  refundAmount?: number;
  completedAt?: string | null;
  createdAt: string;
}

export interface BookingPaymentAttempt {
  id: string;
  gateway: 'khalti' | 'esewa' | string;
  amount: number;
  currency: string;
  status: string;
  failureReason?: string | null;
  providerTransactionId?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
}

export interface BookingDetail {
  booking: Booking;
  payments: BookingPaymentAttempt[];
}

export interface CreateBookingResult {
  message: string;
  paymentRequired?: boolean;
  requiresApproval?: boolean;
  holdExpiresAt?: string;
  booking: Booking;
}

export interface BatchBookingResponse {
  message: string;
  paymentRequired: boolean;
  holdExpiresAt: string;
  batchGroupId: string;
  totalPrice: number;
  bookings: Booking[];
}

export interface PaymentInitResult {
  paymentId: string;
  redirectUrl?: string;
  formUrl?: string;
  formFields?: Record<string, string>;
  transactionUuid?: string;
  bookingRef?: string;
  batchGroupId?: string;
  totalPrice?: number;
  depositAmount?: number;
  depositOnly?: boolean;
}

export interface GroundFilters {
  city?: string;
  date?: string;
  search?: string;
  sportType?: string;
  ownerId?: string;
  sort?: 'recent' | 'rating';
  page?: number;
  limit?: number;
}

export interface BookingFilters {
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'late_cancelled';
  requiresApproval?: boolean;
  date?: string;
  groundId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface Payment {
  id: string;
  bookingId: string;
  gateway: 'khalti' | 'esewa';
  providerOrderId?: string;
  providerPidx?: string;
  providerTransactionId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'success';
  verifiedAt?: string;
  failureReason?: string;
  createdAt: string;
  batchGroupId?: string;
  bookingStatus?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'late_cancelled';
  bookingTotalPrice?: number;
  bookingDepositAmount?: number;
  bookingDepositPaid?: boolean;
}

export interface AdminReport {
  totalRevenue: number;
  totalBookings: number;
  bookingsPerDay: { date: string; count: number; revenue: number }[];
}

export interface DashboardStats {
  totalBookingsToday: number;
  revenueToday: number;
  totalGrounds: number;
  upcomingBookings: number;
}

export interface GroundRatingInfo {
  average: number;
  count: number;
  myRating: number | null;
  canRate: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export const MAX_ACTIVE_BOOKINGS = 3;
export const FREE_CANCELLATION_HOURS = 24;
export const DEPOSIT_RATE = 0.4;

// -------------------------------------------------------------------------
// Notifications (in-app inbox, shared by all four roles)
// -------------------------------------------------------------------------

export type NotificationType =
  | 'booking_held'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_request'
  | 'approval_approved'
  | 'approval_rejected'
  | 'payment_paid'
  | 'payment_failed'
  | 'payment_recorded'
  | 'refund_recorded'
  | 'reminder'
  | 'kyc_status';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  bookingId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  unreadCount: number;
  total: number;
  page: number;
  limit: number;
}
