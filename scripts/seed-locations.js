const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara',
];

async function main() {
  let count = 0;
  for (let stateIndex = 0; stateIndex < NIGERIAN_STATES.length; stateIndex += 1) {
    const state = NIGERIAN_STATES[stateIndex];
    const code = `NG-${String(stateIndex + 1).padStart(2, '0')}-01`;
    await prisma.zone.upsert({
      where: { code },
      update: { name: state, state, isActive: true },
      create: {
        name: state,
        code,
        state,
        description: `${state} collection zone`,
      },
    });
    count += 1;
  }

  console.log(`Ensured ${count} nationwide state zones.`);
}

main()
  .catch((error) => {
    console.error('Location seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
