const API_BASE = "http://127.0.0.1:8000";
const $ = (id) => document.getElementById(id);
let selectedFiles = [];
let latestResults = [];

const fileInput = $("resumeFiles");
const dropZone = $("dropZone");
const analyzeBtn = $("analyzeBtn");

$("jobDescription").addEventListener("input", (e) => {
  $("charCount").textContent = `${e.target.value.length.toLocaleString()} characters`;
});

function addFiles(fileList) {
  const incoming = Array.from(fileList);
  const valid = incoming.filter(file => {
    const okType = /\.(pdf|docx)$/i.test(file.name);
    const okSize = file.size <= 10 * 1024 * 1024;
    if (!okType) showError(`${file.name}: only PDF and DOCX files are supported.`);
    else if (!okSize) showError(`${file.name}: file exceeds 10 MB.`);
    return okType && okSize;
  });
  const merged = [...selectedFiles, ...valid];
  selectedFiles = merged.filter((file, index) => merged.findIndex(other => other.name === file.name && other.size === file.size) === index).slice(0, 50);
  renderFileChips();
}
function renderFileChips() {
  $("fileChips").innerHTML = selectedFiles.length
    ? selectedFiles.map(file => `<span class="file-chip" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>`).join("")
    : '<span class="empty-files">No files selected yet</span>';
}
function showError(message) {
  const box = $("errorMessage");
  box.textContent = message;
  box.classList.remove("hidden");
}
function clearError() {
  $("errorMessage").textContent = "";
  $("errorMessage").classList.add("hidden");
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}
dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
fileInput.addEventListener("change", e => addFiles(e.target.files));
["dragenter", "dragover"].forEach(event => dropZone.addEventListener(event, e => { e.preventDefault(); dropZone.classList.add("dragover"); }));
["dragleave", "drop"].forEach(event => dropZone.addEventListener(event, e => { e.preventDefault(); dropZone.classList.remove("dragover"); }));
dropZone.addEventListener("drop", e => addFiles(e.dataTransfer.files));

