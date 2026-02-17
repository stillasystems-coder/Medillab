import { storage } from "./storage";
import { userRoles, bookingStatuses } from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  // 1. Create Users
  const admin = await storage.getUserByUsername("admin");
  if (!admin) {
    await storage.createUser({
      username: "admin",
      password: "password123",
      role: "admin",
      name: "Admin User"
    });
    console.log("Created admin user");
  }

  const labTech = await storage.getUserByUsername("labtech");
  if (!labTech) {
    await storage.createUser({
      username: "labtech",
      password: "password123",
      role: "lab_tech",
      name: "Lab Tech User"
    });
    console.log("Created lab tech user");
  }

  const frontDesk = await storage.getUserByUsername("frontdesk");
  if (!frontDesk) {
    await storage.createUser({
      username: "frontdesk",
      password: "password123",
      role: "front_desk",
      name: "Front Desk User"
    });
    console.log("Created front desk user");
  }

  // 2. Create Tests
  const existingTests = await storage.getTests();
  if (existingTests.length === 0) {
    const tests = [
      { code: "CBC", name: "Complete Blood Count", price: 500, description: "Measures red blood cells, white blood cells, and platelets.", turnaroundTime: 24 },
      { code: "LIPID", name: "Lipid Panel", price: 800, description: "Measures cholesterol and triglycerides.", turnaroundTime: 24 },
      { code: "TSH", name: "Thyroid Stimulating Hormone", price: 600, description: "Screening test for thyroid function.", turnaroundTime: 24 },
      { code: "A1C", name: "Hemoglobin A1c", price: 700, description: "Average blood sugar level over the past 3 months.", turnaroundTime: 24 },
      { code: "CMP", name: "Comprehensive Metabolic Panel", price: 900, description: "Measures sugar (glucose) level, electrolyte and fluid balance, kidney function, and liver function.", turnaroundTime: 24 },
    ];

    for (const test of tests) {
      await storage.createTest(test);
    }
    console.log("Created default tests");
  }

  // 3. Create Patients
  const patients = await storage.getPatients();
  if (patients.length === 0) {
    await storage.createPatient({
      name: "John Doe",
      phone: "+1234567890",
      age: 30,
      gender: "Male",
      address: "123 Main St, Springfield"
    });
    await storage.createPatient({
      name: "Jane Smith",
      phone: "+1987654321",
      age: 28,
      gender: "Female",
      address: "456 Elm St, Shelbyville"
    });
    console.log("Created default patients");
  }

  // 4. Create Bookings (Optional, but good for demo)
  const bookings = await storage.getBookings();
  if (bookings.length === 0) {
    const patient = (await storage.getPatients())[0];
    const testList = await storage.getTests();
    const testIds = testList.slice(0, 2).map(t => t.id);

    if (patient && testIds.length > 0) {
      await storage.createBooking({
        patientId: patient.id,
        branchId: "MAIN",
        totalAmount: 1300,
        bookingRef: `BK-${Date.now()}`,
        status: "BOOKED"
      }, testIds);
      console.log("Created demo booking");
    }
  }

  console.log("Seeding completed.");
}

seed().catch(console.error);
