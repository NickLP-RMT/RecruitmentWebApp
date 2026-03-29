function e(id) {
  return document.getElementById(id);
}

function statusOptions(current) {
  const statuses = ["submitted", "screening", "passed_screening", "interview", "rejected", "hired"];
  return statuses
    .map((s) => `<option value="${s}" ${s === current ? "selected" : ""}>${s}</option>`)
    .join("");
}

async function updateStatus(id, status) {
  const res = await fetch(`/api/admin/applicants/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "Update status failed");
    return;
  }
  loadApplicants();
}

async function loadApplicants() {
  const q = encodeURIComponent(e("q").value || "");
  const job = encodeURIComponent(e("job").value || "");
  const status = encodeURIComponent(e("status").value || "");
  const res = await fetch(`/api/admin/applicants?q=${q}&job=${job}&status=${status}`);
  const data = await res.json();
  const rows = data.applicants || [];
  const body = e("applicantsBody");

  body.innerHTML = rows
    .map((x) => {
      const scoreText =
        x.testResult && typeof x.testResult.totalScore === "number"
          ? `${x.testResult.totalScore}/${x.testResult.maxScore}`
          : "-";
      return `
        <tr>
          <td>${x.refNo}</td>
          <td>${x.fullName}</td>
          <td>${x.email}</td>
          <td>${x.appliedJobId}</td>
          <td>${scoreText}</td>
          <td>${x.status}</td>
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
}

e("searchBtn").addEventListener("click", loadApplicants);
loadApplicants();
