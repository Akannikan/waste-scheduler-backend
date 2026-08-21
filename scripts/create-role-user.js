require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const role = process.env.USER_ROLE;
  const email = process.env.USER_EMAIL?.trim().toLowerCase();
  const password = process.env.USER_PASSWORD;
  const name = process.env.USER_NAME?.trim();

  if (!['resident', 'collector'].includes(role)) {
    throw new Error('USER_ROLE must be resident or collector');
  }
  if (!email || !password || !name) {
    throw new Error('Set USER_NAME, USER_EMAIL, USER_PASSWORD, and USER_ROLE before running db:create-role-user');
  }
  if (password.length < 12) throw new Error('USER_PASSWORD must be at least 12 characters');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role, isActive: true, emailVerified: true },
    create: { name, email, passwordHash, role, isActive: true, emailVerified: true },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  console.log(`${role} account ready: ${user.email} (id ${user.id})`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());