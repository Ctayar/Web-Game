const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const questions = require("../data/questions");


function formatQuestion(question) {
  return {
    ...question,
    date: question.date.toISOString().split("T")[0],
    keywords: question.keywords.map((k) => k.name),
  };
}

// GET /api/questions/,/api/questions?keyword=http

router.get("/", async(req, res) => {
    const { keyword } = req.query;
      const where = keyword
    ? { keywords: { some: { name: keyword } } }
    : {};

  const questions = await prisma.question.findMany({
    where,
    include: { keywords: true },
    orderBy: { id: "asc" },
  });

  res.json(questions.map(formatQuestion));
});


// GET /api/questions.:questionId
router.get("/:questionId", async (req, res) => {
    const questionId = Number(req.params.questionId);
    const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { keywords: true },
  });


  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  res.json(formatQuestion(question));
});

// POST/questions
// Create a new post
router.post("/", async (req, res) => {
  const { question, answer, keywords } = req.body;

  if (!question || !answer || !content) {
    return res.status(400).json({
      message: "Question and answer are required"
    });
  }

  const keywordsArray = Array.isArray(keywords) ? keywords : [];

  const newQuestion = await prisma.question.create({
    data: {
      question, answer, date: new Date(date), content,
      keywords: {
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw }, create: { name: kw },
        })), },
    },
    include: { keywords: true },
  });

  res.status(201).json(formatQuestion(newQuestion));
});

// PUT /questions/:questionsId
// Edit a question
router.put("/:questionId", async (req, res) => {
  const questionId = Number(req.params.questionId);
  const { question, answer, content, keywords } = req.body;

 const existingQestion = await prisma.question.findUnique({ where: { id: questionId } });
  if (!existingQuestion) {
    return res.status(404).json({ message: "Question not found" });
  }

  if (!question || !answer || !content) {
    return res.status(400).json({ msg: "question, answer and content are mandatory" });
  }

  const keywordsArray = Array.isArray(keywords) ? keywords : [];
  const updatedQuestion = await prisma.question.update({
    where: { id: questionId },
    data: {
      answer, question, date: new Date(date), content,
      keywords: {
        set: [],
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw },
          create: { name: kw },
        })),
      },
    },
    include: { keywords: true },
  });
  res.json(formatQuestion(updatedQuestion));
});

// DELETE /posts/:postId
// Delete a post
router.delete("/:questionId", async(req, res) => {
  const questionId = Number(req.params.questionId);
  const post = await prisma.question.findUnique({
    where: { id: questionId },
    include: { keywords: true },
  });

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  await prisma.question.delete({ where: { id: questionId } });

  res.json({
    message: "Question deleted successfully",
    question: formatPost(question),
  });
});

module.exports = router;