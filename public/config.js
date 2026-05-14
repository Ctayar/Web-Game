const CONFIG = {
  API_URL: "",
  ROUTES: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    QUESTIONS: "/api/questions",
    PLAY: "/api/questions/:questionId/play",
  },
  FIELDS: {
    LOGIN: ["email", "password"],
    REGISTER: ["email", "password", "name"],
    QUESTION: ["question", "answer", "keywords", "image"],
  },
  POSTS_PER_PAGE: 5,
  STORAGE_KEY: "jwt_token",
  API_FIELDS: {
    ATTEMPT_COUNT: "attemptCount",
    ATTEMPTS: "attempts",
    CORRECT: "correct",
  }
};