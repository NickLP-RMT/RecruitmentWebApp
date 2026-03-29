const selectedJob = { id: "" };
const currentTestAnswers = [];
let sampleTests = [];
let latestScore = null;

function el(id) {
  return document.getElementById(id);
}

function pickJob(jobId) {
  selectedJob.id = jobId;
  el("jobSelected").textContent = `ตำแหน่งที่เลือก: ${jobId}`;
  document.querySelectorAll(".job-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.job === jobId);
  });
}

async function loadTests() {
  const res = await fetch("/api/tests/sample");
  const data = await res.json();
  sampleTests = data.tests || [];

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

function readTestAnswers() {
  return sampleTests.map((q) => {
    const selected = document.querySelector(`input[name="${q.id}"]:checked`);
    return { questionId: q.id, selectedAnswer: selected ? selected.value : "" };
  });
}

async function scoreTest() {
  const answers = readTestAnswers();
  const res = await fetch("/api/tests/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers })
  });
  const data = await res.json();
  latestScore = data;
  currentTestAnswers.length = 0;
  answers.forEach((x) => currentTestAnswers.push(x));
  el("scoreResult").innerHTML = `คะแนน: <span class="ok">${data.totalScore}/${data.maxScore}</span> | ผ่านเกณฑ์: ${data.passed ? "ผ่าน" : "ไม่ผ่าน"}`;
}

async function submitApplication(event) {
  event.preventDefault();
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

  const res = await fetch("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();

  if (!res.ok) {
    el("applyResult").textContent = data.error || "ไม่สามารถส่งใบสมัครได้";
    return;
  }

  form.reset();
  latestScore = null;
  el("scoreResult").textContent = "";
  el("applyResult").innerHTML = `สมัครเรียบร้อย เลขอ้างอิง: <strong>${data.referenceNo}</strong>`;
}

document.querySelectorAll(".job-btn").forEach((btn) => {
  btn.addEventListener("click", () => pickJob(btn.dataset.job));
});

el("scoreBtn").addEventListener("click", scoreTest);
el("applicationForm").addEventListener("submit", submitApplication);

loadTests();
