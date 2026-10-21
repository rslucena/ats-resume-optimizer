// Global State
let currentMasterProfile = null;
let currentJobs = [];
let selectedJobId = null;
let activeJobData = null;
let currentFilterStatus = "ALL";
let currentSearchQuery = "";

// On DOM Loaded
document.addEventListener("DOMContentLoaded", async () => {
  setupSidebarNavigation();
  setupProfileDrawer();
  setupAddJobModal();
  setupWorkbenchTabs();
  setupWorkbenchActions();

  await loadMasterProfile();
  await loadJobs();

  if (window.lucide) {
    window.lucide.createIcons();
  }
});

// ==========================================
// 1. MASTER PROFILE
// ==========================================
async function loadMasterProfile() {
  try {
    const res = await fetch("/api/profile");
    const data = await res.json();
    currentMasterProfile = data.profile;

    const statusEl = document.getElementById("sidebar-master-status");
    if (currentMasterProfile && currentMasterProfile.fullName) {
      statusEl.textContent = `Master: ${currentMasterProfile.fullName}`;
      statusEl.className = "truncate max-w-[140px] text-zinc-300";
      populateDrawerForm(currentMasterProfile);
    } else {
      statusEl.textContent = "Master: Pendente";
      statusEl.className = "truncate max-w-[140px] text-amber-500";
    }
  } catch (err) {
    console.error("Erro ao carregar master profile:", err);
  }
}

function setupProfileDrawer() {
  const drawer = document.getElementById("drawer-profile");
  const btnOpen = document.getElementById("btn-open-profile-drawer");
  const btnClose = document.getElementById("drawer-profile-close");
  const btnCancel = document.getElementById("btn-drawer-cancel");
  const form = document.getElementById("master-profile-form");
  const dropzone = document.getElementById("pdf-dropzone");
  const fileInput = document.getElementById("drawer-pdf-input");
  const uploadStatus = document.getElementById("drawer-upload-status");

  btnOpen.addEventListener("click", () => {
    if (currentMasterProfile) populateDrawerForm(currentMasterProfile);
    drawer.classList.remove("hidden");
  });

  const closeDrawer = () => drawer.classList.add("hidden");
  btnClose.addEventListener("click", closeDrawer);
  btnCancel.addEventListener("click", closeDrawer);

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("border-zinc-500", "bg-zinc-850");
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("border-zinc-500", "bg-zinc-850");
  });
  dropzone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropzone.classList.remove("border-zinc-500", "bg-zinc-850");
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      await uploadPdfFile(file);
    } else {
      showToast("Selecione um arquivo .PDF", "error");
    }
  });

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) await uploadPdfFile(file);
  });

  async function uploadPdfFile(file) {
    uploadStatus.innerHTML = `<span class="text-zinc-400">Processando PDF...</span>`;
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/profile/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        uploadStatus.innerHTML = `<span class="text-emerald-400">✓ PDF extraído com sucesso</span>`;
        showToast("Master CV atualizado via PDF", "success");
        await loadMasterProfile();
        if (selectedJobId) selectJob(selectedJobId);
      } else {
        uploadStatus.innerHTML = `<span class="text-rose-400">${data.error || "Erro no upload"}</span>`;
        showToast("Falha na extração do PDF", "error");
      }
    } catch {
      uploadStatus.innerHTML = `<span class="text-rose-400">Erro de rede</span>`;
    }
  }

  // Add Exp & Edu in drawer
  document.getElementById("btn-drawer-add-exp").addEventListener("click", () => {
    if (!currentMasterProfile) currentMasterProfile = { experiences: [] };
    if (!currentMasterProfile.experiences) currentMasterProfile.experiences = [];
    currentMasterProfile.experiences.push({ role: "", company: "", startDate: "", endDate: "", description: "" });
    renderDrawerExperiences(currentMasterProfile.experiences);
  });

  document.getElementById("btn-drawer-add-edu").addEventListener("click", () => {
    if (!currentMasterProfile) currentMasterProfile = { education: [] };
    if (!currentMasterProfile.education) currentMasterProfile.education = [];
    currentMasterProfile.education.push({ degree: "", institution: "", startDate: "", endDate: "" });
    renderDrawerEducation(currentMasterProfile.education);
  });

  // Save drawer form
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const expCards = document.querySelectorAll("#drawer-experiences-list > div");
    const experiences = [];
    expCards.forEach(card => {
      experiences.push({
        role: card.querySelector(".d-exp-role").value,
        company: card.querySelector(".d-exp-company").value,
        startDate: card.querySelector(".d-exp-start").value,
        endDate: card.querySelector(".d-exp-end").value,
        description: card.querySelector(".d-exp-desc").value
      });
    });

    const eduCards = document.querySelectorAll("#drawer-education-list > div");
    const education = [];
    eduCards.forEach(card => {
      education.push({
        degree: card.querySelector(".d-edu-degree").value,
        institution: card.querySelector(".d-edu-inst").value,
        startDate: card.querySelector(".d-edu-start").value,
        endDate: card.querySelector(".d-edu-end").value
      });
    });

    const payload = {
      fullName: document.getElementById("drawer-fullName").value,
      headline: document.getElementById("drawer-headline").value,
      email: document.getElementById("drawer-email").value,
      phone: document.getElementById("drawer-phone").value,
      location: document.getElementById("drawer-location").value,
      linkedin: document.getElementById("drawer-linkedin").value,
      github: document.getElementById("drawer-github").value,
      summary: document.getElementById("drawer-summary").value,
      skills: document.getElementById("drawer-skills").value.split(",").map(s => s.trim()).filter(Boolean),
      experiences,
      education,
      certifications: document.getElementById("drawer-certifications").value.split(",").map(s => s.trim()).filter(Boolean)
    };

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast("Master CV gravado", "success");
        closeDrawer();
        await loadMasterProfile();
        if (selectedJobId) selectJob(selectedJobId);
      }
    } catch {
      showToast("Erro ao salvar perfil", "error");
    }
  });
}

