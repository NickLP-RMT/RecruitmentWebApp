const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "applications.json");
const GOOGLE_SHEETS_WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL || "";

const STATUS_FLOW = new Set([
  "submitted",
  "screening",
  "passed_screening",
  "interview",
  "rejected",
  "hired"
]);

const SAMPLE_TESTS = [
  {
    id: "logic-001",
    category: "logic",
    question: "2, 4, 8, 16, ?",
    choices: ["18", "24", "32", "36"],
    answer: "32",
    score: 2
  },
  {
    id: "math-001",
    category: "aptitude",
    question: "15% ของ 200 เท่ากับเท่าไร",
    choices: ["25", "30", "35", "40"],
    answer: "30",
    score: 2
  },
  {
    id: "lang-001",
    category: "language",
    question: "Choose the correct sentence.",
    choices: [
      "She don't like meetings.",
      "She doesn't likes meetings.",
      "She doesn't like meetings.",
      "She not like meetings."
    ],
    answer: "She doesn't like meetings.",
    score: 2
  },
  {
    id: "personality-001",
    category: "personality",
    question: "ฉันสามารถทำงานภายใต้แรงกดดันได้ดี (1-5)",
    choices: ["1", "2", "3", "4", "5"],
    answer: null,
    score: 0
  },
  {
    id: "role-it-001",
    category: "role_specific",
    question: "SQL คำสั่งใดใช้ดึงข้อมูล",
    choices: ["INSERT", "SELECT", "UPDATE", "DELETE"],
    answer: "SELECT",
    score: 2
  }
];

async function ensureDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify({ applicants: [] }, null, 2), "utf8");
  }
}

async function readDb() {
  await ensureDb();
  const content = await fs.readFile(DB_PATH, "utf8");
  return JSON.parse(content);
}

async function writeDb(db) {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function json(res, code, payload) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function scoreAnswers(answers = []) {
  let totalScore = 0;
  let maxScore = 0;
  const breakdown = {
    logic: 0,
    aptitude: 0,
    language: 0,
    personality: 0,
    role_specific: 0
  };

  for (const q of SAMPLE_TESTS) {
    if (q.score > 0) {
      maxScore += q.score;
    }
    const answer = answers.find((a) => a.questionId === q.id);
    if (!answer) continue;

    if (q.category === "personality") {
      const level = Number(answer.selectedAnswer || 0);
      if (!Number.isNaN(level)) breakdown.personality += level;
      continue;
    }

    if (answer.selectedAnswer === q.answer) {
      totalScore += q.score;
      breakdown[q.category] += q.score;
    }
  }

  const passed = maxScore > 0 ? totalScore / maxScore >= 0.6 : false;
  return { totalScore, maxScore, passed, breakdown };
}

async function forwardToGoogleSheets(payload) {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return;
  try {
    await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error("Google Sheets webhook failed:", error.message);
  }
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/tests/sample") {
    return json(res, 200, { tests: SAMPLE_TESTS });
  }

  if (req.method === "POST" && url.pathname === "/api/applications") {
    const body = await parseBody(req);
    if (!body.fullName || !body.email || !body.appliedJobId || !body.consentAccepted) {
      return json(res, 400, { error: "Missing required fields or consent." });
    }

    const db = await readDb();
    const refNo = `APP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(
      db.applicants.length + 1
    ).padStart(4, "0")}`;
    const now = new Date().toISOString();
    const app = {
      id: randomUUID(),
      refNo,
      fullName: body.fullName,
      phone: body.phone || "",
      email: body.email,
      address: body.address || "",
      education: body.education || "",
      experience: body.experience || "",
      skills: body.skills || "",
      appliedJobId: body.appliedJobId,
      attachments: body.attachments || [],
      testResult: body.testResult || null,
      consentAccepted: !!body.consentAccepted,
      status: "submitted",
      createdAt: now,
      updatedAt: now
    };

    db.applicants.push(app);
    await writeDb(db);
    await forwardToGoogleSheets({ type: "new_application", application: app });

    return json(res, 201, {
      message: "Application submitted successfully.",
      referenceNo: refNo
    });
  }

  if (req.method === "POST" && url.pathname === "/api/tests/score") {
    const body = await parseBody(req);
    const result = scoreAnswers(body.answers || []);
    return json(res, 200, result);
  }

  if (req.method === "GET" && url.pathname === "/api/admin/applicants") {
    const db = await readDb();
    const job = url.searchParams.get("job") || "";
    const status = url.searchParams.get("status") || "";
    const q = (url.searchParams.get("q") || "").toLowerCase();

    let rows = db.applicants;
    if (job) rows = rows.filter((x) => x.appliedJobId === job);
    if (status) rows = rows.filter((x) => x.status === status);
    if (q) rows = rows.filter((x) => `${x.fullName} ${x.email} ${x.refNo}`.toLowerCase().includes(q));

    return json(res, 200, { applicants: rows });
  }

  if (req.method === "PUT" && url.pathname.startsWith("/api/admin/applicants/")) {
    const id = url.pathname.split("/").pop();
    const body = await parseBody(req);
    if (!STATUS_FLOW.has(body.status)) {
      return json(res, 400, { error: "Invalid status." });
    }

    const db = await readDb();
    const target = db.applicants.find((x) => x.id === id);
    if (!target) return json(res, 404, { error: "Applicant not found." });

    target.status = body.status;
    target.updatedAt = new Date().toISOString();
    await writeDb(db);
    await forwardToGoogleSheets({ type: "status_changed", application: target });

    return json(res, 200, { message: "Status updated.", applicant: target });
  }

  return notFound(res);
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = path.join(PUBLIC_DIR, url.pathname === "/" ? "index.html" : url.pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) return notFound(res);

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
    const ext = path.extname(filePath).toLowerCase();
    const map = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8"
    };
    const contentType = map[ext] || "application/octet-stream";
    const data = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch {
    notFound(res);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }
    await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
