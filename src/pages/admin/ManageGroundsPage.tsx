import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X, Star } from 'lucide-react';
import { groundsAPI, adminAPI } from '../../services/api';
import { useCities } from '../../hooks/useCities';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { TextField } from '../../components/ui/text-field';
import { Spinner } from '../../components/ui/spinner';
import Modal from '../../components/organisms/Modal';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import GroundMapPicker from '../../components/owner/GroundMapPicker';
import type { Ground, GroundPayload } from '../../types';
import { resolveUploadUrl } from '../../lib/uploads';

interface GroundForm {
  name: string;
  address: string;
  city: string;
  contact: string;
  basePrice: string;
  peakPrice: string;
  sportType: string;
  description: string;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  isActive: boolean;
  latitude: string;
  longitude: string;
  gallery: string[];
}

const defaultForm: GroundForm = {
  name: '',
  address: '',
  city: 'Kathmandu',
  contact: '',
  basePrice: '',
  peakPrice: '',
  sportType: 'futsal',
  description: '',
  operatingHoursStart: '06:00',
  operatingHoursEnd: '22:00',
  isActive: true,
  latitude: '',
  longitude: '',
  gallery: [],
};

const MAX_PHOTOS = 10;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_MB = 5;

type FormErrors = Record<string, string>;

function validateForm(form: GroundForm): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) errors.name = 'Ground name is required.';
  else if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.';
  else if (form.name.trim().length > 100) errors.name = 'Name must be 100 characters or less.';

  if (!form.basePrice) errors.basePrice = 'Base price is required.';
  else {
    const price = Number(form.basePrice);
    if (!Number.isFinite(price) || price <= 0) errors.basePrice = 'Enter a valid positive price.';
  }

  if (form.peakPrice) {
    const peak = Number(form.peakPrice);
    if (!Number.isFinite(peak) || peak <= 0) errors.peakPrice = 'Peak price must be positive.';
  }

  if (form.contact && !/^\+?[0-9\s-]{7,30}$/.test(form.contact)) errors.contact = 'Enter a valid phone number (digits, +, spaces or dashes).';

  if (form.latitude && (Number(form.latitude) < -90 || Number(form.latitude) > 90)) errors.latitude = 'Latitude must be between -90 and 90.';
  if (form.longitude && (Number(form.longitude) < -180 || Number(form.longitude) > 180)) errors.longitude = 'Longitude must be between -180 and 180.';

  if (form.description.length > 1000) errors.description = 'Description must be 1000 characters or less.';

  return errors;
}

