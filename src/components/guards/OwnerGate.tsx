import { useAuth } from '../../context/AuthContext';
import ApplicationStatusPage from '../../pages/ApplicationStatusPage';

export default function OwnerGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || user.role !== 'owner') return <>{children}</>;
  if (user.kycStatus !== 'approved') return <ApplicationStatusPage />;
  return <>{children}</>;
}