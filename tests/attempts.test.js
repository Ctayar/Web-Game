const { resetDb, registerAndLogin, createQuestion, request, app, prisma } = require("./helpers");
beforeEach(resetDb);

describe.skip("Attempts", () => {
  it("returns correct: true for a correct answer", async () => {
    const token = await registerAndLogin("correct@test.io", "CorrectUser");
    const q = await createQuestion(token, { 
      question: "Capital of France?", 
      answer: "Paris" 
    });
    const questionId = q.id;

    const res = await request(app)
    .post(`/api/questions/${questionId}/play`)
    .set("Authorization", `Bearer ${token}`)
    .send({answer: "Paris"});

    expect(res.body.correct).toBe(true);
  });

  it.skip("returns correct: false for a wrong answer", async () => {
    const token = await registerAndLogin("wrong@test.io", "WrongUser");

    const q = await createQuestion(token, { 
      question: "2 + 2", 
      answer: "4" 
    });
    const questionId = q.id;
 
    const res = await request(app)
    .post(`/api/questions/${questionId}/play`)
    .set("Authorization", `Bearer ${token}`)
    .send({answer: "5"});

    expect(res.body.correct).toBe(false);
  });

  it("returns 401 without a token", async () => {
    const res = await request(app)
    .post("/api/questions/1/play")
    .send({answer: "anything"});

    expect(res.status).toBe(401);
  });
});