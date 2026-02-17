import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === ENUMS ===
export const userRoles = ["admin", "lab_tech", "front_desk", "manager"] as const;
export const bookingStatuses = ["BOOKED", "ARRIVED", "SAMPLE_COLLECTED", "IN_PROCESS", "COMPLETED", "DELIVERED"] as const;

// === TABLES ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: userRoles }).notNull().default("front_desk"),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  age: integer("age"),
  gender: text("gender"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tests = pgTable("tests", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  price: integer("price").notNull(), // in cents
  description: text("description"),
  turnaroundTime: integer("turnaround_time"), // in hours
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  bookingRef: text("booking_ref").notNull().unique(), // Human readable ID
  patientId: integer("patient_id").notNull().references(() => patients.id),
  status: text("status", { enum: bookingStatuses }).notNull().default("BOOKED"),
  branchId: text("branch_id"), // Ideally a separate table, but simplified for now
  totalAmount: integer("total_amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bookingTests = pgTable("booking_tests", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id),
  testId: integer("test_id").notNull().references(() => tests.id),
  priceAtBooking: integer("price_at_booking").notNull(),
});

export const results = pgTable("results", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id),
  fileUrl: text("file_url").notNull(), // Encrypted file path/url
  encryptedKey: text("encrypted_key"), // If using envelope encryption
  accessToken: text("access_token"), // Time-limited token
  tokenExpiresAt: timestamp("token_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  patient: one(patients, {
    fields: [bookings.patientId],
    references: [patients.id],
  }),
  bookingTests: many(bookingTests),
  result: one(results, {
    fields: [bookings.id],
    references: [results.bookingId],
  }),
}));

export const bookingTestsRelations = relations(bookingTests, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingTests.bookingId],
    references: [bookings.id],
  }),
  test: one(tests, {
    fields: [bookingTests.testId],
    references: [tests.id],
  }),
}));

export const patientsRelations = relations(patients, ({ many }) => ({
  bookings: many(bookings),
}));

// === ZOD SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertPatientSchema = createInsertSchema(patients).omit({ id: true, createdAt: true });
export const insertTestSchema = createInsertSchema(tests).omit({ id: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, bookingRef: true, createdAt: true, updatedAt: true });
export const insertBookingTestSchema = createInsertSchema(bookingTests).omit({ id: true });
export const insertResultSchema = createInsertSchema(results).omit({ id: true, createdAt: true });

// === TYPES ===

export type User = typeof users.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Test = typeof tests.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Result = typeof results.$inferSelect;

export type CreateBookingRequest = {
  patientId?: number; // Existing patient
  patient?: z.infer<typeof insertPatientSchema>; // New patient
  testIds: number[];
  branchId?: string;
};

export type UpdateStatusRequest = {
  status: typeof bookingStatuses[number];
};

export type AnalyticsOverview = {
  totalBookings: number;
  avgTurnaroundTime: number; // hours
  whatsappDeliveryRate: number; // percentage
  revenue: number;
};
