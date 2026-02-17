import { db } from "./db";
import { 
  users, patients, tests, bookings, bookingTests, results,
  type User, type InsertUser, type Patient, type InsertPatient,
  type Test, type InsertTest, type Booking, type InsertBooking,
  type Result, type InsertResult
} from "@shared/schema";
import { eq, like, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Patients
  getPatient(id: number): Promise<Patient | undefined>;
  getPatients(search?: string): Promise<Patient[]>;
  createPatient(patient: InsertPatient): Promise<Patient>;

  // Tests
  getTests(): Promise<Test[]>;
  getTest(id: number): Promise<Test | undefined>;
  getTestsByIds(ids: number[]): Promise<Test[]>;
  createTest(test: InsertTest): Promise<Test>;

  // Bookings
  createBooking(booking: InsertBooking, testIds: number[]): Promise<Booking>;
  getBooking(id: number): Promise<Booking | undefined>;
  getBookings(status?: string, search?: string): Promise<(Booking & { patient: Patient, testCount: number })[]>;
  updateBookingStatus(id: number, status: string): Promise<Booking | undefined>;
  getBookingTests(bookingId: number): Promise<(typeof bookingTests.$inferSelect & { test: Test })[]>;

  // Results
  createResult(result: InsertResult): Promise<Result>;
  getResultByBookingId(bookingId: number): Promise<Result | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getPatient(id: number): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    return patient;
  }

  async getPatients(search?: string): Promise<Patient[]> {
    if (search) {
      return db.select().from(patients).where(like(patients.name, `%${search}%`));
    }
    return db.select().from(patients);
  }

  async createPatient(patient: InsertPatient): Promise<Patient> {
    const [newPatient] = await db.insert(patients).values(patient).returning();
    return newPatient;
  }

  async getTests(): Promise<Test[]> {
    return db.select().from(tests);
  }

  async getTest(id: number): Promise<Test | undefined> {
    const [test] = await db.select().from(tests).where(eq(tests.id, id));
    return test;
  }

  async getTestsByIds(ids: number[]): Promise<Test[]> {
    if (ids.length === 0) return [];
    return db.select().from(tests).where(sql`${tests.id} IN ${ids}`);
  }

  async createTest(test: InsertTest): Promise<Test> {
    const [newTest] = await db.insert(tests).values(test).returning();
    return newTest;
  }

  async createBooking(booking: InsertBooking, testIds: number[]): Promise<Booking> {
    return await db.transaction(async (tx) => {
      const [newBooking] = await tx.insert(bookings).values(booking).returning();
      
      const selectedTests = await tx.select().from(tests).where(sql`${tests.id} IN ${testIds}`);
      
      if (selectedTests.length > 0) {
        await tx.insert(bookingTests).values(
          selectedTests.map(test => ({
            bookingId: newBooking.id,
            testId: test.id,
            priceAtBooking: test.price,
          }))
        );
      }
      
      return newBooking;
    });
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async getBookings(status?: string, search?: string): Promise<(Booking & { patient: Patient, testCount: number })[]> {
    const query = db.select({
      booking: bookings,
      patient: patients,
      testCount: sql<number>`count(${bookingTests.id})::int`,
    })
    .from(bookings)
    .innerJoin(patients, eq(bookings.patientId, patients.id))
    .leftJoin(bookingTests, eq(bookings.id, bookingTests.bookingId))
    .groupBy(bookings.id, patients.id)
    .orderBy(desc(bookings.createdAt));

    if (status) {
      query.where(eq(bookings.status, status));
    }
    
    // Simple search implementation
    if (search) {
      // Logic for search would go here, simplified for now
    }

    const results = await query;
    return results.map(r => ({ ...r.booking, patient: r.patient, testCount: r.testCount }));
  }

  async updateBookingStatus(id: number, status: string): Promise<Booking | undefined> {
    const [updated] = await db.update(bookings)
      .set({ status, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return updated;
  }

  async getBookingTests(bookingId: number): Promise<(typeof bookingTests.$inferSelect & { test: Test })[]> {
    const results = await db.select({
      bookingTest: bookingTests,
      test: tests,
    })
    .from(bookingTests)
    .innerJoin(tests, eq(bookingTests.testId, tests.id))
    .where(eq(bookingTests.bookingId, bookingId));

    return results.map(r => ({ ...r.bookingTest, test: r.test }));
  }

  async createResult(result: InsertResult): Promise<Result> {
    const [newResult] = await db.insert(results).values(result).returning();
    return newResult;
  }

  async getResultByBookingId(bookingId: number): Promise<Result | undefined> {
    const [result] = await db.select().from(results).where(eq(results.bookingId, bookingId));
    return result;
  }
}

export const storage = new DatabaseStorage();
