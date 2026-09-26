import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X, Star, Trash2 } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { useCities } from '../../hooks/useCities';
import { Button } from '../ui/button';
import { TextField } from '../ui/text-field';
import { Spinner } from '../ui/spinner';
import { Card } from '../ui/card';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { useToast } from '../ui/toast';
import { resolveUploadUrl } from '../../lib/uploads';
import GroundMapPicker from './GroundMapPicker';
import type { Ground, GroundPayload } from '../../types';

export interface GroundForm {
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

function toForm(ground: Ground): GroundForm {
  return {
    name: ground.name,
    address: ground.address || '',
    city: ground.city,
    contact: ground.contact || '',
    basePrice: String(ground.basePrice),
    peakPrice: ground.peakPrice ? String(ground.peakPrice) : '',
    sportType: ground.sportType || 'futsal',
    description: ground.description || '',
    operatingHoursStart: ground.operatingHoursStart || '06:00',
    operatingHoursEnd: ground.operatingHoursEnd || '22:00',
    isActive: ground.isActive !== false,
    latitude: ground.latitude != null ? String(ground.latitude) : '',
    longitude: ground.longitude != null ? String(ground.longitude) : '',
    gallery: ground.gallery ?? [],
  };
}

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

function LabeledSelect({
  label,
  id,
  value,
  onChange,
  children,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[10px] font-extrabold uppercase text-muted-foreground">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </select>
    </div>
  );
}

export default function GroundEditor({
  initial,
  submitLabel,
  onSaved,
  onDeleted,
}: {
  initial?: Ground | null;
  submitLabel: string;
  onSaved: (ground: Ground) => void;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { cities } = useCities();
  const [form, setForm] = useState<GroundForm>(() => (initial ? toForm(initial) : defaultForm));
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const editingId = initial?.id;
  const failWith = (err: unknown) => {
    const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    setFormError(message || 'Something went wrong. Please try again.');
    toast({ variant: 'error', title: 'Could not save ground', description: message || 'Please try again.' });
  };

  const invalidateGrounds = () => {
    queryClient.invalidateQueries({ queryKey: ['owner-grounds'] });
    queryClient.invalidateQueries({ queryKey: ['grounds'] });
    queryClient.invalidateQueries({ queryKey: ['ground'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: GroundPayload) => adminAPI.createGround(data),
    onSuccess: (res) => {
      invalidateGrounds();
      setFormError('');
      toast({
        title: 'Ground created',
        description: res.data.slotsGenerated > 0 ? `${res.data.message} ${res.data.slotsGenerated} slots were generated.` : res.data.message,
      });
      onSaved(res.data.ground);
    },
    onError: failWith,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GroundPayload }) => adminAPI.updateGround(id, data),
    onSuccess: (res) => {
      invalidateGrounds();
      setFormError('');
      toast({ title: 'Ground updated', description: res.data.message });
      onSaved(res.data.ground);
    },
    onError: failWith,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAPI.deleteGround(id),
    onSuccess: (res) => {
      invalidateGrounds();
      setConfirmDelete(false);
      toast({ title: 'Ground deleted', description: res.data.message });
      onDeleted?.();
    },
    onError: failWith,
  });

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
      if (!ACCEPTED_TYPES.includes(file.type)) rejected.push(`"${file.name}" is not JPG, PNG or WEBP`);
      else if (file.size > MAX_FILE_MB * 1024 * 1024) rejected.push(`"${file.name}" is larger than ${MAX_FILE_MB} MB`);
      else kept.push(file);
    });
    if (rejected.length) setPhotoError(rejected.join('. '));
    else if (files.length > room) setPhotoError(`You can add up to ${MAX_PHOTOS} photos total. ${room} more allowed - extras were skipped.`);
    if (kept.length) setNewFiles((prev) => [...prev, ...kept]);
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

    if (editingId) updateMutation.mutate({ id: editingId, data: payload });
    else createMutation.mutate(payload);
  };

  const errors = validateForm(form);
  const isFormValid = Object.keys(errors).length === 0;
  const photoCount = form.gallery.length + newFiles.length;
  const saving = createMutation.isPending || updateMutation.isPending;
  const busy = saving || uploading;

  return (
    <>
      <div className="space-y-5">
        {formError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{formError}</div>
        )}

        <Card className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Ground Name *"
              value={form.name}
              error={errors.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Thamel Futsal Arena"
            />
            <LabeledSelect label="City *" id="ground-city" value={form.city} onChange={(v) => setForm({ ...form, city: v })}>
              {cities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </LabeledSelect>
            <LabeledSelect label="Sport *" id="ground-sport" value={form.sportType} onChange={(v) => setForm({ ...form, sportType: v })}>
              <option value="futsal">Futsal</option>
              <option value="cricket">Cricket</option>
              <option value="badminton">Badminton</option>
              <option value="tennis">Tennis</option>
              <option value="football">Football</option>
            </LabeledSelect>
            <TextField
              label="Address"
              value={form.address}
              error={errors.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Auto-filled from name + city"
            />
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
            <LabeledSelect label="Status" id="ground-status" value={form.isActive ? 'active' : 'hidden'} onChange={(v) => setForm({ ...form, isActive: v === 'active' })}>
              <option value="active">Active (visible & bookable)</option>
              <option value="hidden">Hidden (not shown)</option>
            </LabeledSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Opens at"
              type="time"
              value={form.operatingHoursStart}
              onChange={(e) => setForm({ ...form, operatingHoursStart: e.target.value })}
            />
            <TextField
              label="Closes at"
              type="time"
              value={form.operatingHoursEnd}
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
              className="min-h-12 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus-visible:ring-2 focus-visible:ring-ring"
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
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Photos</span>
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">{photoCount} / {MAX_PHOTOS}</span>
          </div>
          <p className="text-xs font-semibold text-muted-foreground">The first photo is the cover shown on cards. Add up to {MAX_PHOTOS} photos, JPG / PNG / WEBP, {MAX_FILE_MB} MB each.</p>
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
                        onClick={() => setForm((p) => ({ ...p, gallery: p.gallery.filter((_, idx) => idx !== i) }))}
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
                      onClick={() => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
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
          <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-5 text-center transition-colors hover:border-primary/50 hover:bg-accent">
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
          {photoError && <p className="text-xs font-semibold text-destructive">{photoError}</p>}
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          {editingId && (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={busy}>
              <Trash2 className="h-4 w-4" aria-hidden /> Delete
            </Button>
          )}
          <Button onClick={handleSave} disabled={!isFormValid || busy} className="sm:flex-1">
            {uploading ? 'Uploading photos…' : saving ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this ground?"
        description="This permanently removes the ground and all of its slots. Bookings are left untouched."
        confirmLabel="Delete ground"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => editingId && deleteMutation.mutate(editingId)}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}