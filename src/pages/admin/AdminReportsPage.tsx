import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { adminAPI, groundsAPI } from '../../services/api';
import { Card } from '../../components/ui/card';
import { Spinner } from '../../components/ui/spinner';
import { CHART_PRIMARY, CHART_BORDER, CHART_CARD, CHART_MUTED } from '../../constants/charts';

export default function AdminReportsPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groundId, setGroundId] = useState('');

  const { data: groundsData } = useQuery({
    queryKey: ['grounds-list', 'all'],
    queryFn: async () => {
      const res = await groundsAPI.getAll({ limit: 50 });
      return res.data;
    },
  });

  const grounds = groundsData?.grounds || [];

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', startDate, endDate, groundId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (groundId) params.groundId = groundId;
      const res = await adminAPI.getReports(params);
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-extrabold uppercase text-primary">Insights</p>
        <h1 className="mt-2 text-2xl font-extrabold text-foreground">Reports &amp; analytics</h1>
        <p className="mt-1 text-muted-foreground">Booking value and volume insights</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
        <div className="flex flex-col gap-2">
          <label htmlFor="report-start" className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Start date</label>
          <input id="report-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="min-h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="report-end" className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">End date</label>
          <input id="report-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="min-h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="report-ground" className="text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Ground</label>
          <select id="report-ground" value={groundId} onChange={(e) => setGroundId(e.target.value)} className="min-h-12 rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">All grounds</option>
            {grounds.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <div className="text-center">
                <div className="text-2xl font-extrabold text-primary">Rs {(data?.totalRevenue ?? 0).toLocaleString()}</div>
                <div className="mt-1 text-sm font-semibold text-muted-foreground">Booking value</div>
                <div className="mt-1 text-xs text-muted-foreground">Gross value of confirmed, completed and late-cancelled bookings - not cash collected</div>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-2xl font-extrabold text-foreground">{data?.totalBookings ?? 0}</div>
                <div className="mt-1 text-sm font-semibold text-muted-foreground">Total bookings</div>
              </div>
            </Card>
          </div>

          <Card>
            <h2 className="mb-4 text-lg font-extrabold text-card-foreground">Bookings per day</h2>
            {data?.bookingsPerDay && data.bookingsPerDay.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.bookingsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_BORDER} />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: CHART_MUTED }} stroke={CHART_BORDER} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: CHART_MUTED }} stroke={CHART_BORDER} />
                    <Tooltip cursor={{ fill: 'color-mix(in oklab, var(--accent) 60%, transparent)' }} contentStyle={{ background: CHART_CARD, border: `1px solid ${CHART_BORDER}`, borderRadius: 12, fontFamily: 'inherit' }} />
                    <Bar dataKey="count" fill={CHART_PRIMARY} radius={[6, 6, 0, 0]} name="Bookings" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="rounded-xl bg-muted py-12 text-center text-muted-foreground">No data available for the selected period.</div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}