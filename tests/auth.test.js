const bcrypt = require("bcrypt")
const { resetDb, request, app, prisma } = require("./helpers");

beforeEach(resetDb);

it("registers, hashes the password, returns a token", async () => {
  const res = await request(app).post("/api/auth/register").send({ email: "a@test.io", password: "pw12345", name: "A" });

  expect(res.status).toBe(201);
  expect(res.body.token).toEqual(expect.any(String));

  const user = await prisma.user.findUnique({ where: { email: "a@test.io" } });
  expect(user.password).not.toBe("pw12345");                          // not plain
  expect(await bcrypt.compare("pw12345", user.password)).toBe(true);  // valid hash
});

describe("Auth unhappy paths", () => {
  it("fails to register with missing fields", async () => {
  const res = await request(app).post("/api/auth/register").send({ email: "missing-fields@test.io" });

  expect(res.status).toBe(400);
});

it("fails to login with missing fields", async () => {
  const res = await request(app).post("/api/auth/login").send({ email: "testing-missing-fields-random-email@test.io" });
  expect(res.status).toBe(400);
});
it("fails to login with non-existent email", async () => {
  const res = await request(app).post("/api/auth/login").send({ email: "non@test.io", password: "pw12345" });
  expect(res.status).toBe(401);
});
it("fails to login with wrong password", async () => {
  await request(app).post("/api/auth/register").send({ email: "wrong-password@test.io", password: "correct", name: "A"});
  const res = await request(app).post("/api/auth/login").send({ email: "wrong-password@test.io", password: "wrong"});
  expect(res.status).toBe(401);
});

it("returns 401 for an invalid or expired token", async () => {
  const res = await request(app).get("/api/questions")
  .set("authorization", "Bearer invalid.token");
  
  expect(res.status).toBe(401);
  expect(res.body.message).toMatch(/invalid|expired/i);
});
});