const { PrismaClient } = require('@prisma/client');
const nigeriaLocations = require('nigerian-states-and-lgas');

const prisma = new PrismaClient();

async function main() {
  const locations = [
    ...nigeriaLocations.all().map((entry) => ({
      state: entry.state === 'Kastina' ? 'Katsina' : entry.state,
      lgas: entry.lgas,
    })),
    { state: 'FCT', lgas: ['Municipal Area Council'] },
  ];

  let count = 0;
  for (let stateIndex = 0; stateIndex < locations.length; stateIndex += 1) {
    const { state, lgas } = locations[stateIndex];
    for (let lgaIndex = 0; lgaIndex < lgas.length; lgaIndex += 1) {
      const lga = lgas[lgaIndex];
      const code = `NG-${String(stateIndex + 1).padStart(2, '0')}-${String(lgaIndex + 1).padStart(2, '0')}`;
      await prisma.zone.upsert({
        where: { code },
        update: { name: lga, state, lga, isActive: true },
        create: {
          name: lga,
          code,
          state,
          lga,
          description: `${state} ${lga} collection zone`,
        },
      });
      count += 1;
    }
  }

  console.log(`Ensured ${count} nationwide LGA zones.`);
}

main()
  .catch((error) => {
    console.error('Location seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
