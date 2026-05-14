const { resetDb, registerAndLogin, createQuestion, request, app } = require("./helpers");
beforeEach(resetDb);
describe("isOwner middleware", () => {
  it.skip("allows the owner to update their question", async () => {
    const token = await registerAndLogin("owner2@test.io", "Owner2");

    const q = await createQuestion(token, { question: "Q?", answer: "A" });
    const questionId = q.id; 

    const res = await request(app)
    .put(`/api/questions/${questionId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({question: "Updated", answer: "A"});

    expect(res.status).toBe(200);
  });

  it.skip("blocks non-owner of question with 403", async () => {
    const ownerToken = await registerAndLogin("owner2@test.io", "Owner2");

    const q = await createQuestion(ownerToken, { question: "Q", answer: "A" });
    const questionId = q.id;

    const otherToken = await registerAndLogin("other@test.io", "other");

    const res = await request(app).put(`/api/questions/${questionId}`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({question: "Hack", answer: "A"});

    expect(res.status).toBe(403);
  });

  it("returns 404 if question does not exist", async () => {
    const token = await registerAndLogin("x@test.io", "X");
    const res = await request(app)
    .put(`/api/questions/9999`)
    .set("Authorization", `Bearer ${token}`)
    .send({question: "No", answer: "No"});

    expect(res.status).toBe(404);
  });

});