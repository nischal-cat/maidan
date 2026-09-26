/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react';
import type { City } from '../types';

interface SidebarLink {
  to: string;
  label: string;
  icon: ReactNode;
  perm?: string;
  adminOnly?: boolean;
}

export interface AdminNavLink {
  to: string;
  label: string;
  icon: ReactNode;
  perm?: string;
  adminOnly?: boolean;
}

export interface AdminNavSection {
  title: string;
  links: AdminNavLink[];
}

const icon = (d: string): ReactNode => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

export const roleBase = (role?: string): string => (role === 'admin' || role === 'subadmin' ? '/admin' : '/owner');

export const roleHome = (role?: string): string =>
  role === 'admin' || role === 'subadmin' ? '/admin' : role === 'owner' ? '/owner' : '/dashboard';

export const PERMISSION_LABELS: Record<string, string> = {
  grounds: 'Manage Grounds',
  slots: 'Slots & Pricing',
  bookings: 'Bookings',
  reports: 'Reports',
  sellers: 'Seller KYC',
  users: 'Users',
};

// Sectioned navigation for the admin shell. `perm` gates sub-admin access;
// `adminOnly` restricts a link to platform admins.
export const ADMIN_NAV: AdminNavSection[] = [
  {
    title: 'Overview',
    links: [{ to: '/admin', label: 'Dashboard', icon: icon('M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6') }],
  },
  {
    title: 'Operations',
    links: [
      { to: '/admin/bookings', label: 'Bookings', perm: 'bookings', icon: icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2') },
      { to: '/admin/sellers', label: 'Sellers', perm: 'sellers', icon: icon('M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z') },
      { to: '/admin/grounds', label: 'Grounds', perm: 'grounds', icon: icon('M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4') },
      { to: '/admin/slots', label: 'Slots', perm: 'slots', icon: icon('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z') },
    ],
  },
  {
    title: 'People',
    links: [
      { to: '/admin/users', label: 'Users', perm: 'users', icon: icon('M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z') },
      { to: '/admin/staff', label: 'Staff & Access', adminOnly: true, icon: icon('M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z') },
    ],
  },
  {
    title: 'Platform',
    links: [
      { to: '/admin/cities', label: 'Cities', adminOnly: true, icon: icon('M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z') },
      { to: '/admin/reports', label: 'Reports', perm: 'reports', icon: icon('M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z') },
    ],
  },
];

export function isAdminSectionActive(pathname: string, to: string): boolean {
  if (to === '/admin') return pathname === '/admin';
  return pathname === to || pathname.startsWith(`${to}/`);
}

export const OWNER_SIDEBAR_LINKS: SidebarLink[] = [
  { to: '/owner', label: 'Dashboard', icon: icon('M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6') },
  { to: '/owner/grounds', label: 'My Grounds', icon: icon('M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4') },
  { to: '/owner/slots', label: 'Slots & Pricing', icon: icon('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z') },
  { to: '/owner/bookings', label: 'My Bookings', icon: icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2') },
  { to: '/owner/bookings/new', label: 'New Booking', icon: icon('M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z') },
  { to: '/owner/reports', label: 'Earnings & Report', icon: icon('M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z') },
  { to: '/owner/kyc', label: 'Verification', icon: icon('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z') },
];

export const OWNER_NAV = {
  primary: [
    { to: '/owner', label: 'Overview' },
    { to: '/owner/bookings', label: 'Bookings' },
    { to: '/owner/slots', label: 'Slots' },
    { to: '/owner/grounds', label: 'Grounds' },
  ],
  business: [{ to: '/owner/reports', label: 'Reports' }],
  mobile: [
    { to: '/owner', label: 'Home' },
    { to: '/owner/bookings', label: 'Bookings' },
    { to: '/owner/slots', label: 'Slots' },
  ],
  more: [
    { to: '/owner/grounds', label: 'My Grounds' },
    { to: '/owner/bookings', label: 'All Bookings' },
    { to: '/owner/reports', label: 'Reports' },
    { to: '/owner/kyc', label: 'Verification' },
  ],
} as const;

export function isOwnerSectionActive(pathname: string, to: string): boolean {
  if (to === '/owner') return pathname === '/owner';
  return pathname.startsWith(to);
}

export const USER_SIDEBAR_LINKS: SidebarLink[] = [
  { to: '/dashboard', label: 'Dashboard', icon: icon('M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6') },
  { to: '/grounds', label: 'Find Grounds', icon: icon('M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z') },
  { to: '/bookings', label: 'My Bookings', icon: icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2') },
];

export const CITIES = [
  'Kathmandu',
  'Lalitpur',
  'Bhaktapur',
  'Pokhara',
  'Chitwan',
  'Biratnagar',
  'Dharan',
  'Itahari',
  'Janakpur',
  'Butwal',
  'Nepalgunj',
  'Birgunj',
  'Hetauda',
  'Dhangadhi',
] as const;

// Approximate city centres (lat, lng) used to snap a GPS fix to the nearest
// city. Mirrors the database seed so detection keeps working offline.
export const FALLBACK_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Kathmandu: { lat: 27.7172, lng: 85.324 },
  Lalitpur: { lat: 27.6588, lng: 85.3247 },
  Bhaktapur: { lat: 27.671, lng: 85.4298 },
  Pokhara: { lat: 28.2096, lng: 83.9856 },
  Chitwan: { lat: 27.5291, lng: 84.3542 },
  Biratnagar: { lat: 26.4525, lng: 87.2718 },
  Dharan: { lat: 26.8121, lng: 87.284 },
  Itahari: { lat: 26.6638, lng: 87.275 },
  Janakpur: { lat: 26.7289, lng: 85.925 },
  Butwal: { lat: 27.6901, lng: 83.4551 },
  Nepalgunj: { lat: 28.0537, lng: 81.6195 },
  Birgunj: { lat: 27.0056, lng: 84.8758 },
  Hetauda: { lat: 27.4312, lng: 85.0386 },
  Dhangadhi: { lat: 28.7051, lng: 80.5958 },
};

// Offline fallback list (id doubles as the key; the server list wins when online).
export const FALLBACK_CITIES: City[] = CITIES.map((name, i) => {
  const coord = FALLBACK_CITY_COORDS[name];
  return {
    id: `fallback-${i}`,
    name,
    latitude: coord?.lat ?? null,
    longitude: coord?.lng ?? null,
    isActive: true,
  };
});

export const SPORTS = ['futsal', 'cricket', 'badminton', 'tennis', 'football'] as const;
