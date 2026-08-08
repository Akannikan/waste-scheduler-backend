// ─────────────────────────────────────────────────────────────
//  Prisma Seed — Waste Scheduler System
//  Run: node prisma/seed.js  (or npm run db:seed)
// ─────────────────────────────────────────────────────────────

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Seeding database...');

  // ── Zones ─────────────────────────────────────────────────
  const zones = await Promise.all([
    prisma.zone.upsert({ where: { code: 'ZONE-N1' }, update: {}, create: { name: 'North District 1', code: 'ZONE-N1', description: 'Northern residential area covering sectors A-C' } }),
    prisma.zone.upsert({ where: { code: 'ZONE-N2' }, update: {}, create: { name: 'North District 2', code: 'ZONE-N2', description: 'Northern residential area covering sectors D-F' } }),
    prisma.zone.upsert({ where: { code: 'ZONE-S1' }, update: {}, create: { name: 'South District 1', code: 'ZONE-S1', description: 'Southern residential area' } }),
    prisma.zone.upsert({ where: { code: 'ZONE-E1' }, update: {}, create: { name: 'East District 1', code: 'ZONE-E1', description: 'Eastern commercial and residential area' } }),
    prisma.zone.upsert({ where: { code: 'ZONE-W1' }, update: {}, create: { name: 'West District 1', code: 'ZONE-W1', description: 'Western suburbs' } }),
  ]);
  console.log(`  ✓ ${zones.length} zones created`);

  // ── Waste Categories ───────────────────────────────────────
  const categories = await Promise.all([
    prisma.wasteCategory.upsert({
      where: { slug: 'plastic' }, update: {}, create: {
        name: 'Plastic', slug: 'plastic', color: '#1976D2', binColor: 'Blue Bin',
        icon: 'FaRecycle', description: 'Plastic bottles, containers, packaging',
        collectionDay: 'Tuesday',
        tips: ['Rinse containers before recycling', 'Remove caps and labels', 'Flatten bottles to save space'],
      }
    }),
    prisma.wasteCategory.upsert({
      where: { slug: 'paper' }, update: {}, create: {
        name: 'Paper', slug: 'paper', color: '#FFA726', binColor: 'Yellow Bin',
        icon: 'FaNewspaper', description: 'Newspapers, cardboard, office paper, magazines',
        collectionDay: 'Wednesday',
        tips: ['Keep paper dry', 'Flatten cardboard boxes', 'Remove tape and staples when possible'],
      }
    }),
    prisma.wasteCategory.upsert({
      where: { slug: 'glass' }, update: {}, create: {
        name: 'Glass', slug: 'glass', color: '#66BB6A', binColor: 'Green Bin',
        icon: 'FaWineBottle', description: 'Glass bottles, jars, containers',
        collectionDay: 'Thursday',
        tips: ['Rinse glass containers', 'Remove lids', 'Do not include broken glass in regular bin'],
      }
    }),
    prisma.wasteCategory.upsert({
      where: { slug: 'metal' }, update: {}, create: {
        name: 'Metal', slug: 'metal', color: '#78909C', binColor: 'Grey Bin',
        icon: 'FaCog', description: 'Aluminium cans, tin cans, metal containers',
        collectionDay: 'Tuesday',
        tips: ['Crush cans to save space', 'Rinse food cans', 'Separate aluminum from steel'],
      }
    }),
    prisma.wasteCategory.upsert({
      where: { slug: 'organic' }, update: {}, create: {
        name: 'Organic', slug: 'organic', color: '#8D6E63', binColor: 'Brown Bin',
        icon: 'FaLeaf', description: 'Food scraps, garden waste, biodegradable materials',
        collectionDay: 'Monday',
        tips: ['No meat or dairy in compost', 'Use compostable bags', 'Mix green and brown materials'],
      }
    }),
    prisma.wasteCategory.upsert({
      where: { slug: 'e-waste' }, update: {}, create: {
        name: 'Electronic Waste', slug: 'e-waste', color: '#7E57C2', binColor: 'Special Drop-off',
        icon: 'FaLaptop', description: 'Phones, computers, batteries, electronics',
        collectionDay: 'Monthly — First Saturday',
        tips: ['Never dispose in regular bins', 'Remove batteries separately', 'Take to designated e-waste center'],
      }
    }),
    prisma.wasteCategory.upsert({
      where: { slug: 'hazardous' }, update: {}, create: {
        name: 'Hazardous Waste', slug: 'hazardous', color: '#EF5350', binColor: 'Red Special Container',
        icon: 'FaExclamationTriangle', description: 'Chemicals, paints, oils, medical waste',
        collectionDay: 'Monthly — Third Saturday',
        tips: ['Never pour chemicals down the drain', 'Keep in original containers', 'Contact waste authority for disposal'],
      }
    }),
  ]);
  console.log(`  ✓ ${categories.length} waste categories created`);

  // ── Trucks ────────────────────────────────────────────────
  const trucks = await Promise.all([
    prisma.truck.upsert({ where: { plateNumber: 'WST-001' }, update: {}, create: { plateNumber: 'WST-001', model: 'Ford F-750', capacity: 5000 } }),
    prisma.truck.upsert({ where: { plateNumber: 'WST-002' }, update: {}, create: { plateNumber: 'WST-002', model: 'Isuzu NPR', capacity: 3500 } }),
    prisma.truck.upsert({ where: { plateNumber: 'WST-003' }, update: {}, create: { plateNumber: 'WST-003', model: 'Mercedes Atego', capacity: 7000 } }),
  ]);
  console.log(`  ✓ ${trucks.length} trucks created`);

  // ── Users ─────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@123', 10);
  const collectorHash = await bcrypt.hash('Collector@123', 10);
  const residentHash = await bcrypt.hash('Resident@123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@wastescheduler.com' },
    update: {},
    create: {
      name: 'System Administrator',
      email: 'admin@wastescheduler.com',
      passwordHash: adminHash,
      role: 'admin',
      phone: '+1-555-0100',
      emailVerified: true,
    },
  });

  const collectorUser = await prisma.user.upsert({
    where: { email: 'collector@wastescheduler.com' },
    update: {},
    create: {
      name: 'John Collector',
      email: 'collector@wastescheduler.com',
      passwordHash: collectorHash,
      role: 'collector',
      phone: '+1-555-0200',
      zoneId: zones[0].id,
      emailVerified: true,
    },
  });

  const residentUser = await prisma.user.upsert({
    where: { email: 'resident@wastescheduler.com' },
    update: {},
    create: {
      name: 'Jane Resident',
      email: 'resident@wastescheduler.com',
      passwordHash: residentHash,
      role: 'resident',
      phone: '+1-555-0300',
      address: '123 Green Street, North District',
      zoneId: zones[0].id,
      emailVerified: true,
    },
  });
  console.log('  ✓ 3 seed users created (admin / collector / resident)');

  // ── Pickup Schedules ──────────────────────────────────────
  const today = new Date();
  const nextDay = (offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    d.setHours(8, 0, 0, 0);
    return d;
  };

  const scheduleSeed = [
    { title: 'Plastic Pickup — North 1', zoneId: zones[0].id, categoryId: categories[0].id, pickupDate: nextDay(1), recurrence: 'weekly', truckId: trucks[0].id },
    { title: 'Organic Pickup — North 1', zoneId: zones[0].id, categoryId: categories[4].id, pickupDate: nextDay(2), recurrence: 'weekly', truckId: trucks[1].id },
    { title: 'Paper Pickup — South 1', zoneId: zones[2].id, categoryId: categories[1].id, pickupDate: nextDay(3), recurrence: 'weekly', truckId: trucks[2].id },
    { title: 'Glass Pickup — East 1', zoneId: zones[3].id, categoryId: categories[2].id, pickupDate: nextDay(4), recurrence: 'biweekly', truckId: trucks[0].id },
    { title: 'Metal Pickup — West 1', zoneId: zones[4].id, categoryId: categories[3].id, pickupDate: nextDay(5), recurrence: 'biweekly', truckId: trucks[1].id },
    { title: 'E-Waste Pickup — All Zones', zoneId: zones[0].id, categoryId: categories[5].id, pickupDate: nextDay(14), recurrence: 'monthly', truckId: trucks[2].id },
  ];

  for (const s of scheduleSeed) {
    await prisma.pickupSchedule.create({ data: s });
  }
  console.log(`  ✓ ${scheduleSeed.length} pickup schedules created`);

  // ── Recycling Centers ─────────────────────────────────────
  const centerSeed = [
    {
      name: 'GreenCycle North Center', address: '45 Recycling Ave, North District',
      latitude: 40.7128, longitude: -74.0060,
      phone: '+1-555-1001', zoneId: zones[0].id,
      openingHours: 'Mon–Fri 8am–6pm, Sat 9am–3pm',
      acceptedTypes: ['plastic', 'paper', 'glass', 'metal'],
    },
    {
      name: 'EcoHub South', address: '12 Eco Lane, South District',
      latitude: 40.6892, longitude: -74.0445,
      phone: '+1-555-1002', zoneId: zones[2].id,
      openingHours: 'Mon–Sat 7am–5pm',
      acceptedTypes: ['plastic', 'e-waste', 'hazardous'],
    },
    {
      name: 'East Side Recycling Point', address: '200 Industrial Rd, East District',
      latitude: 40.7282, longitude: -73.9942,
      phone: '+1-555-1003', zoneId: zones[3].id,
      openingHours: 'Tue–Sun 9am–4pm',
      acceptedTypes: ['glass', 'metal', 'paper', 'organic'],
    },
  ];

  for (const c of centerSeed) {
    await prisma.recyclingCenter.create({ data: c });
  }
  console.log(`  ✓ ${centerSeed.length} recycling centers created`);

  // ── Announcements ─────────────────────────────────────────
  await prisma.announcement.createMany({
    data: [
      {
        title: 'Welcome to Waste Scheduler!',
        message: 'Our new waste management portal is live. Track your collection schedules, report issues, and find recycling centers near you.',
        audience: 'all',
      },
      {
        title: 'Monthly Recycling Drive — August',
        message: 'Join us this Saturday for the community recycling drive at North Center. Bring your e-waste and hazardous materials for safe disposal.',
        audience: 'residents',
      },
      {
        title: 'New Collection Route — West District',
        message: 'Collection routes in West District have been updated. Please check your new schedule on the Calendar page.',
        audience: 'all',
      },
    ],
    skipDuplicates: true,
  });
  console.log('  ✓ 3 announcements created');

  // ── Waste Guide Items ─────────────────────────────────────
  const guideItems = [
    { itemName: 'Plastic Bottle', aliases: ['water bottle', 'soda bottle', 'PET bottle'], categorySlug: 'plastic', disposalMethod: 'Rinse and place in Blue Bin', binColor: 'Blue Bin', specialNotes: 'Remove cap and label if possible' },
    { itemName: 'Cardboard Box', aliases: ['moving box', 'shipping box', 'corrugated box'], categorySlug: 'paper', disposalMethod: 'Flatten and place in Yellow Bin', binColor: 'Yellow Bin', specialNotes: 'Remove tape and packing materials' },
    { itemName: 'Glass Jar', aliases: ['mason jar', 'jam jar', 'pickle jar'], categorySlug: 'glass', disposalMethod: 'Rinse and place in Green Bin', binColor: 'Green Bin', specialNotes: 'Remove metal lids separately' },
    { itemName: 'Aluminium Can', aliases: ['beer can', 'soda can', 'tin can'], categorySlug: 'metal', disposalMethod: 'Crush and place in Grey Bin', binColor: 'Grey Bin', specialNotes: 'Rinse to remove food residue' },
    { itemName: 'Food Scraps', aliases: ['kitchen waste', 'vegetable peels', 'leftovers'], categorySlug: 'organic', disposalMethod: 'Place in Brown Bin or compost pile', binColor: 'Brown Bin', specialNotes: 'No meat or dairy for home composting' },
    { itemName: 'Old Smartphone', aliases: ['mobile phone', 'cell phone', 'broken phone'], categorySlug: 'e-waste', disposalMethod: 'Take to designated e-waste drop-off location', binColor: 'Special Drop-off', specialNotes: 'Remove SIM card and wipe personal data first' },
    { itemName: 'Paint Can', aliases: ['house paint', 'spray paint', 'leftover paint'], categorySlug: 'hazardous', disposalMethod: 'Take to hazardous waste facility on collection day', binColor: 'Red Special Container', specialNotes: 'Keep sealed in original container' },
    { itemName: 'Newspaper', aliases: ['magazine', 'flyer', 'brochure'], categorySlug: 'paper', disposalMethod: 'Bundle and place in Yellow Bin', binColor: 'Yellow Bin', specialNotes: 'Keep dry — wet paper goes to organic' },
    { itemName: 'Laptop', aliases: ['notebook computer', 'broken laptop', 'old computer'], categorySlug: 'e-waste', disposalMethod: 'Take to e-waste center', binColor: 'Special Drop-off', specialNotes: 'Remove battery if possible; wipe hard drive' },
    { itemName: 'Cooking Oil', aliases: ['used oil', 'frying oil', 'motor oil'], categorySlug: 'hazardous', disposalMethod: 'Seal in a bottle and take to collection point', binColor: 'Red Special Container', specialNotes: 'Never pour down the drain' },
  ];

  for (const item of guideItems) {
    await prisma.wasteGuideItem.create({ data: item });
  }
  console.log(`  ✓ ${guideItems.length} waste guide items created`);

  console.log('\n✅  Database seeded successfully!');
  console.log('\n📋  Demo Credentials:');
  console.log('   Admin:     admin@wastescheduler.com     / Admin@123');
  console.log('   Collector: collector@wastescheduler.com / Collector@123');
  console.log('   Resident:  resident@wastescheduler.com  / Resident@123\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
