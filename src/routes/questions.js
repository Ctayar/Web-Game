const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const questions = require("../data/questions");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const path = require("path");
const multer = require("multer");
const {NotFoundError, ValidationError} = require("../lib/errors");
const {z} = require("zod");

const QuestionInput = z.object({
    question: z.string().min(1),
    answer: z.string().min(1),
    keywords: z.union([z.string(),z.array(z.string())]).optional()
});

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
    keywords: (question.keywords ?? []).map((k) => k.name),
    userName: question.user ? question.user.name : null,
    attemptCount: question._count?.attempts ?? 0,
    correct: question.attempts?.[0]?.correct ?? false,
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
    throw new NotFoundError("Question not found");
  }

  res.json(formatQuestion(question));
});

// POST/questions
// Create a new question
router.post("/", upload.single("image"), async (req, res, next) => {
  try {
    const { question, answer, keywords } = QuestionInput.parse(req.body);
    const keywordsArray = parseKeywords(keywords);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const newQuestion = await prisma.question.create({
      data: {
        question,
        answer,
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
  try{
    const questionId = Number(req.params.questionId);
    const { question, answer, keywords } = QuestionInput.parse(req.body);
    
const existingQuestion = await prisma.question.findUnique({
  where: { id: questionId },
});

    if (!question || !answer ) {
      throw new ValidationError("Question and answer are mandatory");
    }
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : existingQuestion.imageUrl;
    const keywordsArray = parseKeywords(keywords);

    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        question,
        answer,
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
  } catch (err){
    next(err);
  }
  });


// DELETE /questions/:questionId
// Delete a question
router.delete("/:questionId", isOwner, async(req, res, next) => {
  try {
  const questionId = Number(req.params.questionId);
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { keywords: true, user: true },
  });

  if (!question) {
   throw new NotFoundError("Question not found");
  }

  await prisma.question.delete({ where: { id: questionId } });

  res.json({
    message: "Question deleted successfully",
    question: formatQuestion(question),
  });
} catch (err) {
  next(err);
}
});


//POST/api/questions/:questionId/attempt
router.post("/:questionId/attempt", async (req, res, next) => {
  try {
    const questionId = Number(req.params.questionId);
    const { answer } = req.body;

    if (!answer) {
      throw new ValidationError("Answer is required");
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundError("Question not found");
    }

    const isCorrect =
      answer.trim().toLowerCase() === question.answer.trim().toLowerCase();

    await prisma.attempt.upsert({
      where: {
        userId_questionId: {
          userId: req.user.userId,
          questionId,
        },
      },
      update: { correct: isCorrect },
      create: {
        userId: req.user.userId,
        questionId,
        correct: isCorrect,
      },
    });

    return res.status(200).json({ correct: Boolean(isCorrect) });
  } catch (err) {
    next(err);
  }
});


router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError ||
        err?.message === "Only image files are allowed") {
        throw new ValidationError(err.message);
    }
    next(err);
});

module.exports = router;