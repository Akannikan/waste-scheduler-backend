const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { sendPickupReminderEmail, sendBillEmail } = require('./email.service');

const prisma = new PrismaClient();

function startCronJobs() {
  console.log('⏰  Cron jobs started');

  // ── Run every hour — send pickup reminders ───────────────────
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();

      // 24-hour reminders
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in26h = new Date(now.getTime() + 26 * 60 * 60 * 1000);

      // 2-hour reminders
      const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);

      const schedulesFor24h = await prisma.pickupSchedule.findMany({
        where: {
          pickupDate: { gte: in24h, lte: in26h },
          status: 'scheduled',
          reminderSent: false,
        },
        include: {
          zone: true,
          category: true,
        },
      });

      const schedulesFor2h = await prisma.pickupSchedule.findMany({
        where: {
          pickupDate: { gte: in2h, lte: in3h },
          status: 'scheduled',
        },
        include: {
          zone: true,
          category: true,
        },
      });

      // Send 24h reminders to all users in the zone
      for (const schedule of schedulesFor24h) {
        const users = await prisma.user.findMany({
          where: { zoneId: schedule.zoneId, isActive: true, role: 'resident' },
        });

        for (const user of users) {
          try {
            await sendPickupReminderEmail(user, schedule, 24);
            // Also create in-app notification
            await prisma.notification.create({
              data: {
                userId: user.id,
                title: `${schedule.category?.name || 'Waste'} pickup tomorrow`,
                message: `Your ${schedule.category?.name || 'waste'} collection is scheduled for tomorrow. Please put out your ${schedule.category?.binColor || 'bin'}.`,
                channel: 'email',
                sentAt: new Date(),
              },
            });
          } catch (e) {
            console.error(`Failed to send reminder to ${user.email}:`, e.message);
          }
        }

        // Mark reminder as sent
        await prisma.pickupSchedule.update({
          where: { id: schedule.id },
          data: { reminderSent: true },
        });
      }

      // Send 2h reminders
      for (const schedule of schedulesFor2h) {
        const users = await prisma.user.findMany({
          where: { zoneId: schedule.zoneId, isActive: true, role: 'resident' },
        });

        for (const user of users) {
          try {
            await sendPickupReminderEmail(user, schedule, 2);
            await prisma.notification.create({
              data: {
                userId: user.id,
                title: `⚠️ ${schedule.category?.name || 'Waste'} pickup in 2 hours!`,
                message: `Your ${schedule.category?.name || 'waste'} collection starts in about 2 hours. Make sure your bin is out!`,
                channel: 'in_app',
                sentAt: new Date(),
              },
            });
          } catch (e) {
            console.error(`2h reminder failed for ${user.email}:`, e.message);
          }
        }
      }

      if (schedulesFor24h.length > 0 || schedulesFor2h.length > 0) {
        console.log(`[CRON] Reminders sent — 24h: ${schedulesFor24h.length}, 2h: ${schedulesFor2h.length}`);
      }
    } catch (err) {
      console.error('[CRON] Pickup reminder error:', err.message);
    }
  });

  // ── Run daily at 8am WAT (7am UTC) — generate monthly bills ──
  cron.schedule('0 7 1 * *', async () => {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const residents = await prisma.user.findMany({
        where: { role: 'resident', isActive: true },
      });

      let billsCreated = 0;
      for (const user of residents) {
        // Check if bill already exists for this month
        const existing = await prisma.bill.findFirst({
          where: { userId: user.id, month, year },
        });
        if (existing) continue;

        // Get pricing rule for user zone or default
        const rule = await prisma.pricingRule.findFirst({
          where: {
            OR: [{ zoneId: user.zoneId }, { zoneId: null }],
            isActive: true,
          },
          orderBy: { zoneId: 'desc' }, // zone-specific rule takes priority
        });

        const amount = rule?.monthlyFlat || 2000;
        const dueDate = new Date(year, month - 1, 28); // due 28th of each month

        const bill = await prisma.bill.create({
          data: {
            userId: user.id,
            month,
            year,
            billingType: 'monthly_flat',
            amountNaira: amount,
            dueDate,
          },
        });

        try {
          await sendBillEmail(user, bill);
        } catch (e) {
          console.error(`Bill email failed for ${user.email}:`, e.message);
        }
        billsCreated++;
      }

      console.log(`[CRON] Monthly bills generated: ${billsCreated}`);
    } catch (err) {
      console.error('[CRON] Bill generation error:', err.message);
    }
  });

  // ── Mark missed pickups daily at 11pm WAT ───────────────────
  cron.schedule('0 22 * * *', async () => {
    try {
      const now = new Date();
      const result = await prisma.pickupSchedule.updateMany({
        where: {
          pickupDate: { lt: now },
          status: 'scheduled',
        },
        data: { status: 'missed' },
      });
      if (result.count > 0) {
        console.log(`[CRON] Marked ${result.count} schedules as missed`);
      }
    } catch (err) {
      console.error('[CRON] Mark missed error:', err.message);
    }
  });
}

module.exports = { startCronJobs };