function populateDrawerForm(p) {
  document.getElementById("drawer-fullName").value = p.fullName || "";
  document.getElementById("drawer-headline").value = p.headline || "";
  document.getElementById("drawer-email").value = p.email || "";
  document.getElementById("drawer-phone").value = p.phone || "";
  document.getElementById("drawer-location").value = p.location || "";
  document.getElementById("drawer-linkedin").value = p.linkedin || "";
  document.getElementById("drawer-github").value = p.github || "";
  document.getElementById("drawer-summary").value = p.summary || "";
  document.getElementById("drawer-skills").value = (p.skills || []).join(", ");
  document.getElementById("drawer-certifications").value = (p.certifications || []).join(", ");

  renderDrawerExperiences(p.experiences || []);
  renderDrawerEducation(p.education || []);
}

function renderDrawerExperiences(exps) {
  const container = document.getElementById("drawer-experiences-list");
  container.innerHTML = "";

  exps.forEach((exp, idx) => {
    const card = document.createElement("div");
    card.className = "p-2.5 bg-zinc-900/60 rounded border border-zinc-800 space-y-1.5";
    card.innerHTML = `
      <div class="flex items-center justify-between text-[10px] font-mono text-zinc-500">
        <span>EXP #${idx + 1}</span>
        <button type="button" class="btn-del-exp text-zinc-500 hover:text-rose-400" data-idx="${idx}">Remover</button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Cargo" class="ui-input d-exp-role" value="${escapeHtml(exp.role || '')}" required>
        <input type="text" placeholder="Empresa" class="ui-input d-exp-company" value="${escapeHtml(exp.company || '')}" required>
        <input type="text" placeholder="Início" class="ui-input d-exp-start font-mono text-xs" value="${escapeHtml(exp.startDate || '')}">
        <input type="text" placeholder="Fim" class="ui-input d-exp-end font-mono text-xs" value="${escapeHtml(exp.endDate || '')}">
      </div>
      <textarea rows="2" placeholder="Bullets / Resultados" class="ui-input w-full d-exp-desc font-mono text-[11px]">${escapeHtml(exp.description || '')}</textarea>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".btn-del-exp").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      currentMasterProfile.experiences.splice(idx, 1);
      renderDrawerExperiences(currentMasterProfile.experiences);
    });
  });
}

function renderDrawerEducation(edus) {
  const container = document.getElementById("drawer-education-list");
  container.innerHTML = "";

  edus.forEach((edu, idx) => {
    const card = document.createElement("div");
    card.className = "p-2.5 bg-zinc-900/60 rounded border border-zinc-800 space-y-1.5";
    card.innerHTML = `
      <div class="flex items-center justify-between text-[10px] font-mono text-zinc-500">
        <span>FORMAÇÃO #${idx + 1}</span>
        <button type="button" class="btn-del-edu text-zinc-500 hover:text-rose-400" data-idx="${idx}">Remover</button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Curso / Grau" class="ui-input d-edu-degree" value="${escapeHtml(edu.degree || '')}" required>
        <input type="text" placeholder="Instituição" class="ui-input d-edu-inst" value="${escapeHtml(edu.institution || '')}" required>
        <input type="text" placeholder="Início" class="ui-input d-edu-start font-mono text-xs" value="${escapeHtml(edu.startDate || '')}">
        <input type="text" placeholder="Fim" class="ui-input d-edu-end font-mono text-xs" value="${escapeHtml(edu.endDate || '')}">
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".btn-del-edu").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      currentMasterProfile.education.splice(idx, 1);
      renderDrawerEducation(currentMasterProfile.education);
    });
  });
}