analyzeBtn.addEventListener("click", async () => {
  clearError();
  const description = $("jobDescription").value.trim();
  if (!description) return showError("Please paste a job description first.");
  if (!selectedFiles.length) return showError("Please add at least one PDF or DOCX resume.");

  const form = new FormData();
  form.append("job_description", description);
  selectedFiles.forEach(file => form.append("resumes", file));
  analyzeBtn.disabled = true;
  $("progressWrap").classList.remove("hidden");
  $("progressText").textContent = `Evaluating ${selectedFiles.length} resume(s)…`;

  try {
    const response = await fetch(`${API_BASE}/api/analyze`, { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Evaluation failed.");
    latestResults = data.results || [];
    renderDashboard(data);
    $("resultsSection").classList.remove("hidden");
    $("resultsSection").scrollIntoView({ behavior: "smooth", block: "start" });
    if (data.failed) showError(`${data.failed} file(s) could not be processed. See the error details below the results.`);
  } catch (error) {
    showError(`${error.message} Make sure the FastAPI backend is running at ${API_BASE}.`);
  } finally {
    analyzeBtn.disabled = false;
    $("progressWrap").classList.add("hidden");
  }
});

function renderDashboard(data) {
  const results = data.results || [];
  const avg = results.length ? results.reduce((sum, item) => sum + item.score, 0) / results.length : 0;
  $("statTotal").textContent = results.length;
  $("statTop").textContent = results.length ? `${results[0].score.toFixed(1)}%` : "—";
  $("statTopName").textContent = results.length ? results[0].name : "No successful parses";
  $("statAverage").textContent = results.length ? `${avg.toFixed(1)}%` : "—";
  $("statFailed").textContent = data.failed || 0;
  $("tableSubtitle").textContent = `${results.length} successfully evaluated · ${data.total_uploaded} uploaded`;
  renderPodium("topOne", results[0], "TOP MATCH · #1");
  renderPodium("topTwo", results[1], "RUNNER-UP · #2");
  renderRows(results);
  renderWorst(data.worst_two || []);
  renderSnapshot(data.job || {});
  const errors = data.errors || [];
  $("errorsPanel").classList.toggle("hidden", !errors.length);
  $("errorsList").innerHTML = errors.map(item => `<div><strong>${escapeHtml(item.filename)}:</strong> ${escapeHtml(item.error)}</div>`).join("");
}
function renderPodium(id, candidate, label) {
  const el = $(id);
  if (!candidate) { el.innerHTML = `<div class="podium-rank">${label}</div><p class="empty-detail">No candidate available.</p>`; return; }
  el.innerHTML = `<div class="podium-rank">${label}</div><div class="podium-name">${escapeHtml(candidate.name)}</div><div class="podium-file">${escapeHtml(candidate.filename)}</div><div class="podium-score">${candidate.score.toFixed(1)}<small style="font-size:14px;color:#a7b3c9">%</small></div><div class="score-meter"><span style="width:${candidate.score}%"></span></div><div class="podium-detail">${escapeHtml(candidate.details?.verdict || "Open candidate details to review the assessment.")}</div>`;
}
function renderRows(results) {
  const query = $("searchInput").value.toLowerCase();
  const sort = $("sortSelect").value;
  const filtered = [...results].filter(item => `${item.name} ${item.filename}`.toLowerCase().includes(query));
  filtered.sort((a,b) => sort === "score-asc" ? a.score-b.score : sort === "name-asc" ? a.name.localeCompare(b.name) : b.score-a.score);
  $("candidateRows").innerHTML = filtered.map((item,index) => {
    const scoreClass = item.score >= 75 ? "" : item.score >= 55 ? "mid" : "low";
    const skills = Array.isArray(item.skills) ? item.skills.length : 0;
    const experience = item.experience_years == null ? "Not stated" : `${item.experience_years} yrs`;
    return `<tr><td><div class="candidate-cell"><div class="candidate-avatar">${escapeHtml(initials(item.name))}</div><div><div class="candidate-name">${escapeHtml(item.name)}</div><div class="candidate-file">${escapeHtml(item.filename)}</div></div></div></td><td class="score-cell"><span class="score-number">${item.score.toFixed(1)}%</span><div class="mini-meter"><span style="width:${item.score}%"></span></div></td><td>${escapeHtml(experience)}</td><td><span class="skill-count">${skills} extracted</span></td><td><span class="assessment-pill ${scoreClass}">${item.score >= 75 ? "Strong match" : item.score >= 55 ? "Review fit" : "Low match"}</span></td><td><button class="view-button" data-index="${results.indexOf(item)}">Details ↗</button></td></tr>`;
  }).join("");
  $("emptySearch").classList.toggle("hidden", filtered.length > 0);
}
function initials(name) { return String(name || "?").split(/\s+/).slice(0,2).map(part => part[0] || "").join("").toUpperCase(); }
function renderWorst(items) {
  $("worstList").innerHTML = items.length ? items.map(item => `<div class="compact-row"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.filename)}</small></div><span class="compact-score">${item.score.toFixed(1)}%</span></div>`).join("") : '<p class="empty-detail">No candidate data available.</p>';
}
function renderSnapshot(job) {
  $("roleSnapshot").classList.add("hidden");
  const box = $("snapshotContent");
  box.classList.remove("hidden");
  const skills = [...(job.required_skills || []).map(s => `<span class="tag">${escapeHtml(s)}</span>`), ...(job.preferred_skills || []).map(s => `<span class="tag muted">${escapeHtml(s)}</span>`)].join("");
  const resp = (job.responsibilities || []).slice(0,4).map(item => `<li>${escapeHtml(item)}</li>`).join("");
  box.innerHTML = `<div class="snapshot-role">${escapeHtml(job.role || "Role extracted from job description")}</div><div class="snapshot-label">REQUIRED + PREFERRED SKILLS</div><div class="tag-list">${skills || '<span class="empty-detail">No skills extracted.</span>'}</div><div class="snapshot-label">RESPONSIBILITIES</div><ul class="snapshot-resp">${resp || "<li>No responsibilities extracted.</li>"}</ul><div class="snapshot-label">MINIMUM EXPERIENCE</div><div class="tag-list"><span class="tag muted">${job.minimum_experience == null ? "Not specified" : `${escapeHtml(job.minimum_experience)} years`}</span></div>`;
}
$("candidateRows").addEventListener("click", e => {
  const button = e.target.closest("[data-index]");
  if (!button) return;
  const candidate = latestResults[Number(button.dataset.index)];
  if (candidate) openDetails(candidate);
});
function openDetails(candidate) {
  $("dialogName").textContent = candidate.name;
  const details = candidate.details || {};
  const renderValue = value => Array.isArray(value) ? `<ul>${value.map(x => `<li>${escapeHtml(typeof x === "object" ? JSON.stringify(x) : x)}</li>`).join("")}</ul>` : `<p>${escapeHtml(typeof value === "object" ? JSON.stringify(value) : value ?? "Not provided")}</p>`;
  const sections = Object.entries(details).map(([key,value]) => `<section class="detail-block"><h4>${escapeHtml(key.replaceAll("_"," ").toUpperCase())}</h4>${renderValue(value)}</section>`).join("");
  $("dialogBody").innerHTML = `<div class="detail-block"><h4>MATCH SCORE</h4><p><strong>${candidate.score.toFixed(1)}%</strong></p></div><div class="detail-block"><h4>EXTRACTED SKILLS</h4><div class="tag-list">${(candidate.skills || []).map(skill => `<span class="tag">${escapeHtml(skill)}</span>`).join("") || '<span class="empty-detail">No skills extracted</span>'}</div></div>${sections}`;
  $("detailDialog").showModal();
}
$("closeDialog").addEventListener("click", () => $("detailDialog").close());
$("detailDialog").addEventListener("click", e => { if (e.target === $("detailDialog")) $("detailDialog").close(); });
$("searchInput").addEventListener("input", () => renderRows(latestResults));
$("sortSelect").addEventListener("change", () => renderRows(latestResults));
$("exportBtn").addEventListener("click", () => {
  if (!latestResults.length) return;
  const rows = [["Name","Filename","Score","Email","Experience years","Skills","Verdict"], ...latestResults.map(item => [item.name,item.filename,item.score,item.email || "",item.experience_years ?? "",(item.skills || []).join("; "),item.details?.verdict || ""])];
  const csv = rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "talentlens-results.csv"; a.click(); URL.revokeObjectURL(url);
});
$("resetBtn").addEventListener("click", () => {
  $("jobDescription").value = ""; $("charCount").textContent = "0 characters";
  selectedFiles = []; fileInput.value = ""; renderFileChips(); latestResults = [];
  $("resultsSection").classList.add("hidden"); $("snapshotContent").classList.add("hidden"); $("roleSnapshot").classList.remove("hidden");
  ["statTotal","statTop","statAverage","statFailed"].forEach(id => $(id).textContent = "—");
  $("statTopName").textContent = "Awaiting results"; clearError(); window.scrollTo({top:0,behavior:"smooth"});
});
