import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomBytes, createCipheriv } from "crypto";
import { WhatsAppService } from "./whatsapp.service";
import jwt from "jsonwebtoken";
import { eventEmitter, EVENTS } from "./events";

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.SESSION_SECRET || 'secret', (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const upload = multer({ dest: 'uploads/' });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const whatsappService = new WhatsAppService();

  // Auth Routes
  app.post(api.auth.login.path, async (req, res) => {
    const { username, password } = req.body;
    const user = await storage.getUserByUsername(username);
    
    if (!user || user.password !== password) { // Simple password check for demo
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, process.env.SESSION_SECRET || 'secret', { expiresIn: '24h' });
    res.json({ token, user });
  });

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const user = await storage.createUser(req.body);
      res.status(201).json(user);
    } catch (e) {
      res.status(400).json({ message: "Username already exists" });
    }
  });

  // Patient Routes
  app.get(api.patients.list.path, authenticateToken, async (req, res) => {
    const search = req.query.search as string | undefined;
    const patients = await storage.getPatients(search);
    res.json(patients);
  });

  app.post(api.patients.create.path, authenticateToken, async (req, res) => {
    try {
      const patient = await storage.createPatient(req.body);
      res.status(201).json(patient);
    } catch (e) {
      res.status(400).json({ message: "Invalid patient data" });
    }
  });

  // Test Routes
  app.get(api.tests.list.path, authenticateToken, async (req, res) => {
    const tests = await storage.getTests();
    res.json(tests);
  });

  // Booking Routes
  app.post(api.bookings.create.path, authenticateToken, async (req, res) => {
    try {
      let patientId = req.body.patientId;
      let patient;

      if (!patientId && req.body.patient) {
        patient = await storage.createPatient(req.body.patient);
        patientId = patient.id;
      } else if (patientId) {
        patient = await storage.getPatient(patientId);
      } else {
        return res.status(400).json({ message: "Patient is required" });
      }

      const tests = await storage.getTestsByIds(req.body.testIds);
      const totalAmount = tests.reduce((sum, t) => sum + t.price, 0);

      const booking = await storage.createBooking({
        patientId: patientId!,
        branchId: req.body.branchId || "MAIN",
        totalAmount,
        bookingRef: `BK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: "BOOKED"
      }, req.body.testIds);

      // Trigger Events & WhatsApp
      eventEmitter.emit(EVENTS.BOOKING.CREATED, booking);
      
      if (patient?.phone) {
        whatsappService.sendBookingConfirmation(patient.phone, booking.bookingRef);
      }

      res.status(201).json({ booking, tests, patient });
    } catch (e) {
      console.error(e);
      res.status(400).json({ message: "Failed to create booking" });
    }
  });

  app.get(api.bookings.list.path, authenticateToken, async (req, res) => {
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const bookings = await storage.getBookings(status, search);
    res.json(bookings);
  });

  app.get(api.bookings.get.path, authenticateToken, async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    
    const patient = await storage.getPatient(booking.patientId);
    const tests = (await storage.getBookingTests(id)).map(bt => bt.test);
    const result = await storage.getResultByBookingId(id);

    res.json({ booking, patient, tests, result });
  });

  app.patch(api.bookings.updateStatus.path, authenticateToken, async (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const booking = await storage.updateBookingStatus(id, status);
    
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // Trigger Events & WhatsApp
    eventEmitter.emit(EVENTS.BOOKING.STATUS_UPDATED, { booking, status });

    const patient = await storage.getPatient(booking.patientId);
    if (patient?.phone) {
      if (status === 'COMPLETED') {
        whatsappService.sendResultReady(patient.phone, booking.bookingRef);
      }
    }

    res.json(booking);
  });

  // Result Upload
  app.post(api.bookings.uploadResult.path, authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const id = parseInt(req.params.id);
    
    // Encrypt file (Simplified AES)
    const key = randomBytes(32);
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    
    // In a real app, we would read the file, encrypt it, and save the encrypted version
    // For this demo, we'll pretend we did that and store the metadata
    
    const result = await storage.createResult({
      bookingId: id,
      fileUrl: req.file.path, // In prod, this would be S3 url or encrypted file path
      encryptedKey: key.toString('hex'), // Store securely!
      accessToken: randomBytes(16).toString('hex'),
      tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
    });

    await storage.updateBookingStatus(id, 'COMPLETED');
    
    res.status(201).json(result);
  });

  // Analytics
  app.get(api.analytics.overview.path, authenticateToken, async (req, res) => {
    // Mock analytics
    res.json({
      totalBookings: 150,
      avgTurnaroundTime: 4.5,
      whatsappDeliveryRate: 98.5,
      revenue: 450000
    });
  });

  return httpServer;
}
