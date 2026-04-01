/**
 * Seed script: Creates 1 admin, 5 mentors, 10 users with tags & descriptions.
 * Run: node src/scripts/seed.js
 * All passwords: password123
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

const PASS = "password123";

const mentors = [
  {
    name: "Arjun Mehta",
    email: "mentor1@mentorque.com",
    tags: ["tech", "big-tech", "senior-developer", "system-design"],
    description:
      "Senior Staff Engineer at Google with 12+ years experience in distributed systems. Expert in system design interviews and resume optimization for FAANG companies. Has helped 100+ candidates land big-tech offers.",
  },
  {
    name: "Sarah Collins",
    email: "mentor2@mentorque.com",
    tags: ["non-tech", "good-communication", "public-company", "career-coaching"],
    description:
      "Former VP of Talent at a Fortune 500 company. Exceptional communicator and career strategist. Specializes in job market navigation, salary negotiation, and career pivots. Known for clear, empathetic guidance.",
  },
  {
    name: "Ravi Krishnan",
    email: "mentor3@mentorque.com",
    tags: ["tech", "india", "backend", "same-domain", "mock-interviews"],
    description:
      "Principal Engineer at Flipkart. Deep expertise in backend engineering, microservices, and distributed databases. Conducts domain-specific mock interviews with detailed feedback. Based in Bangalore.",
  },
  {
    name: "Emily O'Brien",
    email: "mentor4@mentorque.com",
    tags: ["tech", "ireland", "big-company", "senior-developer", "frontend"],
    description:
      "Engineering Manager at Stripe Dublin. 10 years in frontend and full-stack development. Expert in React, TypeScript, and modern web architecture. Great at mentoring junior-to-mid level developers.",
  },
  {
    name: "Priya Sharma",
    email: "mentor5@mentorque.com",
    tags: ["tech", "good-communication", "india", "data-science", "career-coaching"],
    description:
      "Lead Data Scientist at Razorpay. Strong communicator who bridges technical and business domains. Mentors on data science career paths, interview strategies, and communication skills for tech professionals.",
  },
];

const users = [
  {
    name: "Alex Thompson",
    email: "user1@mentorque.com",
    tags: ["tech", "frontend", "good-communication"],
    description: "2 years experience as a frontend developer. Looking to break into FAANG companies. Needs resume help and interview prep for React-heavy roles.",
  },
  {
    name: "Neha Gupta",
    email: "user2@mentorque.com",
    tags: ["tech", "backend", "india", "asks-lot-of-questions"],
    description: "Backend developer from Pune with 3 years experience in Node.js and Python. Preparing for system design interviews at top Indian startups.",
  },
  {
    name: "James Wilson",
    email: "user3@mentorque.com",
    tags: ["non-tech", "good-communication", "career-switch"],
    description: "Marketing professional looking to transition into product management. Needs guidance on job market and communication strategy for tech interviews.",
  },
  {
    name: "Ananya Iyer",
    email: "user4@mentorque.com",
    tags: ["tech", "data-science", "india"],
    description: "Fresh data science graduate from IIT Madras. Looking for mock interviews and career guidance in the data science field.",
  },
  {
    name: "Michael Chen",
    email: "user5@mentorque.com",
    tags: ["tech", "senior-developer", "system-design"],
    description: "Senior developer at a mid-size startup. Preparing for Staff Engineer interviews at big tech companies. Needs system design and resume review.",
  },
  {
    name: "Fatima Al-Hassan",
    email: "user6@mentorque.com",
    tags: ["tech", "frontend", "good-communication", "career-switch"],
    description: "Self-taught frontend developer transitioning from teaching. Needs job market guidance and resume revamp for first tech role.",
  },
  {
    name: "Vikram Singh",
    email: "user7@mentorque.com",
    tags: ["tech", "backend", "india", "asks-lot-of-questions"],
    description: "Java developer at TCS with 5 years experience. Wants to move to a product company. Needs mock interviews focused on DSA and system design.",
  },
  {
    name: "Lisa Park",
    email: "user8@mentorque.com",
    tags: ["non-tech", "career-coaching"],
    description: "HR professional exploring career options. Looking for general job market guidance and career coaching from experienced mentors.",
  },
  {
    name: "Rohit Desai",
    email: "user9@mentorque.com",
    tags: ["tech", "frontend", "india", "big-tech"],
    description: "React developer aiming for positions at Google and Microsoft. Needs comprehensive interview preparation including resume revamp and mock interviews.",
  },
  {
    name: "Sophie Laurent",
    email: "user10@mentorque.com",
    tags: ["tech", "data-science", "good-communication", "ireland"],
    description: "Data analyst in Dublin looking to transition to data science roles. Needs technical mock interviews and guidance on the Irish tech job market.",
  },
];

async function main() {
  console.log("🌱 Seeding database...\n");

  // Clear existing data
  await prisma.meeting.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.user.deleteMany();
  console.log("  Cleared existing data.");

  const hash = await bcrypt.hash(PASS, 12);

  // Create Admin
  const admin = await prisma.user.create({
    data: {
      id: uuidv4(),
      name: "Admin User",
      email: "admin@mentorque.com",
      password: hash,
      role: "ADMIN",
      timezone: "UTC",
      tags: ["admin"],
      description: "Platform administrator",
    },
  });
  console.log(`  ✅ Admin: ${admin.email}`);

  // Create Mentors
  for (const m of mentors) {
    const mentor = await prisma.user.create({
      data: {
        id: uuidv4(),
        name: m.name,
        email: m.email,
        password: hash,
        role: "MENTOR",
        timezone: "UTC",
        tags: m.tags,
        description: m.description,
      },
    });
    console.log(`  ✅ Mentor: ${mentor.email} — ${mentor.name}`);
  }

  // Create Users
  for (const u of users) {
    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        name: u.name,
        email: u.email,
        password: hash,
        role: "USER",
        timezone: "UTC",
        tags: u.tags,
        description: u.description,
      },
    });
    console.log(`  ✅ User:   ${user.email} — ${user.name}`);
  }

  // Add some sample availability for mentors and users (next 7 days)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const allMentors = await prisma.user.findMany({ where: { role: "MENTOR" } });
  const allUsers = await prisma.user.findMany({ where: { role: "USER" } });

  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() + dayOffset);

    // Each mentor has availability for some hours
    for (const mentor of allMentors) {
      const startHour = 9 + Math.floor(Math.random() * 3); // 9-11
      for (let h = startHour; h < startHour + 4; h++) {
        const startTime = new Date(date);
        startTime.setUTCHours(h, 0, 0, 0);
        const endTime = new Date(date);
        endTime.setUTCHours(h + 1, 0, 0, 0);

        await prisma.availability.create({
          data: {
            id: uuidv4(),
            mentorId: mentor.id,
            role: "MENTOR",
            date,
            startTime,
            endTime,
          },
        });
      }
    }

    // Some users have availability
    for (const user of allUsers.slice(0, 5)) {
      const startHour = 10 + Math.floor(Math.random() * 3); // 10-12
      for (let h = startHour; h < startHour + 3; h++) {
        const startTime = new Date(date);
        startTime.setUTCHours(h, 0, 0, 0);
        const endTime = new Date(date);
        endTime.setUTCHours(h + 1, 0, 0, 0);

        await prisma.availability.create({
          data: {
            id: uuidv4(),
            userId: user.id,
            role: "USER",
            date,
            startTime,
            endTime,
          },
        });
      }
    }
  }

  console.log("\n  ✅ Added sample availability for next 7 days");
  console.log("\n🎉 Seeding complete!");
  console.log("\n📋 Login credentials (all passwords: password123):");
  console.log("   Admin:   admin@mentorque.com");
  console.log("   Mentors: mentor1@mentorque.com ... mentor5@mentorque.com");
  console.log("   Users:   user1@mentorque.com ... user10@mentorque.com");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
