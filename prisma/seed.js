// ─────────────────────────────────────────────────────────────
//  WasteScheduler Nigeria — Prisma Seed v2
//  Run: node prisma/seed.js
// ─────────────────────────────────────────────────────────────
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Seeding WasteScheduler Nigeria database...\n');

  // ── Nigerian Zones (Kwara first, with existing states preserved) ──
  const zones = await Promise.all([
    prisma.zone.upsert({ where: { code: 'LAG-IS' }, update: {}, create: { name: 'Lagos Island', code: 'LAG-IS', state: 'Lagos', lga: 'Lagos Island', description: 'Lagos Island LGA — Eko, Lafiaji, Olowogbowo' } }),
    prisma.zone.upsert({ where: { code: 'LAG-IK' }, update: {}, create: { name: 'Ikeja GRA', code: 'LAG-IK', state: 'Lagos', lga: 'Ikeja', description: 'Ikeja LGA — GRA, Allen Avenue, Alausa' } }),
    prisma.zone.upsert({ where: { code: 'LAG-SUR' }, update: {}, create: { name: 'Surulere', code: 'LAG-SUR', state: 'Lagos', lga: 'Surulere', description: 'Surulere LGA — Aguda, Itire, Iponri' } }),
    prisma.zone.upsert({ where: { code: 'ABJ-CBD' }, update: {}, create: { name: 'Abuja Central', code: 'ABJ-CBD', state: 'FCT', lga: 'Municipal Area Council', description: 'Abuja CBD — Maitama, Asokoro, Wuse' } }),
    prisma.zone.upsert({ where: { code: 'PH-PH' }, update: {}, create: { name: 'Port Harcourt City', code: 'PH-PH', state: 'Rivers', lga: 'Port Harcourt', description: 'PH City LGA — Old GRA, Trans Amadi, Diobu' } }),
    prisma.zone.upsert({ where: { code: 'KAN-MUN' }, update: {}, create: { name: 'Kano Municipal', code: 'KAN-MUN', state: 'Kano', lga: 'Kano Municipal', description: 'Kano Municipal LGA — Fagge, Gwale, Nassarawa' } }),
    prisma.zone.upsert({ where: { code: 'KWR-ILW' }, update: { state: 'Kwara', lga: 'Ilorin West' }, create: { name: 'Ilorin West', code: 'KWR-ILW', state: 'Kwara', lga: 'Ilorin West', description: 'Ilorin West LGA collection zone' } }),
    prisma.zone.upsert({ where: { code: 'KWR-ILE' }, update: { state: 'Kwara', lga: 'Ilorin East' }, create: { name: 'Ilorin East', code: 'KWR-ILE', state: 'Kwara', lga: 'Ilorin East', description: 'Ilorin East LGA collection zone' } }),
    prisma.zone.upsert({ where: { code: 'KWR-OFF' }, update: { state: 'Kwara', lga: 'Offa' }, create: { name: 'Offa', code: 'KWR-OFF', state: 'Kwara', lga: 'Offa', description: 'Offa LGA collection zone' } }),
  ]);
  console.log(`  ✓ ${zones.length} Nigerian zones created`);

  // ── Waste Categories ───────────────────────────────────────
  const categories = await Promise.all([
    prisma.wasteCategory.upsert({ where: { slug: 'plastic' }, update: {}, create: { name: 'Plastic', slug: 'plastic', color: '#1976D2', binColor: 'Blue Bin', icon: 'FaRecycle', description: 'Plastic bottles, bags, containers, packaging', collectionDay: 'Tuesday', tips: ['Rinse containers before recycling', 'Remove caps and labels', 'Flatten bottles to save space'], pricePerKg: 30 } }),
    prisma.wasteCategory.upsert({ where: { slug: 'paper' }, update: {}, create: { name: 'Paper', slug: 'paper', color: '#FFA726', binColor: 'Yellow Bin', icon: 'FaNewspaper', description: 'Newspapers, cardboard, office paper, magazines', collectionDay: 'Wednesday', tips: ['Keep paper dry', 'Flatten cardboard boxes', 'Remove tape and staples when possible'], pricePerKg: 20 } }),
    prisma.wasteCategory.upsert({ where: { slug: 'glass' }, update: {}, create: { name: 'Glass', slug: 'glass', color: '#66BB6A', binColor: 'Green Bin', icon: 'FaWineBottle', description: 'Glass bottles, jars, containers', collectionDay: 'Thursday', tips: ['Rinse glass containers', 'Remove lids', 'Do not include broken glass in regular bin'], pricePerKg: 15 } }),
    prisma.wasteCategory.upsert({ where: { slug: 'metal' }, update: {}, create: { name: 'Metal', slug: 'metal', color: '#78909C', binColor: 'Grey Bin', icon: 'FaCog', description: 'Aluminium cans, tin cans, metal containers, iron scraps', collectionDay: 'Tuesday', tips: ['Crush cans to save space', 'Rinse food cans', 'Separate aluminum from steel'], pricePerKg: 50 } }),
    prisma.wasteCategory.upsert({ where: { slug: 'organic' }, update: {}, create: { name: 'Organic', slug: 'organic', color: '#8D6E63', binColor: 'Brown Bin', icon: 'FaLeaf', description: 'Food scraps, garden waste, biodegradable materials', collectionDay: 'Monday & Thursday', tips: ['No meat or dairy in compost', 'Use compostable bags', 'Mix green and brown materials'], pricePerKg: 10 } }),
    prisma.wasteCategory.upsert({ where: { slug: 'e-waste' }, update: {}, create: { name: 'Electronic Waste', slug: 'e-waste', color: '#7E57C2', binColor: 'Special Drop-off', icon: 'FaLaptop', description: 'Phones, computers, batteries, electronics', collectionDay: 'Monthly — First Saturday', tips: ['Never dispose in regular bins', 'Remove batteries separately', 'Take to designated e-waste center'], pricePerKg: 100 } }),
    prisma.wasteCategory.upsert({ where: { slug: 'hazardous' }, update: {}, create: { name: 'Hazardous Waste', slug: 'hazardous', color: '#EF5350', binColor: 'Red Special Container', icon: 'FaExclamationTriangle', description: 'Chemicals, paints, oils, medical waste', collectionDay: 'Monthly — Third Saturday', tips: ['Never pour chemicals down the drain', 'Keep in original containers', 'Contact LAWMA for disposal guidance'], pricePerKg: 200 } }),
  ]);
  console.log(`  ✓ ${categories.length} waste categories created`);

  // ── Pricing Rules ──────────────────────────────────────────
  await prisma.pricingRule.createMany({
    skipDuplicates: true,
    data: [
      { billingType: 'monthly_flat', monthlyFlat: 2000, pricePerKg: 50, pricePerBin: 500, isActive: true },
      { zoneId: zones[0].id, billingType: 'monthly_flat', monthlyFlat: 2500, pricePerKg: 60, pricePerBin: 600, isActive: true },
      { zoneId: zones[1].id, billingType: 'monthly_flat', monthlyFlat: 3000, pricePerKg: 70, pricePerBin: 700, isActive: true },
    ],
  });
  console.log('  ✓ Pricing rules created (₦2,000–₦3,000/month)');

  // ── Trucks ─────────────────────────────────────────────────
  await Promise.all([
    prisma.truck.upsert({ where: { plateNumber: 'LAG-001-WST' }, update: {}, create: { plateNumber: 'LAG-001-WST', model: 'MAN TGS 28.360', capacity: 8000 } }),
    prisma.truck.upsert({ where: { plateNumber: 'LAG-002-WST' }, update: {}, create: { plateNumber: 'LAG-002-WST', model: 'Isuzu FRR 500', capacity: 4000 } }),
    prisma.truck.upsert({ where: { plateNumber: 'ABJ-001-WST' }, update: {}, create: { plateNumber: 'ABJ-001-WST', model: 'DAF CF 85', capacity: 10000 } }),
  ]);
  console.log('  ✓ 3 trucks created');

  // ── Pickup Schedules ──────────────────────────────────────
  const nextDay = (offset, hour = 8) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  await Promise.all([
    prisma.pickupSchedule.create({ data: { title: 'Plastic & Metal Pickup — Lagos Island', zoneId: zones[0].id, categoryId: categories[0].id, pickupDate: nextDay(1), recurrence: 'weekly' } }),
    prisma.pickupSchedule.create({ data: { title: 'Organic Waste Pickup — Lagos Island', zoneId: zones[0].id, categoryId: categories[4].id, pickupDate: nextDay(2), recurrence: 'weekly' } }),
    prisma.pickupSchedule.create({ data: { title: 'Paper & Cardboard — Ikeja GRA', zoneId: zones[1].id, categoryId: categories[1].id, pickupDate: nextDay(3), recurrence: 'weekly' } }),
    prisma.pickupSchedule.create({ data: { title: 'Glass Pickup — Surulere', zoneId: zones[2].id, categoryId: categories[2].id, pickupDate: nextDay(4), recurrence: 'biweekly' } }),
    prisma.pickupSchedule.create({ data: { title: 'E-Waste Drive — Abuja Central', zoneId: zones[3].id, categoryId: categories[5].id, pickupDate: nextDay(14), recurrence: 'monthly' } }),
    prisma.pickupSchedule.create({ data: { title: 'Hazardous Waste — All Lagos Zones', zoneId: zones[0].id, categoryId: categories[6].id, pickupDate: nextDay(21), recurrence: 'monthly' } }),
  ]);
  console.log('  ✓ 6 pickup schedules created');

  // ── Nigerian Recycling Centers ─────────────────────────────
  await Promise.all([
    prisma.recyclingCenter.create({ data: { name: 'LAWMA Recycling Hub — Ojota', address: 'Ojota, Lagos', latitude: 6.5833, longitude: 3.3833, phone: '+2341-279-5100', zoneId: zones[0].id, state: 'Lagos', lga: 'Kosofe', openingHours: 'Mon–Fri 7am–5pm, Sat 8am–2pm', acceptedTypes: ['plastic', 'paper', 'glass', 'metal'] } }),
    prisma.recyclingCenter.create({ data: { name: 'EkoRecycle Center — Victoria Island', address: 'Ahmadu Bello Way, Victoria Island, Lagos', latitude: 6.4281, longitude: 3.4219, phone: '+2348055123456', zoneId: zones[1].id, state: 'Lagos', lga: 'Eti-Osa', openingHours: 'Mon–Sat 8am–6pm', acceptedTypes: ['e-waste', 'plastic', 'hazardous'] } }),
    prisma.recyclingCenter.create({ data: { name: 'Abuja E-Waste Facility — Jabi', address: 'Jabi Lake Mall Area, Abuja', latitude: 9.0579, longitude: 7.4951, phone: '+2348066234567', zoneId: zones[3].id, state: 'FCT', lga: 'Municipal Area Council', openingHours: 'Tue–Sun 9am–4pm', acceptedTypes: ['e-waste', 'metal', 'glass'] } }),
    prisma.recyclingCenter.create({ data: { name: 'GreenPH Recycling — Trans Amadi', address: 'Trans Amadi Industrial Layout, Port Harcourt', latitude: 4.8396, longitude: 7.0134, phone: '+2348077345678', zoneId: zones[4].id, state: 'Rivers', lga: 'Obio-Akpor', openingHours: 'Mon–Fri 8am–5pm', acceptedTypes: ['plastic', 'paper', 'metal', 'organic'] } }),
  ]);
  console.log('  ✓ 4 Nigerian recycling centers created');

  // ── Announcements ─────────────────────────────────────────
  await prisma.announcement.createMany({
    skipDuplicates: true,
    data: [
      { title: 'Welcome to WasteScheduler Nigeria! 🇳🇬', message: 'Your community waste management platform is live. Track schedules, report issues, find recycling centers, and pay your waste fees — all in one place.', audience: 'all' },
      { title: 'Lagos Sanitation Day — Last Saturday of Every Month', message: 'Join your neighbors for community sanitation on the last Saturday of every month. LAWMA PSP operators will be available across all Lagos zones from 7am–12pm.', audience: 'residents' },
      { title: 'New: AI Waste Assistant Available', message: 'Ask WasteBot any question about waste disposal, recycling, or your schedule. Available 24/7 — tap the chat icon on any page!', audience: 'all' },
      { title: 'Waste Fee Payment — Bank Transfer', message: 'Pay your monthly waste fee via bank transfer to First Bank Account 3012345678 (WasteScheduler Nigeria Ltd). Upload your proof in the Billing section.', audience: 'residents' },
    ],
  });
  console.log('  ✓ 4 announcements created');

  // ── Waste Guide Items (Nigerian context) ──────────────────
  const guideItems = [
    { itemName: 'Plastic Bottle', aliases: ['PET bottle', 'Eva water bottle', 'Ragolis bottle'], categorySlug: 'plastic', disposalMethod: 'Rinse and place in Blue Bin', binColor: 'Blue Bin', specialNotes: 'Remove bottle cap separately' },
    { itemName: 'Nylon Bag', aliases: ['pure water nylon', 'polythene bag', 'shopping bag'], categorySlug: 'plastic', disposalMethod: 'Collect in a bag and place in Blue Bin', binColor: 'Blue Bin', specialNotes: 'Do not burn — toxic fumes' },
    { itemName: 'Cardboard Box', aliases: ['carton', 'shipping box', 'corrugated box'], categorySlug: 'paper', disposalMethod: 'Flatten and place in Yellow Bin', binColor: 'Yellow Bin', specialNotes: 'Remove tape and packing materials' },
    { itemName: 'Glass Bottle', aliases: ['beer bottle', 'stout bottle', 'wine bottle'], categorySlug: 'glass', disposalMethod: 'Rinse and place in Green Bin', binColor: 'Green Bin', specialNotes: 'Remove metal caps separately' },
    { itemName: 'Tin Can', aliases: ['tomato tin', 'sardine can', 'Milo tin'], categorySlug: 'metal', disposalMethod: 'Rinse and crush, place in Grey Bin', binColor: 'Grey Bin', specialNotes: 'Sharp edges — handle carefully' },
    { itemName: 'Food Waste', aliases: ['eba', 'rice remnants', 'vegetable peelings', 'food remnants'], categorySlug: 'organic', disposalMethod: 'Place in Brown Bin or compost pile', binColor: 'Brown Bin', specialNotes: 'Do not include pepper soup or oily foods in compost' },
    { itemName: 'Old Smartphone', aliases: ['broken phone', 'old iPhone', 'Tecno phone', 'Infinix phone'], categorySlug: 'e-waste', disposalMethod: 'Take to designated e-waste drop-off', binColor: 'Special Drop-off', specialNotes: 'Remove SIM card and wipe personal data first' },
    { itemName: 'Generator Battery', aliases: ['car battery', 'deep cycle battery', 'inverter battery'], categorySlug: 'hazardous', disposalMethod: 'Take to hazardous waste facility — never dump', binColor: 'Red Special Container', specialNotes: 'Contains lead acid — extremely dangerous if broken' },
    { itemName: 'Used Engine Oil', aliases: ['car oil', 'motor oil', 'engine lubricant'], categorySlug: 'hazardous', disposalMethod: 'Seal in container, take to collection point', binColor: 'Red Special Container', specialNotes: 'Never pour down the drain or into the ground' },
    { itemName: 'Newspaper', aliases: ['daily newspaper', 'The Punch', 'Vanguard paper', 'magazine'], categorySlug: 'paper', disposalMethod: 'Bundle and place in Yellow Bin', binColor: 'Yellow Bin', specialNotes: 'Keep dry — wet paper goes to organic' },
    { itemName: 'Sachet Water Bags', aliases: ['pure water bags', 'water sachets'], categorySlug: 'plastic', disposalMethod: 'Collect in bulk, rinse, place in Blue Bin', binColor: 'Blue Bin', specialNotes: 'Major source of Lagos flooding — never litter' },
    { itemName: 'Laptop Computer', aliases: ['old laptop', 'broken computer', 'PC', 'desktop'], categorySlug: 'e-waste', disposalMethod: 'Take to certified e-waste center', binColor: 'Special Drop-off', specialNotes: 'Wipe hard drive before disposal for data safety' },
  ];

  for (const item of guideItems) {
    await prisma.wasteGuideItem.create({ data: item });
  }
  console.log(`  ✓ ${guideItems.length} Nigerian waste guide items created`);

  // ── Quizzes ────────────────────────────────────────────────
  const quiz1 = await prisma.quiz.create({
    data: {
      title: 'Waste Sorting Basics',
      description: 'Test your knowledge of proper waste sorting and recycling in Nigeria',
      category: 'recycling',
      difficulty: 'easy',
      timeLimit: 60,
      points: 50,
      questions: {
        create: [
          { question: 'Which bin should you use for plastic water bottles?', options: ['Green Bin', 'Blue Bin', 'Brown Bin', 'Grey Bin'], correctAnswer: 1, explanation: 'Plastic bottles go in the Blue Bin for recycling.', points: 10 },
          { question: 'What should you do with sachet water bags (pure water nylons)?', options: ['Burn them', 'Throw on the street', 'Collect and put in Blue Bin', 'Pour in the gutter'], correctAnswer: 2, explanation: 'Sachet bags go in the Blue Bin. Littering them causes flooding in Lagos!', points: 10 },
          { question: 'Which waste type is collected in the Brown Bin?', options: ['Electronic waste', 'Glass bottles', 'Food scraps and garden waste', 'Metal cans'], correctAnswer: 2, explanation: 'Organic waste like food scraps goes in the Brown Bin for composting.', points: 10 },
          { question: 'Where should you take an old generator battery?', options: ['Brown Bin', 'Regular trash', 'Hazardous waste facility', 'Throw in the bush'], correctAnswer: 2, explanation: 'Generator batteries contain lead acid — extremely dangerous. Always take to a hazardous waste facility.', points: 10 },
          { question: 'Which of these is NOT recyclable in a regular bin?', options: ['Cardboard box', 'Glass jar', 'Used engine oil', 'Aluminium can'], correctAnswer: 2, explanation: 'Used engine oil is hazardous and must never go in regular bins. Take it to a collection point.', points: 10 },
        ],
      },
    },
  });

  const quiz2 = await prisma.quiz.create({
    data: {
      title: 'Nigerian Environment & Recycling',
      description: 'Advanced quiz on environmental impact and recycling in Nigeria',
      category: 'environment',
      difficulty: 'medium',
      timeLimit: 90,
      points: 75,
      questions: {
        create: [
          { question: 'What does LAWMA stand for?', options: ['Lagos Area Waste Management Authority', 'Lagos Waste Management Authority', 'Lagos Area Waste Motor Authority', 'Lagos Automated Waste Management Agency'], correctAnswer: 1, explanation: 'LAWMA — Lagos Waste Management Authority — oversees waste collection in Lagos State.', points: 15 },
          { question: 'What is the main cause of flooding in Lagos during rainy season?', options: ['Too much rain only', 'Blocked drains from plastic waste', 'Lagos being below sea level', 'River overflow only'], correctAnswer: 1, explanation: 'Sachet bags and plastic waste clog drainage channels, causing flooding during heavy rains.', points: 15 },
          { question: 'How many years does a plastic bottle take to decompose?', options: ['10 years', '50 years', '450 years', '10,000 years'], correctAnswer: 2, explanation: 'A plastic bottle takes approximately 450 years to fully decompose in a landfill.', points: 15 },
          { question: 'What type of waste makes up the largest portion of Nigerian household waste?', options: ['Plastic', 'Organic/food waste', 'Paper', 'Metal'], correctAnswer: 1, explanation: 'Organic/food waste makes up over 50% of Nigerian household waste, making composting very impactful.', points: 15 },
          { question: 'Which PSP means in Nigerian waste management?', options: ['Private Sector Participation', 'Public Sanitation Program', 'Port Sanitation Partnership', 'Private Sanitation Personnel'], correctAnswer: 0, explanation: 'PSP (Private Sector Participation) refers to private waste collectors licensed to operate in Nigerian cities.', points: 15 },
        ],
      },
    },
  });
  console.log(`  ✓ 2 quizzes created (${quiz1.title}, ${quiz2.title})`);

  console.log('\n✅  Database seeded successfully!\n');
  console.log('💰  Pricing: ₦2,000/month flat rate (Lagos Island: ₦2,500, Ikeja GRA: ₦3,000)\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
