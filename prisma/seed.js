const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();


const seedQuestions = [
  {
    id: 1,
    question: "What is the capital of Finland?",
    answer: "Helsinki",
    date: new Date("2026-03-20"),
    content: "Geography quiz about Nordic countries.",
    keywords: [
        "capital",
        "Finland",
        "Helsinki"
    ]
  },
  {
    id: 2,
    question: "What is the capital of India?",
    answer: "New Delhi",
    date: new Date("2026-03-22"),
    content: "Geography quiz about Asian countries.",
    keywords: [
        "India",
        "New Delhi",
        "capital"
    ]
  },
  {
    id: 3,
    question: "What is the capital of France?",
    answer: "Paris",
    date: new Date("2026-03-26"),
    content: "Geography quiz about European countries.",
    keywords: [
        "Capital",
        "Paris",
        "France"
    ]
  },
  {
    id: 4,
    question: "What is the capital of Spain?",
    answer: "Madrid",
    date: new Date("2026-03-21"),
    content: "Geography quiz about European countries.",
    keywords: [
        "Madrid",
        "Spain",
        "Capital"
    ]
  }
];

async function main() {
  await prisma.question.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.user.deleteMany();

  // Create a default user
  const hashedPassword = await bcrypt.hash("1234", 10);
  const user = await prisma.user.create({
    data: {
      email: "admin@example.com",
      password: hashedPassword,
      name: "Admin User",
    },
  });

  console.log("Created user:", user.email);

  for (const question of seedQuestions) {
    await prisma.question.create({
      data: {
        question: question.question,
        answer: question.answer,
        date: question.date,
        content: question.content,
        userId: user.id,
        keywords: {
          connectOrCreate: question.keywords.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
    });
  }

  console.log("Seed data inserted successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