// ==========================================
// 2. COLUMN 1: SIDEBAR PIPELINE
// ==========================================
async function loadJobs() {
  try {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    currentJobs = data.jobs || [];

    document.getElementById("queue-summary").textContent = `${currentJobs.length} vaga(s)`;
    renderSidebarJobs();

    if (currentJobs.length > 0) {
      if (!selectedJobId || !currentJobs.some(j => j.id === selectedJobId)) {
        selectJob(currentJobs[0].id);
      }
    } else {
      selectedJobId = null;
      document.getElementById("workbench-empty").classList.remove("hidden");
      document.getElementById("workbench-active").classList.add("hidden");
    }
  } catch (err) {
    console.error("Erro ao carregar vagas:", err);
  }
}

function renderSidebarJobs() {
  const container = document.getElementById("jobs-list");
  const filtered = currentJobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(currentSearchQuery) || job.company.toLowerCase().includes(currentSearchQuery);
    const matchesStatus = currentFilterStatus === "ALL" || job.status === currentFilterStatus;
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-zinc-600 font-mono text-xs">
        Nenhuma vaga correspondente.
      </div>
    `;
    return;
  }

  container.innerHTML = "";
  filtered.forEach(job => {
    const isSelected = job.id === selectedJobId;
    const row = document.createElement("div");
    row.className = `py-2.5 px-3 border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors cursor-pointer select-none ${isSelected ? 'sidebar-job-active' : ''}`;
    row.dataset.id = job.id;

    const scoreText = job.tailored 
      ? `<span class="text-zinc-500 font-mono text-[11px]">${job.tailored.scoreBefore}</span> <span class="text-zinc-600">→</span> <span class="font-mono text-[11px] font-medium ${job.tailored.scoreAfter >= 80 ? 'text-emerald-400' : 'text-zinc-200'}">${job.tailored.scoreAfter}</span>`
      : `<span class="text-zinc-600 font-mono text-[11px]">--</span>`;

    row.innerHTML = `
      <div class="flex items-baseline justify-between gap-2">
        <div class="text-[13px] font-medium text-zinc-200 truncate">${escapeHtml(job.title)}</div>
        <div class="shrink-0 tabular-nums">${scoreText}</div>
      </div>
      <div class="flex items-center justify-between text-xs text-zinc-500 mt-0.5">
        <span class="truncate">${escapeHtml(job.company)}</span>
        <span class="font-mono text-[10px] uppercase text-zinc-600">${job.status}</span>
      </div>
    `;

    row.addEventListener("click", () => selectJob(job.id));
    container.appendChild(row);
  });
}

function setupSidebarNavigation() {
  // Search
  document.getElementById("search-jobs").addEventListener("input", (e) => {
    currentSearchQuery = e.target.value.toLowerCase();
    renderSidebarJobs();
  });

  // Filter tabs
  document.querySelectorAll(".filter-tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-tab-btn").forEach(b => {
        b.className = "filter-tab-btn px-1.5 py-0.5 rounded hover:text-zinc-300";
      });
      e.target.className = "filter-tab-btn active px-1.5 py-0.5 rounded text-zinc-200 font-medium";
      currentFilterStatus = e.target.dataset.status;
      renderSidebarJobs();
    });
  });
}

// ==========================================
// 3. COLUMN 2 & 3: JOB WORKBENCH & INSPECTOR
// ==========================================
async function selectJob(jobId) {
  selectedJobId = jobId;
  renderSidebarJobs();

  const job = currentJobs.find(j => j.id === jobId);
  if (!job) return;

  activeJobData = job;

  document.getElementById("workbench-empty").classList.add("hidden");
  document.getElementById("workbench-active").classList.remove("hidden");

  // Populate Header
  document.getElementById("job-header-company").textContent = job.company;
  document.getElementById("job-header-title").textContent = job.title;
  document.getElementById("job-header-status-select").value = job.status;

  // Status Change Listener
  document.getElementById("job-header-status-select").onchange = async (e) => {
    const newStatus = e.target.value;
    await fetch(`/api/jobs/${job.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    job.status = newStatus;
    showToast(`Status: ${newStatus}`, "info");
    renderSidebarJobs();
  };

  // Populate Inspector Telemetry
  renderInspectorTelemetry(job);

  // Populate Center Diff & JD
  renderMasterCvDiff();
  renderJobDescriptionTab(job);

  // If already tailored, populate editor & A4
  if (job.tailored) {
    await fetchAndPopulateTailoredData(job.id);
  } else {
    clearTailoredEditor();
  }

  if (window.lucide) window.lucide.createIcons();
}

