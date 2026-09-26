import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { safeReturnTo } from './lib/returnTo';
import { Spinner } from './components/ui/spinner';
import PublicLayout from './components/templates/PublicLayout';
import AdminLayout from './components/admin/AdminLayout';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SellerApplyPage from './pages/SellerApplyPage';
import UserDashboard from './pages/UserDashboard';
import GroundsListingPage from './pages/GroundsListingPage';
import GroundDetailPage from './pages/GroundDetailPage';
import BookingPage from './pages/BookingPage';
import BookingHistoryPage from './pages/BookingHistoryPage';
import PlayerBookingDetailPage from './pages/PlayerBookingDetailPage';
import PaymentReturnPage from './pages/PaymentReturnPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import ManageGroundsPage from './pages/admin/ManageGroundsPage';
import ManageSlotsPage from './pages/admin/ManageSlotsPage';
import AdminBookingsPage from './pages/admin/AdminBookingsPage';
import AdminBookingDetailPage from './pages/admin/AdminBookingDetailPage';
import NewWalkInBookingPage from './pages/admin/NewWalkInBookingPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminSellersPage from './pages/admin/AdminSellersPage';
import AdminSellerDetailPage from './pages/admin/AdminSellerDetailPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminStaffPage from './pages/admin/AdminStaffPage';
import CitiesManagementPage from './pages/admin/CitiesManagementPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import CompleteSignupPage from './pages/CompleteSignupPage';
import OwnerGate from './components/guards/OwnerGate';
import OwnerLayout from './components/owner/OwnerLayout';
import OwnerDashboardPage from './pages/owner/OwnerDashboardPage';
import OwnerGroundsPage from './pages/owner/OwnerGroundsPage';
import OwnerGroundDetailPage from './pages/owner/OwnerGroundDetailPage';
import OwnerNewGroundPage from './pages/owner/OwnerNewGroundPage';
import OwnerSlotsPage from './pages/owner/OwnerSlotsPage';
import OwnerBookingsPage from './pages/owner/OwnerBookingsPage';
import OwnerBookingDetailPage from './pages/owner/OwnerBookingDetailPage';
import OwnerNewBookingPage from './pages/owner/OwnerNewBookingPage';
import OwnerReportsPage from './pages/owner/OwnerReportsPage';
import OwnerKycPage from './pages/owner/OwnerKycPage';

function ProtectedRoute({ children, roles, perm }: { children: React.ReactNode; roles?: string[]; perm?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  if (perm && user.role === 'subadmin' && !(user.permissions ?? []).includes(perm)) {
    return <Navigate to={roleHome(user.role)} replace />;
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>;
  if (user) {
    const target = safeReturnTo(searchParams.get('returnTo'));
    return <Navigate to={target === '/' ? roleHome(user.role) : target} replace />;
  }
  return <>{children}</>;
}

const roleHome = (role: string): string =>
  role === 'admin' || role === 'subadmin' ? '/admin' : role === 'owner' ? '/owner' : '/dashboard';

function OwnerGateRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute roles={['owner']}>
      <OwnerGate>{children}</OwnerGate>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/owner" element={<ProtectedRoute roles={['owner']}><OwnerLayout /></ProtectedRoute>}>
          <Route index element={<OwnerGateRoute><OwnerDashboardPage /></OwnerGateRoute>} />
          <Route path="grounds" element={<OwnerGateRoute><OwnerGroundsPage /></OwnerGateRoute>} />
          <Route path="grounds/new" element={<OwnerGateRoute><OwnerNewGroundPage /></OwnerGateRoute>} />
          <Route path="grounds/:id" element={<OwnerGateRoute><OwnerGroundDetailPage /></OwnerGateRoute>} />
          <Route path="slots" element={<OwnerGateRoute><OwnerSlotsPage /></OwnerGateRoute>} />
          <Route path="bookings" element={<OwnerGateRoute><OwnerBookingsPage /></OwnerGateRoute>} />
          <Route path="bookings/new" element={<OwnerGateRoute><OwnerNewBookingPage /></OwnerGateRoute>} />
          <Route path="bookings/:id" element={<OwnerGateRoute><OwnerBookingDetailPage /></OwnerGateRoute>} />
          <Route path="reports" element={<OwnerGateRoute><OwnerReportsPage /></OwnerGateRoute>} />
          <Route path="kyc" element={<ProtectedRoute roles={['owner']}><OwnerKycPage /></ProtectedRoute>} />
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/register/seller" element={<PublicRoute><SellerApplyPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/complete" element={<CompleteSignupPage />} />
          <Route path="/grounds" element={<GroundsListingPage />} />
          <Route path="/grounds/:id" element={<GroundDetailPage />} />
          <Route path="/grounds/:id/book" element={<BookingPage />} />
          <Route path="/dashboard" element={<ProtectedRoute roles={['player']}><UserDashboard /></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute roles={['player']}><BookingHistoryPage /></ProtectedRoute>} />
          <Route path="/bookings/:id" element={<ProtectedRoute roles={['player']}><PlayerBookingDetailPage /></ProtectedRoute>} />
          <Route path="/payment/success" element={<ProtectedRoute><PaymentReturnPage /></ProtectedRoute>} />
          <Route path="/payment/failed" element={<ProtectedRoute><PaymentReturnPage /></ProtectedRoute>} />
          <Route path="/payment/pending" element={<ProtectedRoute><PaymentReturnPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>

        <Route path="/admin" element={<ProtectedRoute roles={['admin', 'subadmin']}><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="bookings" element={<ProtectedRoute roles={['admin', 'subadmin']} perm="bookings"><AdminBookingsPage /></ProtectedRoute>} />
          <Route path="bookings/:id" element={<ProtectedRoute roles={['admin', 'subadmin']} perm="bookings"><AdminBookingDetailPage /></ProtectedRoute>} />
          <Route path="bookings/new" element={<ProtectedRoute roles={['admin', 'subadmin']} perm="bookings"><NewWalkInBookingPage /></ProtectedRoute>} />
          <Route path="sellers" element={<ProtectedRoute roles={['admin', 'subadmin']} perm="sellers"><AdminSellersPage /></ProtectedRoute>} />
          <Route path="sellers/:id" element={<ProtectedRoute roles={['admin', 'subadmin']} perm="sellers"><AdminSellerDetailPage /></ProtectedRoute>} />
          <Route path="grounds" element={<ProtectedRoute roles={['admin', 'subadmin']} perm="grounds"><ManageGroundsPage /></ProtectedRoute>} />
          <Route path="slots" element={<ProtectedRoute roles={['admin', 'subadmin']} perm="slots"><ManageSlotsPage /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute roles={['admin', 'subadmin']} perm="reports"><AdminReportsPage /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute roles={['admin', 'subadmin']} perm="users"><AdminUsersPage /></ProtectedRoute>} />
          <Route path="staff" element={<ProtectedRoute roles={['admin']}><AdminStaffPage /></ProtectedRoute>} />
          <Route path="cities" element={<ProtectedRoute roles={['admin']}><CitiesManagementPage /></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}