const prisma = require("../lib/prisma");

async function isOwner(req, res, next) {
  try {
    const questionId = Number(req.params.questionId);

    if (!questionId || Number.isNaN(questionId)) {
      return res.status(400).json({ message: "Invalid question id" });
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const userId = req.user.userId;

    if (question.userId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = isOwner;