function renderInspectorTelemetry(job) {
  const keywords = job.topKeywords || [];
  const tailored = job.tailored;

  // Section 1: Score ATS
  if (tailored) {
    const gain = Math.max(0, Math.round(tailored.scoreAfter - tailored.scoreBefore));
    document.getElementById("inspect-score-val").textContent = tailored.scoreAfter;
    document.getElementById("inspect-score-before").textContent = `antes: ${tailored.scoreBefore}`;
    document.getElementById("inspect-score-diff").textContent = `+${gain} pts`;
    document.getElementById("inspect-score-diff").className = "text-xs font-mono text-emerald-400 font-medium";
  } else {
    document.getElementById("inspect-score-val").textContent = "--";
    document.getElementById("inspect-score-before").textContent = "antes: --";
    document.getElementById("inspect-score-diff").textContent = "--";
    document.getElementById("inspect-score-diff").className = "text-xs font-mono text-zinc-600";
    resetBreakdownLines();
  }

  // Section 2: Densidade TF-IDF Vertical Table
  const tableBody = document.getElementById("inspect-keywords-table");
  document.getElementById("inspect-kw-count").textContent = `${keywords.length} termos`;

  if (keywords.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="py-3 text-center text-zinc-600 text-[11px] italic">Sem keywords extraídas</td></tr>`;
  } else {
    tableBody.innerHTML = keywords.map(kw => {
      return `
        <tr class="hover:bg-zinc-900/40">
          <td class="py-1.5 font-sans text-xs text-zinc-200 truncate max-w-[110px]">${escapeHtml(kw.term)}</td>
          <td class="py-1.5 text-center text-zinc-500 text-[11px]">${kw.count}x</td>
          <td class="py-1.5 text-center text-zinc-400 text-[11px]" id="kw-cv-${escapeHtml(kw.term)}">--</td>
          <td class="py-1.5 text-right text-emerald-400 text-xs">✓</td>
        </tr>
      `;
    }).join("");
  }

  // Section 3: Propriedades do Binário
  document.getElementById("prop-title").textContent = job.title;
  document.getElementById("prop-creator").textContent = currentMasterProfile?.fullName || "Carlos Silva";
  document.getElementById("prop-keywords").textContent = keywords.slice(0, 4).map(k => k.term).join(", ") || "--";
}

function resetBreakdownLines() {
  document.getElementById("breakdown-format").textContent = "--/30";
  document.getElementById("breakdown-keywords").textContent = "--/35";
  document.getElementById("breakdown-density").textContent = "--/20";
  document.getElementById("breakdown-entity").textContent = "--/15";

  document.getElementById("line-format").style.width = "0%";
  document.getElementById("line-keywords").style.width = "0%";
  document.getElementById("line-density").style.width = "0%";
  document.getElementById("line-entity").style.width = "0%";
}

function updateInspectorBreakdown(audit) {
  if (!audit) return;
  const b = audit.breakdown;

  document.getElementById("breakdown-format").textContent = `${b.formatting}/30`;
  document.getElementById("breakdown-keywords").textContent = `${b.keywords}/35`;
  document.getElementById("breakdown-density").textContent = `${b.density}/20`;
  document.getElementById("breakdown-entity").textContent = `${b.entityCompliance}/15`;

  document.getElementById("line-format").style.width = `${(b.formatting / 30) * 100}%`;
  document.getElementById("line-keywords").style.width = `${(b.keywords / 35) * 100}%`;
  document.getElementById("line-density").style.width = `${(b.density / 20) * 100}%`;
  document.getElementById("line-entity").style.width = `${(b.entityCompliance / 15) * 100}%`;

  // Update CV counts in TF-IDF table
  const density = audit.keywordDensity || {};
  for (const [term, count] of Object.entries(density)) {
    const cell = document.getElementById(`kw-cv-${term}`);
    if (cell) {
      cell.textContent = `${count}x`;
      cell.className = count >= 2 ? "py-1.5 text-center text-emerald-400 text-[11px] font-semibold" : "py-1.5 text-center text-zinc-400 text-[11px]";
    }
  }
}

// Master CV in Diff
function renderMasterCvDiff() {
  const container = document.getElementById("diff-master-content");
  if (!currentMasterProfile || !currentMasterProfile.fullName) {
    container.innerHTML = `
      <div class="p-6 text-center text-zinc-600 font-mono text-xs">
        Nenhum Master CV cadastrado. Clique no ícone de documento no topo da sidebar para importar seu PDF.
      </div>
    `;
    return;
  }

  const p = currentMasterProfile;
  container.innerHTML = `
    <div class="border-b border-zinc-800/80 pb-3">
      <div class="text-sm font-semibold text-zinc-200">${escapeHtml(p.fullName)}</div>
      <div class="text-xs text-zinc-400 mt-0.5">${escapeHtml(p.headline)}</div>
      <div class="text-[11px] text-zinc-500 mt-1">${escapeHtml(p.email)} | ${escapeHtml(p.phone || '')} | ${escapeHtml(p.location || '')}</div>
    </div>

    <div>
      <div class="text-[10px] font-mono uppercase text-zinc-500 mb-1">Resumo Original</div>
      <p class="text-zinc-400 text-xs leading-relaxed">${escapeHtml(p.summary)}</p>
    </div>

    <div>
      <div class="text-[10px] font-mono uppercase text-zinc-500 mb-1.5">Experiências Originais</div>
      <div class="space-y-3">
        ${(p.experiences || []).map(exp => `
          <div>
            <div class="text-zinc-300 font-medium">${escapeHtml(exp.role)} — <span class="text-zinc-500">${escapeHtml(exp.company)}</span></div>
            <div class="text-[10px] font-mono text-zinc-600">${escapeHtml(exp.startDate)} - ${escapeHtml(exp.endDate)}</div>
            <div class="text-zinc-400 text-xs mt-1 whitespace-pre-line leading-relaxed">${escapeHtml(exp.description)}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div>
      <div class="text-[10px] font-mono uppercase text-zinc-500 mb-1">Habilidades Base</div>
      <div class="text-zinc-400 font-mono text-[11px]">${(p.skills || []).join(' • ')}</div>
    </div>
  `;
}

// Fetch and load tailored data
async function fetchAndPopulateTailoredData(jobId) {
  try {
    const res = await fetch(`/api/jobs/${jobId}/tailor`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      populateTailoredEditor(data);
      renderA4Preview(data.tailoredResume);
      updateInspectorBreakdown(data.auditAfter);
    }
  } catch (err) {
    console.error("Erro ao carregar tailoring:", err);
  }
}

function populateTailoredEditor(data) {
  const { tailoredResume } = data;
  document.getElementById("edit-tailored-title").value = tailoredResume.headline || "";
  document.getElementById("edit-tailored-summary").value = tailoredResume.summary || "";
  document.getElementById("edit-tailored-skills").value = (tailoredResume.skills || []).join(", ");

  updateSummaryDottedPreview(tailoredResume.summary || "", activeJobData?.topKeywords || []);

  document.getElementById("edit-tailored-summary").oninput = (e) => {
    updateSummaryDottedPreview(e.target.value, activeJobData?.topKeywords || []);
  };

  const expContainer = document.getElementById("edit-tailored-experiences");
  expContainer.innerHTML = "";

  (tailoredResume.experiences || []).forEach((exp, idx) => {
    const card = document.createElement("div");
    card.className = "p-2.5 rounded bg-zinc-900/40 border border-zinc-800/80 space-y-1";
    card.innerHTML = `
      <div class="flex items-center justify-between text-xs font-mono">
        <span class="text-zinc-300 font-medium">${escapeHtml(exp.role)} — ${escapeHtml(exp.company)}</span>
        <span class="text-[10px] text-zinc-600">${escapeHtml(exp.startDate)} - ${escapeHtml(exp.endDate)}</span>
      </div>
      <textarea rows="4" class="ui-input w-full font-sans text-xs leading-relaxed text-zinc-200 tailored-exp-input">${escapeHtml(exp.description)}</textarea>
    `;
    expContainer.appendChild(card);
  });
}

function updateSummaryDottedPreview(text, keywords) {
  const preview = document.getElementById("summary-dotted-preview");
  if (!text) {
    preview.innerHTML = `<span class="text-zinc-600 italic">Sem resumo otimizado</span>`;
    return;
  }

  let html = escapeHtml(text);
  const terms = (keywords || []).slice(0, 10).map(k => k.term);

  for (const term of terms) {
    const escaped = escapeHtml(term).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    html = html.replace(regex, `<span class="kw-highlight">$1</span>`);
  }

  preview.innerHTML = html.replace(/\n/g, "<br>");
}

function clearTailoredEditor() {
  document.getElementById("edit-tailored-title").value = "";
  document.getElementById("edit-tailored-summary").value = "";
  document.getElementById("edit-tailored-skills").value = "";
  document.getElementById("edit-tailored-experiences").innerHTML = `
    <div class="p-6 text-center text-zinc-600 font-mono text-xs">
      Clique em "Otimizar Currículo" para gerar a versão com as 7 camadas.
    </div>
  `;
  document.getElementById("summary-dotted-preview").innerHTML = `<span class="text-zinc-600 italic">Aguardando otimização...</span>`;
  document.getElementById("a4-preview-content").innerHTML = `
    <div class="p-12 text-center text-zinc-600 font-mono text-xs">
      Otimize o currículo para visualizar o layout da folha A4 Linear.
    </div>
  `;
}

function renderJobDescriptionTab(job) {
  document.getElementById("jd-url-input").value = job.jobUrl || "";
  document.getElementById("jd-raw-text").value = job.rawDescription || "";
  const words = (job.rawDescription || "").split(/\s+/).filter(Boolean).length;
  document.getElementById("jd-word-count").textContent = `${words} palavras`;
}

function renderA4Preview(resume) {
  const container = document.getElementById("a4-preview-content");
  container.innerHTML = `
    <div class="border-b border-zinc-700 pb-3 mb-4">
      <h1 class="text-base font-bold text-white tracking-tight uppercase">${escapeHtml(resume.fullName)}</h1>
      <div class="text-xs text-zinc-300 mt-0.5">${escapeHtml(resume.headline)}</div>
      <div class="text-[11px] text-zinc-500 mt-1">${escapeHtml(resume.email)}  |  ${escapeHtml(resume.phone || '')}  |  ${escapeHtml(resume.location || '')}</div>
    </div>

    <div class="mb-4">
      <div class="text-[11px] font-bold uppercase text-white border-b border-zinc-800 pb-1 mb-1 font-mono">Resumo Profissional</div>
      <p class="text-xs text-zinc-300 leading-relaxed">${escapeHtml(resume.summary)}</p>
    </div>

    <div class="mb-4">
      <div class="text-[11px] font-bold uppercase text-white border-b border-zinc-800 pb-1 mb-1 font-mono">Experiência Profissional</div>
      <div class="space-y-3">
        ${(resume.experiences || []).map(exp => `
          <div>
            <div class="font-bold text-white text-xs">${escapeHtml(exp.role)} — <span class="font-normal text-zinc-400">${escapeHtml(exp.company)}</span> <span class="text-[10px] text-zinc-500 float-right">(${escapeHtml(exp.startDate)} - ${escapeHtml(exp.endDate)})</span></div>
            <div class="text-xs text-zinc-400 mt-1 whitespace-pre-line leading-relaxed">${escapeHtml(exp.description)}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="mb-4">
      <div class="text-[11px] font-bold uppercase text-white border-b border-zinc-800 pb-1 mb-1 font-mono">Formação Acadêmica</div>
      <div class="space-y-1">
        ${(resume.education || []).map(edu => `
          <div class="text-xs text-zinc-300">${escapeHtml(edu.degree)} — <span class="text-zinc-500">${escapeHtml(edu.institution)}</span> <span class="text-[10px] text-zinc-600">(${escapeHtml(edu.startDate)} - ${escapeHtml(edu.endDate)})</span></div>
        `).join('')}
      </div>
    </div>

    <div>
      <div class="text-[11px] font-bold uppercase text-white border-b border-zinc-800 pb-1 mb-1 font-mono">Habilidades Técnicas</div>
      <div class="text-xs text-zinc-400 font-mono">${(resume.skills || []).join('   •   ')}</div>
    </div>
  `;
}

// ==========================================
// 4. WORKBENCH TABS & ACTIONS
// ==========================================
function setupWorkbenchTabs() {
  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const target = btn.dataset.tab;
      document.querySelectorAll(".nav-tab-btn").forEach(b => {
        b.className = "nav-tab-btn h-full flex items-center text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors";
      });
      btn.className = "nav-tab-btn nav-tab-active h-full flex items-center text-xs font-medium text-zinc-100 transition-colors";

      document.querySelectorAll(".tab-pane-content").forEach(p => p.classList.add("hidden"));
      document.getElementById(target).classList.remove("hidden");

      // Actions visibility
      const actions = document.getElementById("tab-diff-actions");
      if (target === "tab-diff") {
        actions.classList.remove("hidden");
      } else {
        actions.classList.add("hidden");
      }
    });
  });
}

function setupWorkbenchActions() {
  // Otimizar Currículo (Thin top 2px bar progress)
  const btnRun = document.getElementById("btn-run-tailor");
  btnRun.addEventListener("click", async () => {
    if (!selectedJobId) return;
    if (!currentMasterProfile || !currentMasterProfile.fullName) {
      showToast("Cadastre o Master CV primeiro", "error");
      document.getElementById("btn-open-profile-drawer").click();
      return;
    }

    const bar = document.getElementById("top-progress-bar");
    bar.style.opacity = "1";
    bar.style.width = "30%";

    setTimeout(() => { bar.style.width = "75%"; }, 100);

    try {
      const res = await fetch(`/api/jobs/${selectedJobId}/tailor`, { method: "POST" });
      const data = await res.json();

      bar.style.width = "100%";
      setTimeout(() => {
        bar.style.opacity = "0";
        bar.style.width = "0%";
      }, 300);

      if (res.ok) {
        showToast(`Otimizado: Score ${data.scoreAfter}/100 (+${Math.round(data.scoreAfter - data.scoreBefore)} pts)`, "success");
        await loadJobs();
        selectJob(selectedJobId);
      } else {
        showToast(data.error || "Erro ao otimizar", "error");
      }
    } catch {
      bar.style.opacity = "0";
      showToast("Erro na requisição", "error");
    }
  });

  // Recalcular Score inline
  document.getElementById("btn-recalculate").addEventListener("click", async () => {
    if (!selectedJobId) return;

    const btn = document.getElementById("btn-recalculate");
    btn.innerHTML = `<i data-lucide="refresh-cw" class="w-3 h-3 animate-spin"></i><span>Calculando...</span>`;

    const headline = document.getElementById("edit-tailored-title").value;
    const summary = document.getElementById("edit-tailored-summary").value;
    const skills = document.getElementById("edit-tailored-skills").value.split(",").map(s => s.trim()).filter(Boolean);

    const expTextareas = document.querySelectorAll("#edit-tailored-experiences textarea");
    const experiences = (currentMasterProfile?.experiences || []).map((exp, idx) => ({
      ...exp,
      description: expTextareas[idx] ? expTextareas[idx].value : exp.description
    }));

    const updatedResume = {
      ...currentMasterProfile,
      headline,
      summary,
      skills,
      experiences
    };

    try {
      const res = await fetch(`/api/jobs/${selectedJobId}/tailor`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tailoredResume: updatedResume })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Score: ${data.scoreAfter}/100`, "success");
        document.getElementById("inspect-score-val").textContent = data.scoreAfter;
        updateInspectorBreakdown(data.auditAfter);
        renderA4Preview(updatedResume);
        await loadJobs();
      }
    } catch {
      showToast("Erro ao recalcular", "error");
    } finally {
      btn.innerHTML = `<i data-lucide="refresh-cw" class="w-3 h-3"></i><span>Recalcular Score</span>`;
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Export PDF
  document.getElementById("btn-download-pdf").addEventListener("click", () => {
    if (selectedJobId) {
      window.location.href = `/api/jobs/${selectedJobId}/download/pdf`;
      showToast("Exportando PDF...", "info");
    }
  });

  // Export DOCX
  document.getElementById("btn-download-docx").addEventListener("click", () => {
    if (selectedJobId) {
      window.location.href = `/api/jobs/${selectedJobId}/download/docx`;
      showToast("Exportando DOCX...", "info");
    }
  });

  // Save JD changes
  document.getElementById("btn-save-jd").addEventListener("click", async () => {
    if (!selectedJobId) return;
    const rawDescription = document.getElementById("jd-raw-text").value;
    const jobUrl = document.getElementById("jd-url-input").value;

    await fetch(`/api/jobs/${selectedJobId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawDescription, jobUrl })
    });
    showToast("Requisitos atualizados", "success");
    await loadJobs();
    selectJob(selectedJobId);
  });

  // Re-extract JD
  document.getElementById("btn-re-extract-url").addEventListener("click", async () => {
    const url = document.getElementById("jd-url-input").value.trim();
    if (!url) {
      showToast("Insira a URL da vaga", "error");
      return;
    }

    try {
      const res = await fetch("/api/jobs/extract-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (res.ok) {
        document.getElementById("jd-raw-text").value = data.description;
        showToast("Dados re-extraídos da URL", "success");
      } else {
        showToast(data.error || "Erro ao extrair", "error");
      }
    } catch {
      showToast("Erro de rede", "error");
    }
  });
}

// ==========================================
// 5. ADD JOB MODAL
// ==========================================
function setupAddJobModal() {
  const modal = document.getElementById("modal-add-job");
  const btnOpen = document.getElementById("btn-open-add-job");
  const btnClose = document.getElementById("modal-add-job-close");
  const btnCancel = document.getElementById("btn-modal-cancel");
  const form = document.getElementById("form-create-job");
  const btnExtract = document.getElementById("btn-modal-extract");
  const urlInput = document.getElementById("modal-job-url");
  const feedback = document.getElementById("modal-extract-feedback");

  btnOpen.addEventListener("click", () => {
    form.reset();
    urlInput.value = "";
    feedback.textContent = "";
    modal.classList.remove("hidden");
  });

  const closeModal = () => modal.classList.add("hidden");
  btnClose.addEventListener("click", closeModal);
  btnCancel.addEventListener("click", closeModal);

  btnExtract.addEventListener("click", async () => {
    const url = urlInput.value.trim();
    if (!url) {
      feedback.textContent = "Insira uma URL.";
      return;
    }

    feedback.innerHTML = `<span class="text-zinc-400">Extraindo dados...</span>`;

    try {
      const res = await fetch("/api/jobs/extract-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await res.json();

      if (res.ok) {
        document.getElementById("modal-input-title").value = data.title || "";
        document.getElementById("modal-input-company").value = data.company || "";
        document.getElementById("modal-input-description").value = data.description || "";
        feedback.innerHTML = `<span class="text-emerald-400">✓ ${data.company} • ${data.keywords.length} keywords</span>`;
      } else {
        feedback.innerHTML = `<span class="text-zinc-400">${data.error}</span>`;
      }
    } catch {
      feedback.innerHTML = `<span class="text-rose-400">Erro na extração</span>`;
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      title: document.getElementById("modal-input-title").value,
      company: document.getElementById("modal-input-company").value,
      jobUrl: urlInput.value.trim() || undefined,
      status: document.getElementById("modal-input-status").value,
      notes: document.getElementById("modal-input-notes").value,
      rawDescription: document.getElementById("modal-input-description").value
    };

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        closeModal();
        showToast("Vaga cadastrada", "success");
        await loadJobs();
        selectJob(data.job.id);
      }
    } catch {
      showToast("Erro ao cadastrar", "error");
    }
  });
}

// ==========================================
// 6. TOAST SYSTEM
// ==========================================
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");

  const colors = {
    success: "border-zinc-700 text-zinc-100",
    error: "border-rose-900/60 text-rose-300",
    info: "border-zinc-800 text-zinc-300"
  };

  toast.className = `toast-item pointer-events-auto px-3 py-1.5 rounded-md bg-[#121215] border ${colors[type]} shadow-lg flex items-center gap-2`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.2s ease";
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

// Security
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
