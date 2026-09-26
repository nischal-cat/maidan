const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(15),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['player', 'owner']).optional().default('player'),
  businessName: z.string().min(2).max(150).optional(),
});

// Ground Owner application: same as register, but collects business details.
// When role === 'owner' the seller fields become required (enforced below).
//
// Seller registration is multipart (a KYC document is attached), so
// businessType arrives as a JSON-encoded string rather than a real array.
// Preprocess it back into an array so the schema and the controller - which
// calls JSON.stringify() before persisting - both see a genuine array.
const businessTypeArray = z
  .preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed === '') return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [trimmed];
    } catch {
      // A single unencoded value ('Futsal') should still register.
      return [trimmed];
    }
  }, z.array(z.string().min(1).max(30)).max(10).optional());

const sellerApplySchema = registerSchema
  .extend({
    businessType: businessTypeArray,
    businessCity: z.string().min(2).max(50).optional(),
    businessAddress: z.string().min(5).max(300).optional(),
    businessContact: z.string().min(10).max(15).optional(),
    registrationNumber: z.string().min(3).max(50).optional(),
    businessDescription: z.string().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role !== 'owner') return;
    const required = [
      ['businessName', 'Business name is required for sellers'],
      ['businessType', 'Select at least one business type'],
      ['businessCity', 'Business city is required'],
      ['businessAddress', 'Business address is required'],
      ['businessContact', 'Business contact phone is required'],
    ];
    for (const [key, message] of required) {
      const value = data[key];
      const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
      if (empty) ctx.addIssue({ code: 'custom', message, path: [key] });
    }
  });

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Accept either the registered email or the registered phone. At least one is
// required; the controller resolves whichever was supplied.
const forgotSchema = z
  .object({
    email: z.string().email('Invalid email address').optional(),
    phone: z.string().min(10, 'Enter a valid phone number').max(15).optional(),
  })
  .refine((data) => Boolean(data.email || data.phone), {
    message: 'Enter your registered email or phone number',
  });

const resetPasswordSchema = z.object({
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(15),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

const STAFF_PERMISSIONS = z.enum(['grounds', 'slots', 'bookings', 'reports', 'sellers', 'users']);

const staffCreateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(15).optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  permissions: z.array(STAFF_PERMISSIONS).optional().default([]),
});

const staffUpdateSchema = z
  .object({
    permissions: z.array(STAFF_PERMISSIONS).optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  })
  .refine((d) => d.permissions !== undefined || d.password !== undefined, {
    message: 'Nothing to update',
    path: ['permissions'],
  });

const bookingSchema = z.object({
  groundId: z.string().uuid('Ground ID must be a valid UUID').optional(),
  slotId: z.string().uuid('Slot ID must be a valid UUID').optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').optional(),
  playersCount: z.number().int().min(1).max(50).optional(),
  numberOfPlayers: z.number().int().min(1).max(50).optional(),  // alias accepted
  specialRequests: z.string().max(500).optional(),
  paymentMethod: z.enum(['online', 'counter', 'cash']).optional().default('online'),
}).refine((data) => data.slotId || (data.groundId && data.bookingDate && data.startTime), {
  message: 'Either slotId or groundId + bookingDate + startTime is required',
});

// Owner/admin booking on behalf of a customer (phone call / walk-in)
const walkInBookingSchema = z.object({
  groundId: z.string().uuid('Ground ID must be a valid UUID').optional(),
  slotId: z.string().uuid('Slot ID must be a valid UUID').optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').optional(),
  playersCount: z.number().int().min(1).max(50).optional(),
  numberOfPlayers: z.number().int().min(1).max(50).optional(),  // alias accepted
  specialRequests: z.string().max(500).optional(),
  customerName: z.string().trim().min(2, 'Customer name is required').max(100),
  customerPhone: z.string().trim().regex(/^\+?\d{10,15}$/, 'Customer phone must be 10-15 digits'),
  paymentMethod: z.enum(['cash', 'unpaid']).optional().default('unpaid'),
}).refine((data) => data.slotId || (data.groundId && data.bookingDate && data.startTime), {
  message: 'Either slotId or groundId + bookingDate + startTime is required',
});

const batchBookingSchema = z.object({
  slotIds: z.array(z.string().uuid('Slot ID must be a valid UUID')).min(2, 'Select at least 2 slots').max(6, 'Maximum 6 slots per booking'),
  playersCount: z.number().int().min(1).max(50).optional(),
  numberOfPlayers: z.number().int().min(1).max(50).optional(),  // alias accepted
  specialRequests: z.string().max(500).optional(),
});

const groundSchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().min(5).max(200).optional(),
  city: z.string().min(2).max(50).optional().default('Kathmandu'),
  contact: z.string().max(30).optional(),
  basePrice: z.number().positive('Price must be positive'),
  peakPrice: z.number().positive().optional(),
  sportType: z.enum(['futsal', 'cricket', 'badminton', 'tennis', 'football']).optional().default('futsal'),
  operatingStart: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().default('06:00'),
  operatingEnd: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().default('22:00'),
  description: z.string().max(1000).optional(),
  imageUrl: z.union([z.string().url(), z.string().startsWith('/uploads/')]).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isActive: z.boolean().optional(),
  gallery: z.array(z.string().min(1)).max(12).optional(),
});

const firebaseGoogleSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});

const addPhoneSchema = z.object({
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(15),
});

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.errors.map((e) => e.message).join(', ');
      return res.status(400).json({ message });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate, registerSchema, sellerApplySchema, loginSchema, forgotSchema, resetPasswordSchema, staffCreateSchema, staffUpdateSchema, bookingSchema, walkInBookingSchema, batchBookingSchema, groundSchema, firebaseGoogleSchema, addPhoneSchema };
