const DEFAULT_SETTINGS = {
  commissionRate: 10,
  minimumWithdrawalAmount: 5000,
  currency: 'NGN',
  customerServiceFee: 0,
};

function roundMoney(value) {
  return Number((Number(value || 0)).toFixed(2));
}

async function getPlatformSettings(prisma) {
  const settings = await prisma.$queryRaw`SELECT "key", "value" FROM "platform_settings"`;
  const map = Object.fromEntries((settings || []).map((s) => [s.key, s.value]));

  return {
    commissionRate: Number(map.commissionRate ?? DEFAULT_SETTINGS.commissionRate),
    minimumWithdrawalAmount: Number(map.minimumWithdrawalAmount ?? DEFAULT_SETTINGS.minimumWithdrawalAmount),
    currency: map.currency ?? DEFAULT_SETTINGS.currency,
    customerServiceFee: Number(map.customerServiceFee ?? DEFAULT_SETTINGS.customerServiceFee),
  };
}

async function ensurePlatformSettings(prisma) {
  const defaults = [
    { key: 'commissionRate', value: String(DEFAULT_SETTINGS.commissionRate), type: 'number', description: 'Platform commission percentage applied to successful bookings.' },
    { key: 'minimumWithdrawalAmount', value: String(DEFAULT_SETTINGS.minimumWithdrawalAmount), type: 'number', description: 'Minimum withdrawal amount in NGN.' },
    { key: 'currency', value: DEFAULT_SETTINGS.currency, type: 'string', description: 'Primary transaction currency.' },
    { key: 'customerServiceFee', value: String(DEFAULT_SETTINGS.customerServiceFee), type: 'number', description: 'Optional customer-facing service fee.' },
  ];

  for (const item of defaults) {
    await upsertPlatformSetting(prisma, item.key, item.value, item.type, item.description);
  }
  return getPlatformSettings(prisma);
}

async function upsertPlatformSetting(prisma, key, value, type = 'number', description = null) {
  await prisma.$executeRaw`
    INSERT INTO "platform_settings" ("key", "value", "type", "description", "createdAt", "updatedAt")
    VALUES (${key}, ${String(value)}, ${type}, ${description}, NOW(), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "value" = EXCLUDED."value",
      "type" = EXCLUDED."type",
      "description" = EXCLUDED."description",
      "updatedAt" = NOW()
  `;
}

function calculateBookingBreakdown(amount, commissionRate) {
  const charge = roundMoney(Number(amount || 0));
  const rate = Number(commissionRate || 0);
  const safeRate = Math.max(0, Math.min(rate, 100));
  const platformCommission = roundMoney((charge * safeRate) / 100);
  const collectorEarnings = roundMoney(charge - platformCommission);
  const totalAmount = charge;

  return {
    amount,
    totalAmount,
    commissionRate: safeRate,
    platformCommission,
    collectorEarnings,
    customerServiceFee: 0,
  };
}

module.exports = {
  DEFAULT_SETTINGS,
  ensurePlatformSettings,
  getPlatformSettings,
  upsertPlatformSetting,
  calculateBookingBreakdown,
  roundMoney,
};