function SelectField({ label, error, id, value, onChange, children }: {
  label: string; error?: string; id: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[10px] font-extrabold uppercase text-muted-foreground">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export default function ManageGroundsPage() {
  const queryClient = useQueryClient();
  const { cities } = useCities();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GroundForm>(defaultForm);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Ground | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-grounds'],
    queryFn: async () => {
      const res = await groundsAPI.getAll({ limit: 50 });
      return res.data;
    },
  });

  const grounds = data?.grounds || [];

  const failWith = (err: unknown) => {
    const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    setFormError(message || 'Something went wrong. Please try again.');
  };

  const createMutation = useMutation({
    mutationFn: (data: GroundPayload) => adminAPI.createGround(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-grounds'] });
      queryClient.invalidateQueries({ queryKey: ['grounds'] });
      queryClient.invalidateQueries({ queryKey: ['ground'] });
      setFormError('');
      setModalOpen(false);
    },
    onError: failWith,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GroundPayload }) => adminAPI.updateGround(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-grounds'] });
      queryClient.invalidateQueries({ queryKey: ['grounds'] });
      queryClient.invalidateQueries({ queryKey: ['ground'] });
      setFormError('');
      setModalOpen(false);
    },
    onError: failWith,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAPI.deleteGround(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-grounds'] });
      queryClient.invalidateQueries({ queryKey: ['grounds'] });
      queryClient.invalidateQueries({ queryKey: ['ground'] });
    },
  });

  const handleAdd = () => {
    setEditingId(null);
    setForm(defaultForm);
    setNewFiles([]);
    setPhotoError('');
    setFormError('');
    setUploading(false);
    setModalOpen(true);
  };

  const handleEdit = (g: Ground) => {
    setEditingId(g.id);
    setForm({
      name: g.name,
      address: g.address || '',
      city: g.city,
      contact: g.contact || '',
      basePrice: String(g.basePrice),
      peakPrice: g.peakPrice ? String(g.peakPrice) : '',
      sportType: g.sportType || 'futsal',
      description: g.description || '',
      operatingHoursStart: g.operatingHoursStart || '06:00',
      operatingHoursEnd: g.operatingHoursEnd || '22:00',
      isActive: g.isActive !== false,
      latitude: g.latitude != null ? String(g.latitude) : '',
      longitude: g.longitude != null ? String(g.longitude) : '',
      gallery: g.gallery ?? [],
    });
    setNewFiles([]);
    setPhotoError('');
    setFormError('');
    setUploading(false);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    const ground = grounds.find((g) => g.id === id) ?? null;
    setDeleteTarget(ground);
  };

  const addFiles = (files: File[]) => {
    setPhotoError('');
    const existing = form.gallery.length + newFiles.length;
    const room = MAX_PHOTOS - existing;
    if (room <= 0) {
      setPhotoError(`You have reached the ${MAX_PHOTOS} photo limit. Remove some first.`);
      return;
    }
    const kept: File[] = [];
    const rejected: string[] = [];
    files.slice(0, room).forEach((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        rejected.push(`"${file.name}" is not JPG, PNG or WEBP`);
      } else if (file.size > MAX_FILE_MB * 1024 * 1024) {
        rejected.push(`"${file.name}" is larger than ${MAX_FILE_MB} MB`);
      } else {
        kept.push(file);
      }
    });
    if (rejected.length) setPhotoError(rejected.join('. '));
    else if (files.length > room) setPhotoError(`You can add up to ${MAX_PHOTOS} photos total. ${room} more allowed - extras were skipped.`);
    if (kept.length) setNewFiles((prev) => [...prev, ...kept]);
  };

  const removeSaved = (index: number) => {
    setForm((prev) => ({ ...prev, gallery: prev.gallery.filter((_, i) => i !== index) }));
  };

  const removeNew = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const makeCover = (index: number) => {
    setForm((prev) => {
      if (index === 0) return prev;
      const gallery = [...prev.gallery];
      const [url] = gallery.splice(index, 1);
      return { ...prev, gallery: [url, ...gallery] };
    });
  };

  const handleSave = async () => {
    let gallery = [...form.gallery];
    if (newFiles.length > 0) {
      setUploading(true);
      setPhotoError('');
      try {
        const body = new FormData();
        newFiles.forEach((f) => body.append('photos', f));
        const res = await adminAPI.uploadGroundPhotos(body);
        gallery = [...gallery, ...res.data.urls];
      } catch (err) {
        const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setPhotoError(message || 'Photo upload failed. Please check your files and try again.');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const payload: GroundPayload = {
      name: form.name.trim(),
      address: form.address.trim() || `${form.name.trim()}, ${form.city}`,
      city: form.city,
      contact: form.contact.trim() || undefined,
      basePrice: Number(form.basePrice),
      peakPrice: form.peakPrice ? Number(form.peakPrice) : undefined,
      sportType: form.sportType,
      description: form.description.trim() || undefined,
      operatingStart: form.operatingHoursStart || '06:00',
      operatingEnd: form.operatingHoursEnd || '22:00',
      isActive: form.isActive,
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
      gallery,
      imageUrl: gallery[0] ?? undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const errors = validateForm(form);
  const isFormValid = Object.keys(errors).length === 0;
  const photoCount = form.gallery.length + newFiles.length;
  const saving = createMutation.isPending || updateMutation.isPending;

  return (
          <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase text-primary">Venues</p>
            <h1 className="mt-2 text-2xl font-extrabold text-foreground">Manage grounds</h1>
            <p className="mt-1 text-sm text-muted-foreground">Slots are auto-generated when you create a ground</p>
          </div>
          <Button onClick={handleAdd}>+ Add Ground</Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : grounds.length === 0 ? (
          <div className="rounded-2xl border border-border bg-muted py-14 text-center">
            <p className="text-base font-extrabold text-card-foreground">No grounds yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Create your first ground to start generating bookable slots. Slots are auto-generated per operating hours when you save.
            </p>
            <Button className="mt-5" size="sm" onClick={handleAdd}>+ Add Ground</Button>
          </div>
        ) : (
          <Card padding={false}>
            <div className="space-y-3 p-4 md:hidden">
              {grounds.map((g) => (
                <div key={g.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate font-bold text-card-foreground">{g.name}</p>
                    <span className="shrink-0 font-bold text-primary">Rs {g.basePrice}/hr</span>
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    <p>{g.city} &middot; <span className="capitalize">{g.sportType || 'futsal'}</span></p>
                    <p>{g.operatingHoursStart || '06:00'} - {g.operatingHoursEnd || '22:00'}</p>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(g)}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(g.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">City</th>
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Sport</th>
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Price/hr</th>
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Hours</th>
                    <th className="px-4 py-3 text-right text-[10px] font-extrabold uppercase tracking-normal text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grounds.map((g) => (
                    <tr key={g.id} className="border-b border-border last:border-0 transition-colors hover:bg-accent/50">
                      <td className="px-4 py-3 font-bold text-card-foreground">{g.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{g.city}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{g.sportType || 'futsal'}</td>
                      <td className="px-4 py-3 font-bold text-primary">Rs {g.basePrice}</td>
                      <td className="px-4 py-3 text-muted-foreground">{g.operatingHoursStart || '06:00'} - {g.operatingHoursEnd || '22:00'}</td>
                      <td className="space-x-2 px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(g)}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(g.id)}>Delete</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Modal open={modalOpen} onClose={() => !saving && !uploading && setModalOpen(false)} title={editingId ? 'Edit Ground' : 'Add Ground'}>
          <div className="space-y-5">
            {formError && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{formError}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Ground Name *"
                value={form.name}
                error={errors.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Thamel Futsal Arena"
              />
              <SelectField label="City *" id="ground-city" value={form.city} onChange={(v) => setForm({ ...form, city: v })}>
                {cities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </SelectField>
              <SelectField label="Sport *" id="ground-sport" value={form.sportType} onChange={(v) => setForm({ ...form, sportType: v })}>
                <option value="futsal">Futsal</option>
                <option value="cricket">Cricket</option>
                <option value="badminton">Badminton</option>
                <option value="tennis">Tennis</option>
                <option value="football">Football</option>
              </SelectField>
              <TextField
                label="Address"
                value={form.address}
                error={errors.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Auto-filled from name + city"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Photos</span>
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground">{photoCount} / {MAX_PHOTOS}</span>
              </div>
              <p className="mb-3 text-xs font-semibold text-muted-foreground">The first photo is the cover shown on cards. Add up to {MAX_PHOTOS} photos, JPG / PNG / WEBP, {MAX_FILE_MB} MB each.</p>
              {(photoCount > 0 || uploading) && (
                <div className="relative">
                  <div className="grid grid-cols-3 gap-2">
                    {form.gallery.map((url, i) => (
                      <div key={`saved-${i}`} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                        <img src={resolveUploadUrl(url) || ''} alt={`Ground photo ${i + 1}`} className="h-full w-full object-cover" />
                        {i === 0 && (
                          <span className="absolute bottom-1 left-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary-foreground">Cover</span>
                        )}
                        <div className="absolute right-1 top-1 flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => makeCover(i)}
                            aria-label={i === 0 ? 'Cover photo' : 'Set as cover'}
                            className={`grid h-6 w-6 place-items-center rounded-full transition-colors ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-background/90 text-muted-foreground hover:text-primary'}`}
                          >
                            <Star className={`h-3.5 w-3.5 ${i === 0 ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSaved(i)}
                            aria-label="Remove photo"
                            className="grid h-6 w-6 place-items-center rounded-full bg-background/90 text-destructive transition-colors hover:bg-background"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {newFiles.map((f, i) => (
                      <div key={`new-${i}`} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                        <img src={URL.createObjectURL(f)} alt={`New photo ${i + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeNew(i)}
                          aria-label="Remove photo"
                          className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/90 text-destructive transition-colors hover:bg-background"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {uploading && (
                    <div className="absolute inset-0 grid place-items-center rounded-xl bg-background/70 backdrop-blur-[1px]">
                      <span className="flex items-center gap-2 text-sm font-bold text-card-foreground"><Spinner size="sm" /> Uploading photos...</span>
                    </div>
                  )}
                </div>
              )}
              <label className="mt-3 flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-5 text-center transition-colors hover:border-primary/50 hover:bg-accent">
                <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
                <span className="text-sm font-bold text-card-foreground">Upload photos</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
                />
              </label>
              {photoError && <p className="mt-2 text-xs font-semibold text-destructive">{photoError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Price per Hour (Rs.) *"
                type="number"
                min={1}
                value={form.basePrice}
                error={errors.basePrice}
                onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                placeholder="e.g. 1500"
              />
              <TextField
                label="Peak Price (Rs.)"
                type="number"
                min={1}
                value={form.peakPrice}
                error={errors.peakPrice}
                onChange={(e) => setForm({ ...form, peakPrice: e.target.value })}
                placeholder="Optional - defaults to 1.3x base"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Contact"
                value={form.contact}
                error={errors.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder="+977-9801234567"
              />
              <SelectField label="Status" id="ground-status" value={form.isActive ? 'active' : 'hidden'} onChange={(v) => setForm({ ...form, isActive: v === 'active' })}>
                <option value="active">Active (visible & bookable)</option>
                <option value="hidden">Hidden (not shown)</option>
              </SelectField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Opens at"
                type="time"
                value={form.operatingHoursStart}
                error={errors.operatingHoursStart}
                onChange={(e) => setForm({ ...form, operatingHoursStart: e.target.value })}
              />
              <TextField
                label="Closes at"
                type="time"
                value={form.operatingHoursEnd}
                error={errors.operatingHoursEnd}
                onChange={(e) => setForm({ ...form, operatingHoursEnd: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="ground-description" className="text-[10px] font-extrabold uppercase text-muted-foreground">Description</label>
              <textarea
                id="ground-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of the ground"
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Location on map</span>
                <p className="text-xs font-semibold text-muted-foreground">
                  Search an address or drop the pin. Players see this location on Google Maps when booking.
                </p>
              </div>
              <GroundMapPicker
                latitude={form.latitude ? Number(form.latitude) : null}
                longitude={form.longitude ? Number(form.longitude) : null}
                address={form.address}
                onChange={(v) => setForm({
                  ...form,
                  latitude: v.latitude != null ? String(v.latitude) : '',
                  longitude: v.longitude != null ? String(v.longitude) : '',
                  address: v.address && v.address.trim() ? v.address.trim() : form.address,
                })}
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving || uploading}>Cancel</Button>
              <Button onClick={handleSave} disabled={!isFormValid || saving || uploading}>
                {uploading ? 'Uploading photos...' : saving ? 'Saving...' : editingId ? 'Update Ground' : 'Create Ground'}
              </Button>
            </div>
          </div>
        </Modal>

        <ConfirmDialog
          open={!!deleteTarget}
          title="Delete ground"
          description={deleteTarget ? `Delete "${deleteTarget.name}" and all its slots? This cannot be undone.` : undefined}
          confirmLabel="Delete ground"
          variant="destructive"
          loading={deleteMutation.isPending}
          onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
  );
}