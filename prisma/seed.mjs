import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL || "postgresql://hunterlite:hunterlite@localhost:5432/hunterlite";
const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const topics = [
  "Условия банкротства физического лица",
  "Последствия банкротства",
  "Имущество должника",
  "Процедура и сроки",
  "Стоимость и риски",
  "Возражения клиента",
  "Безопасные формулировки юриста",
  "Ипотечное жильё при банкротстве",
  "Долги, которые не списываются",
];

const demoPasswordHash =
  "scrypt:hunterlite-demo-salt:9ab4b8fc3f6510c3c97b524a88a9cc2ae544e23c6dbbe6044e2df4d942995d9864a01719ad150610c936979e55f4be23c4f217ff5854b81ef2cea4d3c23ec623";

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "hunterlite-demo" },
    update: {},
    create: {
      name: "HUNTERLITE Demo",
      slug: "hunterlite-demo",
      status: "active",
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: "a.petrova@hunterlite.ru" },
    update: {},
    create: {
      email: "a.petrova@hunterlite.ru",
      fullName: "Анна Петрова",
      status: "active",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@hunterlite.ru" },
    update: {},
    create: {
      email: "manager@hunterlite.ru",
      fullName: "Ольга Литвинова",
      status: "active",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@hunterlite.ru" },
    update: {},
    create: {
      email: "admin@hunterlite.ru",
      fullName: "Павел Громов",
      status: "active",
    },
  });

  for (const [userId, role] of [
    [employee.id, "employee"],
    [manager.id, "manager"],
    [admin.id, "admin"],
  ]) {
    await prisma.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId,
        },
      },
      update: { role },
      create: {
        organizationId: organization.id,
        userId,
        role,
        status: "active",
      },
    });
  }

  for (const user of [employee, manager, admin]) {
    await prisma.authAccount.upsert({
      where: {
        provider_providerUserId: {
          provider: "password",
          providerUserId: user.email,
        },
      },
      update: {
        passwordHash: demoPasswordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      create: {
        userId: user.id,
        provider: "password",
        providerUserId: user.email,
        passwordHash: demoPasswordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  const createdTopics = [];
  for (const title of topics) {
    const existingTopic = await prisma.trainingTopic.findFirst({
      where: {
        organizationId: organization.id,
        title,
      },
    });

    const topic =
      existingTopic ||
      (await prisma.trainingTopic.create({
        data: {
          organizationId: organization.id,
          title,
          isActive: true,
        },
      }));

    createdTopics.push(topic);
  }

  const mainTopic = createdTopics.find((topic) => topic.title === "Имущество должника") || createdTopics[0];

  await prisma.trainingSession.deleteMany({
    where: {
      organizationId: organization.id,
      userId: employee.id,
      startedAt: new Date("2026-04-27T09:00:00.000Z"),
    },
  });

  await prisma.examAttempt.deleteMany({
    where: {
      organizationId: organization.id,
      userId: employee.id,
      startedAt: new Date("2026-04-28T09:00:00.000Z"),
    },
  });

  await prisma.weakTopic.deleteMany({
    where: {
      organizationId: organization.id,
      userId: employee.id,
      topicId: mainTopic.id,
      recommendation: "Повторить блок про ипотечное жильё",
    },
  });

  await prisma.notification.deleteMany({
    where: {
      organizationId: organization.id,
      userId: employee.id,
      title: {
        in: ["Назначен экзамен", "Ежедневная тренировка"],
      },
    },
  });

  await prisma.consent.deleteMany({
    where: {
      organizationId: organization.id,
      userId: employee.id,
      version: "2026-05-14",
    },
  });

  await prisma.consent.create({
    data: {
      organizationId: organization.id,
      userId: employee.id,
      version: "2026-05-14",
      acceptedAt: new Date(),
    },
  });

  await prisma.trainingSession.create({
    data: {
      organizationId: organization.id,
      userId: employee.id,
      topicId: mainTopic.id,
      mode: "talk",
      difficulty: "medium",
      score: 84,
      status: "completed",
      startedAt: new Date("2026-04-27T09:00:00.000Z"),
      completedAt: new Date("2026-04-27T09:25:00.000Z"),
      messages: {
        create: [
          {
            organizationId: organization.id,
            sender: "ai",
            content: "Здравствуйте. Я слышал, что после банкротства у меня заберут вообще всё имущество. Это так?",
          },
          {
            organizationId: organization.id,
            sender: "user",
            content: "Нет, не всё имущество подлежит реализации. Всё зависит от вашей конкретной ситуации.",
          },
        ],
      },
    },
  });

  await prisma.examAttempt.create({
    data: {
      organizationId: organization.id,
      userId: employee.id,
      topicId: mainTopic.id,
      score: 76,
      passingScore: 70,
      status: "passed",
      startedAt: new Date("2026-04-28T09:00:00.000Z"),
      completedAt: new Date("2026-04-28T09:40:00.000Z"),
    },
  });

  await prisma.weakTopic.create({
    data: {
      organizationId: organization.id,
      userId: employee.id,
      topicId: mainTopic.id,
      errorsCount: 38,
      recommendation: "Повторить блок про ипотечное жильё",
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        organizationId: organization.id,
        userId: employee.id,
        type: "exam",
        title: "Назначен экзамен",
        body: "Аттестация по теме «Имущество должника» — до 5 мая.",
      },
      {
        organizationId: organization.id,
        userId: employee.id,
        type: "training",
        title: "Ежедневная тренировка",
        body: "Сегодня нужно пройти одну тренировку по слабой теме.",
      },
    ],
  });

  await prisma.systemSetting.upsert({
    where: {
      organizationId_key: {
        organizationId: organization.id,
        key: "passing_score",
      },
    },
    update: { value: 70 },
    create: {
      organizationId: organization.id,
      key: "passing_score",
      value: 70,
    },
  });

  const existingScript = await prisma.callScript.findFirst({
    where: {
      organizationId: organization.id,
      title: "Базовая консультация по имуществу должника",
    },
  });

  if (!existingScript) {
    await prisma.callScript.create({
      data: {
        organizationId: organization.id,
        title: "Базовая консультация по имуществу должника",
        clientProfile: {
          name: "Алексей",
          situation: "переживает, что при банкротстве потеряет всё имущество",
        },
        nodes: {
          create: [
            {
              clientReplica: "Здравствуйте. Я слышал, что после банкротства у меня заберут вообще всё имущество. Это правда?",
              answerFormat: "text_manual",
              keywordRules: {
                requires: ["не всё", "имущество"],
                forbids: ["гарантируем", "точно спишут"],
              },
            },
            {
              clientReplica: "А если у меня единственное жильё, его тоже могут продать?",
              answerFormat: "text_manual",
              keywordRules: {
                requires: ["единственное жильё", "ипотека"],
                forbids: ["никогда", "без вариантов"],
              },
            },
          ],
        },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
