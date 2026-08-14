require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const quizzes = await p.quiz.findMany({
    include: { _count: { select: { questions: true, attempts: true } } },
  });
  console.log('Total quizzes:', quizzes.length);
  quizzes.forEach(q => {
    console.log(` - [${q.id}] "${q.title}" | questions: ${q._count.questions} | difficulty: ${q.difficulty} | active: ${q.isActive}`);
  });

  if (quizzes.length === 0) {
    console.log('\nNo quizzes found. Re-seeding...');
    // Check questions separately
    const qcount = await p.quizQuestion.count();
    console.log('Question count:', qcount);
  }
}

main()
  .catch(e => console.error('Error:', e.message))
  .finally(() => p.$disconnect());
