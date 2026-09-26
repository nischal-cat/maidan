import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil } from 'lucide-react';
import { adminAPI, citiesAPI } from '../../services/api';
import { Card } from '../../components/ui/card';
import { StatusBadge } from '../../components/ui/status-badge';
import { Spinner } from '../../components/ui/spinner';
import { Button } from '../../components/ui/button';
import { TextField } from '../../components/ui/text-field';
import Modal from '../../components/organisms/Modal';
import GroundMapPicker from '../../components/owner/GroundMapPicker';
import type { City } from '../../types';

function MapPinBadge({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  if (latitude == null || longitude == null) {
    return <span className="text-xs text-muted-foreground">No coordinates</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
      <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden />
      {latitude.toFixed(4)}, {longitude.toFixed(4)}
    </span>
  );
}

export default function CitiesManagementPage() {
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<City | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-cities'],
    queryFn: async () => (await citiesAPI.getCities(true)).data.cities,
  });

  const cities = data ?? [];

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['cities'] });
    queryClient.invalidateQueries({ queryKey: ['admin-cities'] });
  };

  const openAdd = () => {
    setEditing(null);
    setShowEdit(false);
    setName('');
    setLatitude(null);
    setLongitude(null);
    setNameError(undefined);
    setFormError(undefined);
  };

  const openEdit = (city: City) => {
    setEditing(city);
    setShowEdit(true);
    setName(city.name);
    setLatitude(city.latitude);
    setLongitude(city.longitude);
    setNameError(undefined);
    setFormError(undefined);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('City name is required.');
      return;
    }
    setFormError(undefined);
    try {
      if (editing) {
        await adminAPI.updateCity(editing.id, { name: trimmed, latitude, longitude });
      } else {
        await adminAPI.createCity({ name: trimmed, latitude, longitude });
      }
      refetch();
      openAdd();
    } catch (err) {
      setFormError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to save city. Please try again.'
      );
    }
  };

  const toggleActive = async (city: City) => {
    setBusyId(city.id);
    setFormError(undefined);
    try {
      await adminAPI.updateCity(city.id, { isActive: !city.isActive });
      refetch();
    } catch (err) {
      setFormError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to update city.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const modalOpen = showEdit && editing !== null;

  return (
          <div className="space-y-6">
        <div>
          <p className="text-xs font-extrabold uppercase text-primary">Locations</p>
          <h1 className="mt-2 text-2xl font-extrabold text-foreground">Cities &amp; coverage</h1>
          <p className="mt-1 text-muted-foreground">
            These cities appear in the home search, filters and ground forms across the site.
          </p>
        </div>

        {formError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{formError}</div>
        )}

        <Card>
          <h2 className="mb-1 text-lg font-extrabold text-card-foreground">Add a city</h2>
          <p className="mb-4 text-xs font-semibold text-muted-foreground">
            Drop the pin on the city centre so GPS "detect my location" can snap players to it.
          </p>
          <div className="space-y-4">
            <TextField
              id="new-city-item"
              label="City name *"
              value={name}
              error={nameError}
              onChange={(e) => { setName(e.target.value); setNameError(undefined); }}
              placeholder="e.g. Dharan"
            />
            <GroundMapPicker
              latitude={latitude}
              longitude={longitude}
              address=""
              onChange={(v) => { setLatitude(v.latitude); setLongitude(v.longitude); }}
            />
            <div className="flex justify-end">
              <Button onClick={save}>Add city</Button>
            </div>
          </div>
        </Card>

        <Card padding={false}>
          <div className="border-b border-border px-4 py-4">
            <h2 className="text-lg font-extrabold text-card-foreground">All cities ({cities.length})</h2>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : cities.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No cities yet. Add your first city above.</div>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {cities.map((city) => (
                  <div key={city.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate font-bold text-card-foreground">{city.name}</p>
                      <StatusBadge variant={city.isActive ? 'success' : 'default'}>
                        {city.isActive ? 'Active' : 'Hidden'}
                      </StatusBadge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <MapPinBadge latitude={city.latitude} longitude={city.longitude} />
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(city)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                      </Button>
                      <Button
                        variant={city.isActive ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => toggleActive(city)}
                        disabled={busyId === city.id}
                      >
                        {city.isActive ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">City</th>
                      <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Centre coordinates</th>
                      <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-right text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cities.map((city) => (
                      <tr key={city.id} className="border-b border-border last:border-0 transition-colors hover:bg-accent/50">
                        <td className="px-4 py-3 font-bold text-card-foreground">{city.name}</td>
                        <td className="px-4 py-3">
                          <MapPinBadge latitude={city.latitude} longitude={city.longitude} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge variant={city.isActive ? 'success' : 'default'}>
                            {city.isActive ? 'Active' : 'Hidden'}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEdit(city)}>
                              <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                            </Button>
                            <Button
                              variant={city.isActive ? 'outline' : 'primary'}
                              size="sm"
                              onClick={() => toggleActive(city)}
                              disabled={busyId === city.id}
                            >
                              {city.isActive ? 'Hide' : 'Show'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        <p className="text-xs font-semibold text-muted-foreground">
          Hiding a city removes it from search filters but keeps existing grounds in that city bookable.
        </p>

        <Modal
          open={modalOpen}
          onClose={() => { setEditing(null); setShowEdit(false); }}
          title="Edit city"
        >
          {editing && (
            <div className="space-y-4">
              {formError && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{formError}</div>
              )}
              <TextField
                label="City name *"
                value={name}
                error={nameError}
                onChange={(e) => { setName(e.target.value); setNameError(undefined); }}
              />
              <GroundMapPicker
                latitude={latitude}
                longitude={longitude}
                address=""
                onChange={(v) => { setLatitude(v.latitude); setLongitude(v.longitude); }}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { setEditing(null); setShowEdit(false); }}>Cancel</Button>
                <Button onClick={save}>Save city</Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
  );
}