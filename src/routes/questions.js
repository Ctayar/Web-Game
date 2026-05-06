const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const questions = require("../data/questions");
const authenticate = require("../Middleware/auth");
const isOwner = require("../Middleware/isOwner");
const path = require("path");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "public", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const newName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, newName)
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
   } else {
      cb(new Error("Only image files are allowed"));
   }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

function parseKeywords(keywords) {
  if (Array.isArray(keywords)) return keywords;
  if (typeof keywords === "string") {
    return keywords.split(",").map((k) => k.trim()).filter(Boolean);
  }
  return [];
}

function formatQuestion(question) {
  return {
    ...question,
    date: question.date.toISOString().split("T")[0],
    keywords: question.keywords.map((k) => k.name),
    userName: question.user ? question.user.name : null,
    attemptCount: question._count?.attempts ?? 0,
    correct: question.attempts ? question.attempts.length > 0 : false,
    user: undefined,
    attempts: undefined,
    _count: undefined,
  };
}

router.use(authenticate);
// GET /api/questions/,/api/questions?keyword=http&page=1&limit=5

router.get("/", async(req, res) => {
    const { keyword } = req.query;
      const where = keyword
    ? { keywords: { some: { name: keyword } } }
    : {};

const page = Math.max(1, parseInt(req.query.page) || 1);
const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
const skip = (page - 1) * limit;

 const [filteredQuestions, total] = await Promise.all([
    prisma.question.findMany({
        where,
        include: { 
          keywords: true, 
          user: true, 
          attempts: {where : { userId: req.user.userId }, take: 1 },
          _count: { select: { attempts: true } },
        },
        orderBy: { id: "asc" },
        skip,
        take: limit,
    }),
    prisma.question.count({ where }),
]);

  res.json({
    data: filteredQuestions.map(formatQuestion),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
})
});


// GET /api/questions.:questionId
router.get("/:questionId", async (req, res) => {
    const questionId = Number(req.params.questionId);
    const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { keywords: true, 
      user: true,
      attempts: { where: { userId: req.user.userId }, take: 1 },
            _count: { select: { attempts: true } },
     },
  });


  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  res.json(formatQuestion(question));
});

// POST/questions
// Create a new post
router.post("/", upload.single("image"), async (req, res, next) => {
  try {
    const { question, answer, keywords } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        message: "Question and answer are required",
      });
    }

    const keywordsArray = parseKeywords(keywords);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const newQuestion = await prisma.question.create({
      data: {
        question,
        answer,
        // satisfy Prisma requirements
        date: new Date(),
        content: "",
        imageUrl,
        userId: req.user.userId,
        keywords: {
          connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
      include: { keywords: true, user: true, attempts: true, _count: { select: { attempts: true } } },
    });

    res.status(201).json(formatQuestion(newQuestion));
  } catch (err) {
    next(err);
  }
});


// PUT /questions/:questionsId
// Edit a question
router.put("/:questionId", isOwner, upload.single("image"), async (req, res, next) => {
  try {
    const questionId = Number(req.params.questionId);
    const { question, answer, keywords } = req.body;

    const existingQuestion = await prisma.question.findUnique({ where: { id: questionId } });
    if (!existingQuestion) {
      return res.status(404).json({ message: "Question not found" });
    }

    if (!question || !answer) {
      return res.status(400).json({ msg: "question and answer are mandatory" });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : existingQuestion.imageUrl;
    const keywordsArray = parseKeywords(keywords);

    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        question,
        answer,
        // keep existing date/content so we don't break Prisma
        date: existingQuestion.date,
        content: existingQuestion.content,
        imageUrl,
        keywords: {
          set: [],
          connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
      include: { keywords: true, user: true, attempts: true, _count: { select: { attempts: true } } },
    });

    res.json(formatQuestion(updatedQuestion));
  } catch (err) {
    next(err);
  }
});


// DELETE /questions/:questionId
// Delete a question
router.delete("/:questionId", isOwner, async(req, res) => {
  const questionId = Number(req.params.questionId);
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { keywords: true, user: true },
  });

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  await prisma.question.delete({ where: { id: questionId } });

  res.json({
    message: "Question deleted successfully",
    question: formatQuestion(question),
  });
});


//POST/api/questions/:questionId/attempt
router.post("/:questionId/play", async (req, res) => {
  const questionId = Number(req.params.questionId);
  const { answer } = req.body;

  if (!answer) {
    return res.status(400).json({ error: "Answer is required" });
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  const userAnswer = answer.trim().toLowerCase();
  const correctAnswer = question.answer.trim().toLowerCase();

  const isCorrect = userAnswer === correctAnswer;

  await prisma.attempt.upsert({
    where: { userId_questionId: { userId: req.user.userId, questionId } },
    update: { correct: isCorrect },
    create: { userId: req.user.userId, questionId, correct: isCorrect },
  });

  res.json({
    correct: isCorrect,
    correctAnswer: question.answer, 
  });
});


router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError ||
        err?.message === "Only image files are allowed") {
        return res.status(400).json({ msg: err.message });
    }
    next(err);
});

module.exports = router;