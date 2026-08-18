require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Find admin and collector
  const admin = await p.user.findFirst({ where: { role: 'admin' } });
  const collector = await p.user.findFirst({ where: { role: 'collector' } });
  console.log('Admin:', admin?.name, admin?.id);
  console.log('Collector:', collector?.name, collector?.id);

  // Create assignment
  const a = await p.assignment.create({
    data: {
      title: 'Test Assignment',
      description: 'Test from script',
      adminId: admin.id,
      collectorId: collector.id,
      priority: 'normal',
    }
  });
  console.log('Assignment created:', a.id);

  // Send a message
  const msg = await p.assignmentMessage.create({
    data: {
      assignmentId: a.id,
      senderId: admin.id,
      message: 'Please confirm when you start',
    }
  });
  console.log('Message created:', msg.id, msg.message);

  // Check notification was created
  const notif = await p.notification.findFirst({ where: { userId: collector.id }, orderBy: { createdAt: 'desc' } });
  console.log('Notification to collector:', notif?.title);

  // Cleanup
  await p.assignmentMessage.deleteMany({ where: { assignmentId: a.id } });
  await p.assignment.delete({ where: { id: a.id } });
  await p.notification.delete({ where: { id: notif.id } });
  console.log('Cleanup done');
}

main().catch(e => console.error('FAILED:', e.message)).finally(() => p.$disconnect());
