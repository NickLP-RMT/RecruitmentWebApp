const APP_CONFIG = window.APP_CONFIG || {};
const selectedJob = { id: "" };
const currentTestAnswers = [];
let sampleTests = [];
let latestScore = null;

const FALLBACK_TESTS = [
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

function el(id) {
  return document.getElementById(id);
}

function hasApi() {
  return !!APP_CONFIG.apiEndpoint && APP_CONFIG.apiEndpoint.startsWith("https://");
}

async function api(action, payload = {}) {
  if (!hasApi()) throw new Error("API endpoint not configured");
  const res = await fetch(APP_CONFIG.apiEndpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action,
      token: APP_CONFIG.apiToken || "",
      payload
    })
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || "API error");
  }
  return data;
}

function pickJob(jobId) {
  selectedJob.id = jobId;
  el("jobSelected").textContent = `ตำแหน่งที่เลือก: ${jobId}`;
  document.querySelectorAll(".job-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.job === jobId);
  });
}

function renderTests() {
  const container = el("testContainer");
  container.innerHTML = "";
  sampleTests.forEach((q) => {
    const block = document.createElement("div");
    block.className = "card";
    block.innerHTML = `<strong>${q.question}</strong>`;
    q.choices.forEach((choice) => {
      const label = document.createElement("label");
      label.className = "consent";
      label.innerHTML = `<input type="radio" name="${q.id}" value="${choice}" /> ${choice}`;
      block.appendChild(label);
    });
    container.appendChild(block);
  });
}

async function loadTests() {
  if (hasApi() && APP_CONFIG.useApiForTests) {
    try {
      const data = await api("getTests");
      sampleTests = data.tests || FALLBACK_TESTS;
      renderTests();
      return;
    } catch (_) {}
  }
  sampleTests = FALLBACK_TESTS;
  renderTests();
}

function readTestAnswers() {
  return sampleTests.map((q) => {
    const selected = document.querySelector(`input[name="${q.id}"]:checked`);
    return { questionId: q.id, selectedAnswer: selected ? selected.value : "" };
  });
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

  for (const q of sampleTests) {
    if (q.score > 0) maxScore += q.score;
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

function scoreTest() {
  const answers = readTestAnswers();
  latestScore = scoreAnswers(answers);
  currentTestAnswers.length = 0;
  answers.forEach((x) => currentTestAnswers.push(x));
  el("scoreResult").innerHTML = `คะแนน: <span class="ok">${latestScore.totalScore}/${latestScore.maxScore}</span> | ผ่านเกณฑ์: ${latestScore.passed ? "ผ่าน" : "ไม่ผ่าน"}`;
}

async function submitApplication(event) {
  event.preventDefault();
  if (!hasApi()) {
    el("applyResult").textContent = "ยังไม่ได้ตั้งค่า Apps Script API (แก้ docs/config.js ก่อน)";
    return;
  }
  if (!selectedJob.id) {
    el("applyResult").textContent = "กรุณาเลือกตำแหน่งงานก่อน";
    return;
  }

  const form = event.target;
  const formData = new FormData(form);
  const fileInput = document.getElementById("attachments");
  const attachments = Array.from(fileInput.files || []).map((f) => ({
    fileName: f.name,
    size: f.size
  }));

  const payload = {
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    education: formData.get("education"),
    experience: formData.get("experience"),
    skills: formData.get("skills"),
    appliedJobId: selectedJob.id,
    attachments,
    consentAccepted: formData.get("consentAccepted") === "on",
    testResult: latestScore
      ? { ...latestScore, answers: currentTestAnswers, submittedAt: new Date().toISOString() }
      : null
  };

  try {
    const data = await api("submitApplication", payload);
    form.reset();
    latestScore = null;
    el("scoreResult").textContent = "";
    el("applyResult").innerHTML = `สมัครเรียบร้อย เลขอ้างอิง: <strong>${data.referenceNo}</strong>`;
  } catch (error) {
    el("applyResult").textContent = error.message || "ไม่สามารถส่งใบสมัครได้";
  }
}

document.querySelectorAll(".job-btn").forEach((btn) => {
  btn.addEventListener("click", () => pickJob(btn.dataset.job));
});
el("scoreBtn").addEventListener("click", scoreTest);
el("applicationForm").addEventListener("submit", submitApplication);
loadTests();
