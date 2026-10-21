// State
let currentMasterProfile = null;
let currentJobs = [];
let selectedJobId = null;
let activeJobData = null;
let currentFilterStatus = "ALL";
let currentSearchQuery = "";

// DOM Elements & Event Bindings
document.addEventListener("DOMContentLoaded", async () => {
  setupWorkbenchNavigation();
  setupProfileDrawer();
  setupAddJobModal();
  setupInspectorTabs();
  setupInspectorActions();

  await loadMasterProfile();
  await loadJobs();

  if (window.lucide) {
    window.lucide.createIcons();
  }
});

// ==========================================
// 1. TOP BAR & MASTER PROFILE
// ==========================================
async function loadMasterProfile() {
  try {
    const res = await fetch("/api/profile");
    const data = await res.json();
    currentMasterProfile = data.profile;

    const dot = document.getElementById("top-master-dot");
    const nameEl = document.getElementById("top-master-name");

    if (currentMasterProfile && currentMasterProfile.fullName) {
      dot.className = "w-1.5 h-1.5 rounded-full bg-emerald-400";
      nameEl.textContent = `Master CV: ${currentMasterProfile.fullName}`;
      populateDrawerForm(currentMasterProfile);
    } else {
      dot.className = "w-1.5 h-1.5 rounded-full bg-amber-400";
      nameEl.textContent = "Master CV: Pendente";
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
  const statusEl = document.getElementById("drawer-upload-status");

  btnOpen.addEventListener("click", () => {
    if (currentMasterProfile) populateDrawerForm(currentMasterProfile);
    drawer.classList.remove("hidden");
  });

  const closeDrawer = () => drawer.classList.add("hidden");
  btnClose.addEventListener("click", closeDrawer);
  btnCancel.addEventListener("click", closeDrawer);

  // Drag and drop dropzone
  dropzone.addEventListener("click", () => fileInput.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("border-emerald-500", "bg-emerald-500/5");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("border-emerald-500", "bg-emerald-500/5");
  });

  dropzone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropzone.classList.remove("border-emerald-500", "bg-emerald-500/5");
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      await handlePdfUpload(file);
    } else {
      showToast("Por favor, selecione um arquivo .PDF", "error");
    }
  });

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) await handlePdfUpload(file);
  });

  async function handlePdfUpload(file) {
    statusEl.innerHTML = `<span class="text-cyan-400 flex items-center justify-center gap-1.5"><i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Extraindo texto e estruturando seções...</span>`;
    if (window.lucide) window.lucide.createIcons();

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/profile/upload", {
        method: "POST",
        body: fd
      });
      const data = await res.json();
      if (res.ok) {
        statusEl.innerHTML = `<span class="text-emerald-400">✓ PDF extraído e salvo no SQLite com sucesso!</span>`;
        showToast("Master CV atualizado via PDF", "success");
        await loadMasterProfile();
      } else {
        statusEl.innerHTML = `<span class="text-rose-400">${data.error || "Erro ao processar PDF"}</span>`;
        showToast("Falha na extração do PDF", "error");
      }
    } catch {
      statusEl.innerHTML = `<span class="text-rose-400">Erro de rede ao enviar arquivo.</span>`;
    }
  }

  // Add Exp / Edu in drawer
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
        showToast("Master CV gravado no SQLite", "success");
        closeDrawer();
        await loadMasterProfile();
        if (selectedJobId) selectJob(selectedJobId);
      }
    } catch {
      showToast("Erro ao gravar dados do perfil", "error");
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
    card.className = "p-3 bg-zinc-950 rounded border border-zinc-800 space-y-2";
    card.innerHTML = `
      <div class="flex items-center justify-between text-[11px] font-mono text-zinc-400">
        <span>EXP #${idx + 1}</span>
        <button type="button" class="btn-del-exp text-zinc-500 hover:text-rose-400" data-idx="${idx}">Remover</button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Cargo" class="wb-input d-exp-role" value="${escapeHtml(exp.role || '')}" required>
        <input type="text" placeholder="Empresa" class="wb-input d-exp-company" value="${escapeHtml(exp.company || '')}" required>
        <input type="text" placeholder="Início" class="wb-input d-exp-start font-mono text-xs" value="${escapeHtml(exp.startDate || '')}">
        <input type="text" placeholder="Fim" class="wb-input d-exp-end font-mono text-xs" value="${escapeHtml(exp.endDate || '')}">
      </div>
      <textarea rows="2" placeholder="Bullets / Resultados" class="wb-input w-full d-exp-desc font-mono text-[11px]">${escapeHtml(exp.description || '')}</textarea>
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
    card.className = "p-3 bg-zinc-950 rounded border border-zinc-800 space-y-2";
    card.innerHTML = `
      <div class="flex items-center justify-between text-[11px] font-mono text-zinc-400">
        <span>EDU #${idx + 1}</span>
        <button type="button" class="btn-del-edu text-zinc-500 hover:text-rose-400" data-idx="${idx}">Remover</button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Grau / Curso" class="wb-input d-edu-degree" value="${escapeHtml(edu.degree || '')}" required>
        <input type="text" placeholder="Instituição" class="wb-input d-edu-inst" value="${escapeHtml(edu.institution || '')}" required>
        <input type="text" placeholder="Início" class="wb-input d-edu-start font-mono text-xs" value="${escapeHtml(edu.startDate || '')}">
        <input type="text" placeholder="Fim" class="wb-input d-edu-end font-mono text-xs" value="${escapeHtml(edu.endDate || '')}">
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
// 2. ZONE 2: JOBS PIPELINE & QUEUE
// ==========================================
async function loadJobs() {
  try {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    currentJobs = data.jobs || [];

    document.getElementById("count-all").textContent = currentJobs.length;
    document.getElementById("queue-summary").textContent = `${currentJobs.length} vaga(s) no tracker`;

    renderJobsQueue();

    // Auto-select first job if none selected or if previous selected disappeared
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

function renderJobsQueue() {
  const container = document.getElementById("jobs-list");
  const filtered = currentJobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(currentSearchQuery) || job.company.toLowerCase().includes(currentSearchQuery);
    const matchesStatus = currentFilterStatus === "ALL" || job.status === currentFilterStatus;
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-zinc-500 font-mono text-xs">
        Nenhuma vaga correspondente.
      </div>
    `;
    return;
  }

  container.innerHTML = "";
  filtered.forEach(job => {
    const isSelected = job.id === selectedJobId;
    const card = document.createElement("div");
    card.className = `p-3 rounded border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer bg-[#0c0c0e] ${isSelected ? 'job-card-active' : ''}`;
    card.dataset.id = job.id;

    const statusColors = {
      SAVED: "text-zinc-400 bg-zinc-800/60 border-zinc-700",
      APPLIED: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      INTERVIEW: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      OFFER: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      REJECTED: "text-rose-400 bg-rose-500/10 border-rose-500/20"
    };

    const statusLabels = {
      SAVED: "Salva",
      APPLIED: "Aplicada",
      INTERVIEW: "Entrevista",
      OFFER: "Oferta",
      REJECTED: "Rejeitada"
    };

    const scoreHtml = job.tailored ? `
      <div class="flex items-center gap-1 font-mono text-[11px]">
        <span class="text-zinc-500">${job.tailored.scoreBefore}</span>
        <span class="text-zinc-600">→</span>
        <span class="font-bold ${job.tailored.scoreAfter >= 80 ? 'text-emerald-400' : 'text-amber-400'}">${job.tailored.scoreAfter}</span>
        <span class="text-[10px] text-emerald-400/80">(+${Math.max(0, Math.round(job.tailored.scoreAfter - job.tailored.scoreBefore))})</span>
      </div>
    ` : `
      <span class="text-[10px] font-mono text-zinc-500 italic">Score pendente</span>
    `;

    card.innerHTML = `
      <div class="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
        <span class="truncate uppercase tracking-wider font-semibold">${escapeHtml(job.company)}</span>
        <div class="flex items-center gap-1 shrink-0">
          <span class="px-1 rounded text-[9px] font-mono uppercase border border-cyan-500/30 text-cyan-400 bg-cyan-500/5">${job.language || 'PT'}</span>
          <span class="px-1.5 py-0.2 rounded text-[10px] font-mono border ${statusColors[job.status] || ''}">${statusLabels[job.status]}</span>
        </div>
      </div>
      <div class="text-xs font-medium text-zinc-100 truncate mb-1.5">${escapeHtml(job.title)}</div>
      <div class="flex items-center justify-between pt-1 border-t border-zinc-900">
        ${scoreHtml}
        <span class="text-[10px] font-mono text-zinc-500">${(job.topKeywords || []).length} keywords</span>
      </div>
    `;

    card.addEventListener("click", () => selectJob(job.id));
    container.appendChild(card);
  });
}

function setupWorkbenchNavigation() {
  // Search input
  document.getElementById("search-jobs").addEventListener("input", (e) => {
    currentSearchQuery = e.target.value.toLowerCase();
    renderJobsQueue();
  });

  // Filter status pills
  document.querySelectorAll(".filter-status-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-status-btn").forEach(b => {
        b.className = "filter-status-btn px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-200";
      });
      e.target.className = "filter-status-btn active px-2 py-0.5 rounded text-zinc-200 bg-zinc-800 border border-zinc-700 font-medium";
      currentFilterStatus = e.target.dataset.status;
      renderJobsQueue();
    });
  });

  document.getElementById("btn-empty-add-job").addEventListener("click", () => {
    document.getElementById("btn-open-add-job").click();
  });
}

