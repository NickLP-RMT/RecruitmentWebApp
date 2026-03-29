const APP_CONFIG = window.APP_CONFIG || {};

function e(id) {
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

function statusOptions(current) {
  const statuses = ["submitted", "screening", "passed_screening", "interview", "rejected", "hired"];
  return statuses
    .map((s) => `<option value="${s}" ${s === current ? "selected" : ""}>${s}</option>`)
    .join("");
}

async function updateStatus(id, status) {
  try {
    await api("updateStatus", { id, status });
    loadApplicants();
  } catch (error) {
    alert(error.message || "Update status failed");
  }
}

async function loadApplicants() {
  if (!hasApi()) {
    e("applicantsBody").innerHTML =
      '<tr><td colspan="7">ยังไม่ได้ตั้งค่า Apps Script API (แก้ docs/config.js ก่อน)</td></tr>';
    return;
  }
  const filters = {
    q: e("q").value || "",
    job: e("job").value || "",
    status: e("status").value || ""
  };
  try {
    const data = await api("listApplicants", filters);
    const rows = data.applicants || [];
    const body = e("applicantsBody");
    body.innerHTML = rows
      .map((x) => {
        const scoreText =
          x.totalScore !== "" && x.totalScore !== null && x.totalScore !== undefined
            ? `${x.totalScore}/${x.maxScore || "-"}`
            : "-";
        return `
          <tr>
            <td>${x.refNo || "-"}</td>
            <td>${x.fullName || "-"}</td>
            <td>${x.email || "-"}</td>
            <td>${x.appliedJobId || "-"}</td>
            <td>${scoreText}</td>
            <td>${x.status || "-"}</td>
            <td>
              <select data-id="${x.id}" class="status-select">
                ${statusOptions(x.status)}
              </select>
            </td>
          </tr>
        `;
      })
      .join("");

    document.querySelectorAll(".status-select").forEach((sel) => {
      sel.addEventListener("change", () => updateStatus(sel.dataset.id, sel.value));
    });
  } catch (error) {
    e("applicantsBody").innerHTML = `<tr><td colspan="7">${error.message}</td></tr>`;
  }
}

e("searchBtn").addEventListener("click", loadApplicants);
loadApplicants();