// ==========================================
// 3. ZONE 3: JOB DETAILS & TELEMETRY
// ==========================================
async function selectJob(jobId) {
  selectedJobId = jobId;
  renderJobsQueue();

  const job = currentJobs.find(j => j.id === jobId);
  if (!job) return;

  activeJobData = job;

  document.getElementById("workbench-empty").classList.add("hidden");
  document.getElementById("workbench-active").classList.remove("hidden");

  // Populate Header
  document.getElementById("job-detail-title").textContent = job.title;
  document.getElementById("job-detail-company").textContent = job.company;
  document.getElementById("job-detail-lang").textContent = (job.language || "pt").toUpperCase();
  document.getElementById("job-detail-status-select").value = job.status;

  // Status select change
  document.getElementById("job-detail-status-select").onchange = async (e) => {
    const newStatus = e.target.value;
    await fetch(`/api/jobs/${job.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    job.status = newStatus;
    showToast(`Status atualizado para ${newStatus}`, "info");
    renderJobsQueue();
  };

  // Populate Telemetry Bento Grid
  renderTelemetryGrid(job);

  // Populate Tabs
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

function renderTelemetryGrid(job) {
  const keywords = job.topKeywords || [];
  const tailored = job.tailored;

  // Card 1: Score Gauge
  if (tailored) {
    const gain = Math.max(0, Math.round(tailored.scoreAfter - tailored.scoreBefore));
    document.getElementById("telemetry-score-after").textContent = tailored.scoreAfter;
    document.getElementById("telemetry-score-before-sub").textContent = `(Base: ${tailored.scoreBefore})`;
    document.getElementById("telemetry-gain").textContent = `+${gain} pts`;
    document.getElementById("telemetry-gain").className = "text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
  } else {
    document.getElementById("telemetry-score-after").textContent = "--";
    document.getElementById("telemetry-score-before-sub").textContent = "(Base: --)";
    document.getElementById("telemetry-gain").textContent = "Pendente";
    document.getElementById("telemetry-gain").className = "text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700";
  }

  // Card 2: Keywords Grid
  const kwGrid = document.getElementById("telemetry-keywords-grid");
  document.getElementById("telemetry-kw-count").textContent = `${keywords.length} extraídas`;

  if (keywords.length === 0) {
    kwGrid.innerHTML = `<span class="text-zinc-600 italic text-[11px]">Nenhuma keyword extraída</span>`;
  } else {
    kwGrid.innerHTML = keywords.map(kw => {
      return `
        <span class="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center gap-1">
          <span>${escapeHtml(kw.term)}</span>
          <span class="text-[9px] text-zinc-500 font-mono">(${kw.count}x)</span>
        </span>
      `;
    }).join("");
  }

  // Card 3: Metadata
  document.getElementById("meta-disp-title").textContent = job.title;
  document.getElementById("meta-disp-author").textContent = currentMasterProfile?.fullName || "Carlos Silva";
  document.getElementById("meta-disp-keywords").textContent = keywords.slice(0, 4).map(k => k.term).join(", ") || "--";
}

// Render Master CV in Diff Left Column
function renderMasterCvDiff() {
  const container = document.getElementById("master-cv-rendered");
  if (!currentMasterProfile || !currentMasterProfile.fullName) {
    container.innerHTML = `
      <div class="p-6 text-center text-zinc-500 font-mono text-xs">
        Nenhum Master CV cadastrado. Clique em "Meu Currículo Base" no topo para importar seu PDF.
      </div>
    `;
    return;
  }

  const p = currentMasterProfile;
  container.innerHTML = `
    <div class="border-b border-zinc-800 pb-3">
      <h4 class="font-bold text-zinc-100 text-sm">${escapeHtml(p.fullName)}</h4>
      <div class="text-xs text-zinc-400 font-mono mt-0.5">${escapeHtml(p.headline)}</div>
      <div class="text-[11px] text-zinc-500 font-mono mt-1">${escapeHtml(p.email)} | ${escapeHtml(p.phone || '')} | ${escapeHtml(p.location || '')}</div>
    </div>

    <div>
      <span class="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Resumo Profissional</span>
      <p class="mt-1 text-zinc-300 text-xs leading-relaxed">${escapeHtml(p.summary)}</p>
    </div>

    <div>
      <span class="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Experiências Originais</span>
      <div class="space-y-3 mt-1.5">
        ${(p.experiences || []).map(exp => `
          <div class="p-2.5 rounded bg-zinc-950 border border-zinc-900">
            <div class="font-medium text-zinc-200 text-xs">${escapeHtml(exp.role)} — <span class="text-zinc-400">${escapeHtml(exp.company)}</span></div>
            <div class="text-[10px] font-mono text-zinc-500 mt-0.5">${escapeHtml(exp.startDate)} - ${escapeHtml(exp.endDate)}</div>
            <div class="mt-1.5 text-zinc-400 text-xs whitespace-pre-line">${escapeHtml(exp.description)}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div>
      <span class="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Habilidades Base</span>
      <div class="mt-1 text-zinc-400 font-mono text-[11px]">${(p.skills || []).join(' • ')}</div>
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
      updateTelemetryBreakdown(data.auditAfter);
    }
  } catch (err) {
    console.error("Erro ao carregar tailoring:", err);
  }
}

function populateTailoredEditor(data) {
  const { tailoredResume, auditAfter } = data;
  document.getElementById("edit-tailored-title").value = tailoredResume.headline || "";
  document.getElementById("edit-tailored-summary").value = tailoredResume.summary || "";
  document.getElementById("edit-tailored-skills").value = (tailoredResume.skills || []).join(", ");

  // Highlight summary with injected keywords
  updateSummaryHighlight(tailoredResume.summary || "", activeJobData?.topKeywords || []);

  document.getElementById("edit-tailored-summary").oninput = (e) => {
    updateSummaryHighlight(e.target.value, activeJobData?.topKeywords || []);
  };

  const expContainer = document.getElementById("edit-tailored-experiences");
  expContainer.innerHTML = "";

  (tailoredResume.experiences || []).forEach((exp, idx) => {
    const card = document.createElement("div");
    card.className = "p-3 rounded bg-zinc-950 border border-zinc-800 space-y-2";
    card.innerHTML = `
      <div class="flex items-center justify-between text-xs font-mono">
        <span class="font-medium text-zinc-200">${escapeHtml(exp.role)} — ${escapeHtml(exp.company)}</span>
        <span class="text-[10px] text-zinc-500">${escapeHtml(exp.startDate)} - ${escapeHtml(exp.endDate)}</span>
      </div>
      <textarea rows="4" class="wb-input w-full font-mono text-[11px] leading-relaxed tailored-exp-input">${escapeHtml(exp.description)}</textarea>
    `;
    expContainer.appendChild(card);
  });
}

function updateSummaryHighlight(text, keywords) {
  const preview = document.getElementById("summary-highlight-preview");
  if (!text) {
    preview.innerHTML = `<span class="text-zinc-600 italic">Sem resumo otimizado</span>`;
    return;
  }

  let html = escapeHtml(text);
  const terms = keywords.slice(0, 10).map(k => k.term);

  for (const term of terms) {
    const escaped = escapeHtml(term).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    html = html.replace(regex, `<span class="keyword-highlight">$1</span>`);
  }

  preview.innerHTML = html.replace(/\n/g, "<br>");
}

function clearTailoredEditor() {
  document.getElementById("edit-tailored-title").value = "";
  document.getElementById("edit-tailored-summary").value = "";
  document.getElementById("edit-tailored-skills").value = "";
  document.getElementById("edit-tailored-experiences").innerHTML = `
    <div class="p-6 text-center text-zinc-500 font-mono text-xs">
      Clique no botão "⚡ Executar Otimização ATS (7 Camadas)" acima para gerar o currículo otimizado.
    </div>
  `;
  document.getElementById("summary-highlight-preview").innerHTML = `<span class="text-zinc-600 italic">Aguardando execução da otimização...</span>`;
  document.getElementById("a4-preview-content").innerHTML = `
    <div class="p-12 text-center text-zinc-600 font-mono text-xs">
      Otimize o currículo para visualizar o layout da folha A4 Linear.
    </div>
  `;
}

function updateTelemetryBreakdown(audit) {
  if (!audit) return;
  const b = audit.breakdown;
  document.getElementById("telemetry-breakdown-kw").textContent = `${Math.round(b.keywords + b.density)}/55`;

  // Bars width
  document.getElementById("bar-formatting").style.width = `${(b.formatting / 30) * 25}%`;
  document.getElementById("bar-keywords").style.width = `${(b.keywords / 35) * 35}%`;
  document.getElementById("bar-density").style.width = `${(b.density / 20) * 20}%`;
  document.getElementById("bar-entity").style.width = `${(b.entityCompliance / 15) * 20}%`;
}

function renderJobDescriptionTab(job) {
  document.getElementById("jd-url-input").value = job.jobUrl || "";
  document.getElementById("jd-raw-text").value = job.rawDescription || "";
  const words = (job.rawDescription || "").split(/\s+/).filter(Boolean).length;
  document.getElementById("jd-stats").textContent = `${words} palavras • ${(job.language || 'pt').toUpperCase()}`;
}

function renderA4Preview(resume) {
  const container = document.getElementById("a4-preview-content");
  container.innerHTML = `
    <div class="border-b border-zinc-700 pb-4 mb-4">
      <h1 class="text-lg font-bold text-white tracking-tight uppercase">${escapeHtml(resume.fullName)}</h1>
      <div class="text-xs font-semibold text-zinc-300 mt-0.5">${escapeHtml(resume.headline)}</div>
      <div class="text-[11px] text-zinc-400 mt-1">${escapeHtml(resume.email)}  |  ${escapeHtml(resume.phone || '')}  |  ${escapeHtml(resume.location || '')}</div>
    </div>

    <div class="mb-4">
      <div class="text-[11px] font-bold uppercase text-white border-b border-zinc-800 pb-1 mb-1.5 tracking-wider font-mono">Resumo Profissional</div>
      <p class="text-xs text-zinc-300 leading-relaxed">${escapeHtml(resume.summary)}</p>
    </div>

    <div class="mb-4">
      <div class="text-[11px] font-bold uppercase text-white border-b border-zinc-800 pb-1 mb-1.5 tracking-wider font-mono">Experiência Profissional</div>
      <div class="space-y-3">
        ${(resume.experiences || []).map(exp => `
          <div>
            <div class="font-bold text-white text-xs">${escapeHtml(exp.role)} — <span class="font-normal text-zinc-300">${escapeHtml(exp.company)}</span> <span class="text-[10px] text-zinc-500 float-right">(${escapeHtml(exp.startDate)} - ${escapeHtml(exp.endDate)})</span></div>
            <div class="text-xs text-zinc-400 mt-1 whitespace-pre-line leading-relaxed">${escapeHtml(exp.description)}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="mb-4">
      <div class="text-[11px] font-bold uppercase text-white border-b border-zinc-800 pb-1 mb-1.5 tracking-wider font-mono">Formação Acadêmica</div>
      <div class="space-y-1">
        ${(resume.education || []).map(edu => `
          <div class="text-xs text-zinc-300 font-medium">${escapeHtml(edu.degree)} — <span class="text-zinc-400">${escapeHtml(edu.institution)}</span> <span class="text-[10px] text-zinc-500">(${escapeHtml(edu.startDate)} - ${escapeHtml(edu.endDate)})</span></div>
        `).join('')}
      </div>
    </div>

    <div>
      <div class="text-[11px] font-bold uppercase text-white border-b border-zinc-800 pb-1 mb-1.5 tracking-wider font-mono">Habilidades Técnicas</div>
      <div class="text-xs text-zinc-300">${(resume.skills || []).join('   •   ')}</div>
    </div>
  `;
}

// ==========================================
// 4. WORKBENCH TABS & ACTIONS
// ==========================================
function setupInspectorTabs() {
  document.querySelectorAll(".wb-tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const target = btn.dataset.tab;
      document.querySelectorAll(".wb-tab-btn").forEach(b => {
        b.className = "wb-tab-btn px-3 py-1 text-xs font-medium rounded text-zinc-400 hover:text-zinc-200";
      });
      btn.className = "wb-tab-btn active px-3 py-1 text-xs font-medium rounded text-zinc-100 bg-zinc-850 border border-zinc-700/80";

      document.querySelectorAll(".wb-tab-pane").forEach(pane => {
        pane.classList.add("hidden");
      });
      document.getElementById(target).classList.remove("hidden");

      // Hide or show tab actions
      const tabDiffActions = document.getElementById("tab-diff-actions");
      if (target === "tab-diff") {
        tabDiffActions.classList.remove("hidden");
      } else {
        tabDiffActions.classList.add("hidden");
      }
    });
  });
}

function setupInspectorActions() {
  // ⚡ Run 7-Layer Optimization
  const btnRun = document.getElementById("btn-run-tailor");
  btnRun.addEventListener("click", async () => {
    if (!selectedJobId) return;
    if (!currentMasterProfile || !currentMasterProfile.fullName) {
      showToast("Cadastre seu Master CV primeiro!", "error");
      document.getElementById("btn-open-profile-drawer").click();
      return;
    }

    // Trigger Layer Stepper Animation
    const overlay = document.getElementById("layer-stepper-overlay");
    overlay.classList.remove("hidden");

    const steps = [
      { id: "step-1", pct: "15%" },
      { id: "step-2", pct: "30%" },
      { id: "step-3", pct: "50%" },
      { id: "step-4", pct: "65%" },
      { id: "step-5", pct: "80%" },
      { id: "step-6", pct: "92%" },
      { id: "step-7", pct: "100%" }
    ];

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const el = document.getElementById(s.id);
      el.className = "step-item text-emerald-400 flex items-center gap-2 anim-step-pulse";
      el.querySelector("span").className = "w-1.5 h-1.5 rounded-full bg-emerald-400";
      document.getElementById("stepper-pct").textContent = s.pct;
      document.getElementById("stepper-progress-bar").style.width = s.pct;
      await new Promise(r => setTimeout(r, 120));
      el.classList.remove("anim-step-pulse");
    }

    try {
      const res = await fetch(`/api/jobs/${selectedJobId}/tailor`, { method: "POST" });
      const data = await res.json();

      overlay.classList.add("hidden");

      if (res.ok) {
        showToast(`Otimização ATS concluída: Score ${data.scoreAfter}/100 (+${Math.round(data.scoreAfter - data.scoreBefore)} pts)`, "success");
        await loadJobs();
        selectJob(selectedJobId);
      } else {
        showToast(data.error || "Erro na otimização", "error");
      }
    } catch {
      overlay.classList.add("hidden");
      showToast("Erro na requisição de otimização", "error");
    }
  });

  // Recalculate score after inline edit
  document.getElementById("btn-save-recalc").addEventListener("click", async () => {
    if (!selectedJobId) return;

    const btn = document.getElementById("btn-save-recalc");
    btn.innerHTML = `<i data-lucide="loader" class="w-3 h-3 animate-spin text-emerald-400"></i><span>Recalculando...</span>`;

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
        showToast(`Score recalculado: ${data.scoreAfter}/100`, "success");
        document.getElementById("telemetry-score-after").textContent = data.scoreAfter;
        updateTelemetryBreakdown(data.auditAfter);
        renderA4Preview(updatedResume);
        await loadJobs();
      }
    } catch {
      showToast("Erro ao recalcular score", "error");
    } finally {
      btn.innerHTML = `<i data-lucide="refresh-cw" class="w-3 h-3 text-emerald-400"></i><span>Recalcular Score</span>`;
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Download PDF
  document.getElementById("btn-download-pdf").addEventListener("click", () => {
    if (selectedJobId) {
      window.location.href = `/api/jobs/${selectedJobId}/download/pdf`;
      showToast("Download do PDF Linear ATS iniciado", "info");
    }
  });

  // Download DOCX
  document.getElementById("btn-download-docx").addEventListener("click", () => {
    if (selectedJobId) {
      window.location.href = `/api/jobs/${selectedJobId}/download/docx`;
      showToast("Download do DOCX OpenXML iniciado", "info");
    }
  });

  // Save Job Description changes
  document.getElementById("btn-save-jd").addEventListener("click", async () => {
    if (!selectedJobId) return;
    const rawDescription = document.getElementById("jd-raw-text").value;
    const jobUrl = document.getElementById("jd-url-input").value;

    await fetch(`/api/jobs/${selectedJobId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawDescription, jobUrl })
    });
    showToast("Descrição da vaga salva e reindexada", "success");
    await loadJobs();
    selectJob(selectedJobId);
  });

  // Re-extract URL
  document.getElementById("btn-re-extract-url").addEventListener("click", async () => {
    const url = document.getElementById("jd-url-input").value.trim();
    if (!url) {
      showToast("URL da vaga não preenchida", "error");
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
        showToast("Dados re-extraídos da URL com sucesso", "success");
      } else {
        showToast(data.error || "Erro ao extrair", "error");
      }
    } catch {
      showToast("Erro de rede ao extrair", "error");
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

  // Extract from URL
  btnExtract.addEventListener("click", async () => {
    const url = urlInput.value.trim();
    if (!url) {
      feedback.textContent = "Insira uma URL válida.";
      return;
    }

    feedback.innerHTML = `<span class="text-cyan-400">Extraindo conteúdo, detectando idioma e calculando TF-IDF...</span>`;

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
        feedback.innerHTML = `<span class="text-emerald-400">✓ Extraído: ${data.company} • ${data.keywords.length} keywords detectadas</span>`;
      } else {
        feedback.innerHTML = `<span class="text-amber-400">${data.error}</span>`;
      }
    } catch {
      feedback.innerHTML = `<span class="text-rose-400">Erro na extração. Cole a descrição manualmente.</span>`;
    }
  });

  // Submit form
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
        showToast("Vaga adicionada ao tracker", "success");
        await loadJobs();
        selectJob(data.job.id);
      } else {
        showToast("Erro ao cadastrar vaga", "error");
      }
    } catch {
      showToast("Erro de rede ao salvar vaga", "error");
    }
  });
}

// ==========================================
// 6. MINIMALIST TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");

  const borderColors = {
    success: "border-emerald-500/40 text-emerald-300",
    error: "border-rose-500/40 text-rose-300",
    info: "border-zinc-700 text-zinc-200"
  };

  const icons = {
    success: '<i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-400"></i>',
    error: '<i data-lucide="alert-circle" class="w-3.5 h-3.5 text-rose-400"></i>',
    info: '<i data-lucide="info" class="w-3.5 h-3.5 text-cyan-400"></i>'
  };

  toast.className = `toast-enter pointer-events-auto flex items-center gap-2 px-3 py-2 rounded bg-[#0c0c0e] border ${borderColors[type]} shadow-xl text-xs font-mono`;
  toast.innerHTML = `
    ${icons[type] || ''}
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.2s ease";
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// Security Helper
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
