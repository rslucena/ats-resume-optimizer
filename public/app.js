// Global State
let currentMasterProfile = null;
let currentJobs = [];
let activeJobId = null;
let currentTailoredData = null;

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", async () => {
  setupNavigation();
  setupProfileForm();
  setupJobModal();
  setupOptimizerModal();

  await loadMasterProfile();
  await loadJobs();

  if (window.lucide) {
    window.lucide.createIcons();
  }
});

// 1. NAVIGATION
function setupNavigation() {
  const btnJobs = document.getElementById("nav-jobs");
  const btnProfile = document.getElementById("nav-profile");
  const viewJobs = document.getElementById("view-jobs");
  const viewProfile = document.getElementById("view-profile");

  btnJobs.addEventListener("click", () => {
    btnJobs.className = "tab-btn px-4 py-1.5 text-xs font-medium rounded-lg transition-all text-white bg-dark-700 shadow-sm flex items-center gap-2";
    btnProfile.className = "tab-btn px-4 py-1.5 text-xs font-medium rounded-lg transition-all text-slate-400 hover:text-white flex items-center gap-2";
    viewJobs.classList.remove("hidden");
    viewProfile.classList.add("hidden");
  });

  btnProfile.addEventListener("click", () => {
    btnProfile.className = "tab-btn px-4 py-1.5 text-xs font-medium rounded-lg transition-all text-white bg-dark-700 shadow-sm flex items-center gap-2";
    btnJobs.className = "tab-btn px-4 py-1.5 text-xs font-medium rounded-lg transition-all text-slate-400 hover:text-white flex items-center gap-2";
    viewProfile.classList.remove("hidden");
    viewJobs.classList.add("hidden");
  });
}

// 2. MASTER PROFILE
async function loadMasterProfile() {
  try {
    const res = await fetch("/api/profile");
    const data = await res.json();
    currentMasterProfile = data.profile;

    const badgeStatus = document.getElementById("badge-profile-status");
    if (currentMasterProfile && currentMasterProfile.fullName) {
      badgeStatus.className = "w-2 h-2 rounded-full bg-emerald-400";
      populateProfileForm(currentMasterProfile);
    } else {
      badgeStatus.className = "w-2 h-2 rounded-full bg-amber-400";
    }
  } catch (err) {
    console.error("Erro ao carregar perfil:", err);
  }
}

function populateProfileForm(p) {
  document.getElementById("prof-fullName").value = p.fullName || "";
  document.getElementById("prof-headline").value = p.headline || "";
  document.getElementById("prof-email").value = p.email || "";
  document.getElementById("prof-phone").value = p.phone || "";
  document.getElementById("prof-location").value = p.location || "";
  document.getElementById("prof-linkedin").value = p.linkedin || "";
  document.getElementById("prof-summary").value = p.summary || "";
  document.getElementById("prof-skills").value = (p.skills || []).join(", ");
  document.getElementById("prof-certifications").value = (p.certifications || []).join(", ");

  renderExperiencesInputs(p.experiences || []);
  renderEducationInputs(p.education || []);
}

function renderExperiencesInputs(exps) {
  const container = document.getElementById("experiences-container");
  container.innerHTML = "";

  exps.forEach((exp, idx) => {
    const card = document.createElement("div");
    card.className = "p-4 bg-dark-850 rounded-xl border border-white/5 space-y-3 relative";
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold text-slate-400">Experiência #${idx + 1}</span>
        <button type="button" class="btn-remove-exp text-rose-400 hover:text-rose-300 text-xs" data-idx="${idx}">
          Remover
        </button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input type="text" placeholder="Cargo" class="exp-role bg-dark-800 border border-white/10 rounded-lg p-2 text-xs text-white" value="${escapeHtml(exp.role || '')}" required>
        <input type="text" placeholder="Empresa" class="exp-company bg-dark-800 border border-white/10 rounded-lg p-2 text-xs text-white" value="${escapeHtml(exp.company || '')}" required>
        <input type="text" placeholder="Data Início (ex: 2021-01)" class="exp-start bg-dark-800 border border-white/10 rounded-lg p-2 text-xs text-white" value="${escapeHtml(exp.startDate || '')}">
        <input type="text" placeholder="Data Fim (ex: Atual)" class="exp-end bg-dark-800 border border-white/10 rounded-lg p-2 text-xs text-white" value="${escapeHtml(exp.endDate || '')}">
      </div>
      <textarea rows="3" placeholder="Descrição / Bullets da experiência" class="exp-desc w-full bg-dark-800 border border-white/10 rounded-lg p-2 text-xs text-white font-mono text-[11px]">${escapeHtml(exp.description || '')}</textarea>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".btn-remove-exp").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      currentMasterProfile.experiences.splice(idx, 1);
      renderExperiencesInputs(currentMasterProfile.experiences);
    });
  });
}

function renderEducationInputs(edus) {
  const container = document.getElementById("education-container");
  container.innerHTML = "";

  edus.forEach((edu, idx) => {
    const card = document.createElement("div");
    card.className = "p-3 bg-dark-850 rounded-xl border border-white/5 space-y-2 relative";
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold text-slate-400">Formação #${idx + 1}</span>
        <button type="button" class="btn-remove-edu text-rose-400 hover:text-rose-300 text-xs" data-idx="${idx}">
          Remover
        </button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input type="text" placeholder="Curso / Grau (ex: Bacharelado em Ciência da Computação)" class="edu-degree bg-dark-800 border border-white/10 rounded-lg p-2 text-xs text-white" value="${escapeHtml(edu.degree || '')}" required>
        <input type="text" placeholder="Instituição (ex: USP)" class="edu-inst bg-dark-800 border border-white/10 rounded-lg p-2 text-xs text-white" value="${escapeHtml(edu.institution || '')}" required>
        <input type="text" placeholder="Início" class="edu-start bg-dark-800 border border-white/10 rounded-lg p-2 text-xs text-white" value="${escapeHtml(edu.startDate || '')}">
        <input type="text" placeholder="Fim" class="edu-end bg-dark-800 border border-white/10 rounded-lg p-2 text-xs text-white" value="${escapeHtml(edu.endDate || '')}">
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".btn-remove-edu").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      currentMasterProfile.education.splice(idx, 1);
      renderEducationInputs(currentMasterProfile.education);
    });
  });
}

function setupProfileForm() {
  const form = document.getElementById("profile-form");
  const inputPdf = document.getElementById("input-upload-pdf");
  const uploadStatus = document.getElementById("upload-status");

  // PDF Upload handler
  inputPdf.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadStatus.innerHTML = `<span class="text-brand-400">Extraindo texto e estruturando dados...</span>`;
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/profile/upload", {
        method: "POST",
        body: fd
      });
      const data = await res.json();
      if (res.ok) {
        uploadStatus.innerHTML = `<span class="text-emerald-400">✓ PDF base extraído e salvo com sucesso!</span>`;
        await loadMasterProfile();
      } else {
        uploadStatus.innerHTML = `<span class="text-rose-400">${data.error || 'Erro no upload'}</span>`;
      }
    } catch (err) {
      uploadStatus.innerHTML = `<span class="text-rose-400">Erro de rede ao enviar PDF.</span>`;
    }
  });

  // Add Exp / Add Edu buttons
  document.getElementById("btn-add-exp").addEventListener("click", () => {
    if (!currentMasterProfile) currentMasterProfile = { experiences: [] };
    if (!currentMasterProfile.experiences) currentMasterProfile.experiences = [];
    currentMasterProfile.experiences.push({
      role: "",
      company: "",
      startDate: "",
      endDate: "",
      description: ""
    });
    renderExperiencesInputs(currentMasterProfile.experiences);
  });

  document.getElementById("btn-add-edu").addEventListener("click", () => {
    if (!currentMasterProfile) currentMasterProfile = { education: [] };
    if (!currentMasterProfile.education) currentMasterProfile.education = [];
    currentMasterProfile.education.push({
      degree: "",
      institution: "",
      startDate: "",
      endDate: ""
    });
    renderEducationInputs(currentMasterProfile.education);
  });

  // Save profile submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Collect experiences
    const expCards = document.querySelectorAll("#experiences-container > div");
    const experiences = [];
    expCards.forEach(card => {
      experiences.push({
        role: card.querySelector(".exp-role").value,
        company: card.querySelector(".exp-company").value,
        startDate: card.querySelector(".exp-start").value,
        endDate: card.querySelector(".exp-end").value,
        description: card.querySelector(".exp-desc").value
      });
    });

    // Collect education
    const eduCards = document.querySelectorAll("#education-container > div");
    const education = [];
    eduCards.forEach(card => {
      education.push({
        degree: card.querySelector(".edu-degree").value,
        institution: card.querySelector(".edu-inst").value,
        startDate: card.querySelector(".edu-start").value,
        endDate: card.querySelector(".edu-end").value
      });
    });

    const payload = {
      fullName: document.getElementById("prof-fullName").value,
      headline: document.getElementById("prof-headline").value,
      email: document.getElementById("prof-email").value,
      phone: document.getElementById("prof-phone").value,
      location: document.getElementById("prof-location").value,
      linkedin: document.getElementById("prof-linkedin").value,
      summary: document.getElementById("prof-summary").value,
      skills: document.getElementById("prof-skills").value.split(",").map(s => s.trim()).filter(Boolean),
      experiences,
      education,
      certifications: document.getElementById("prof-certifications").value.split(",").map(s => s.trim()).filter(Boolean)
    };

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("Currículo Base salvo com sucesso!");
        await loadMasterProfile();
      }
    } catch (err) {
      alert("Erro ao salvar currículo base.");
    }
  });
}

// 3. JOBS LIST & CRUD
async function loadJobs() {
  try {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    currentJobs = data.jobs || [];

    document.getElementById("badge-jobs-count").textContent = currentJobs.length;
    renderJobsTable(currentJobs);
  } catch (err) {
    console.error("Erro ao carregar vagas:", err);
  }
}

function renderJobsTable(jobs) {
  const tbody = document.getElementById("jobs-table-body");
  const search = document.getElementById("search-jobs").value.toLowerCase();
  const filter = document.getElementById("filter-status").value;

  const filtered = jobs.filter(j => {
    const matchesSearch = j.title.toLowerCase().includes(search) || j.company.toLowerCase().includes(search);
    const matchesStatus = filter === "ALL" || j.status === filter;
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-12 text-center text-slate-500">
          Nenhuma vaga cadastrada. Clique em "Nova Vaga" para começar!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = "";
  filtered.forEach(job => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-white/[0.02] transition-colors";

    const statusBadges = {
      SAVED: "bg-slate-500/10 text-slate-400 border-slate-500/20",
      APPLIED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      INTERVIEW: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      OFFER: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      REJECTED: "bg-rose-500/10 text-rose-400 border-rose-500/20"
    };

    const statusLabels = {
      SAVED: "Salva",
      APPLIED: "Aplicada",
      INTERVIEW: "Entrevista",
      OFFER: "Oferta",
      REJECTED: "Rejeitada"
    };

    const topKeywordsHtml = (job.topKeywords || []).slice(0, 5).map(k => `
      <span class="px-1.5 py-0.5 rounded bg-dark-800 text-[10px] text-slate-300 border border-white/5 font-mono">
        ${escapeHtml(k.term)}
      </span>
    `).join(" ");

    const scoreHtml = job.tailored ? `
      <div class="flex items-center gap-1.5">
        <span class="text-xs font-bold ${job.tailored.scoreAfter >= 80 ? 'text-emerald-400' : 'text-amber-400'}">
          ${job.tailored.scoreAfter}/100
        </span>
        <span class="text-[10px] text-slate-500">(era ${job.tailored.scoreBefore})</span>
      </div>
    ` : `
      <span class="text-[11px] text-slate-500 italic">Não personalizada</span>
    `;

    tr.innerHTML = `
      <td class="py-3.5 px-4">
        <div class="font-bold text-white text-xs">${escapeHtml(job.title)}</div>
        <div class="text-slate-400 text-[11px] flex items-center gap-1.5 mt-0.5">
          <span>${escapeHtml(job.company)}</span>
          ${job.jobUrl ? `<a href="${job.jobUrl}" target="_blank" class="text-cyan-400 hover:underline"><i data-lucide="external-link" class="w-3 h-3 inline"></i></a>` : ''}
        </div>
      </td>
      <td class="py-3.5 px-4">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadges[job.status]}">
          ${statusLabels[job.status]}
        </span>
      </td>
      <td class="py-3.5 px-4">
        <div class="flex items-center gap-1.5 mb-1">
          <span class="px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 text-[9px] font-bold border border-cyan-500/20 uppercase">
            ${job.language.toUpperCase()}
          </span>
          <span class="text-[10px] text-slate-400">${(job.topKeywords || []).length} keywords</span>
        </div>
        <div class="flex flex-wrap gap-1">
          ${topKeywordsHtml}
        </div>
      </td>
      <td class="py-3.5 px-4">
        ${scoreHtml}
      </td>
      <td class="py-3.5 px-4 text-right">
        <div class="flex items-center justify-end gap-1.5">
          <button class="btn-tailor px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1 transition-all" data-id="${job.id}">
            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
            <span>⚡ Personalizar</span>
          </button>
          <button class="btn-delete-job p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors" data-id="${job.id}">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Action listeners
  tbody.querySelectorAll(".btn-tailor").forEach(btn => {
    btn.addEventListener("click", () => openOptimizerModal(btn.dataset.id));
  });

  tbody.querySelectorAll(".btn-delete-job").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (confirm("Deseja realmente remover esta vaga?")) {
        await fetch(`/api/jobs/${btn.dataset.id}`, { method: "DELETE" });
        await loadJobs();
      }
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

// 4. ADD / EDIT JOB MODAL
function setupJobModal() {
  const modal = document.getElementById("modal-job");
  const btnOpen = document.getElementById("btn-open-add-job");
  const btnClose = document.getElementById("modal-job-close");
  const btnCancel = document.getElementById("modal-job-cancel");
  const form = document.getElementById("job-form");
  const btnExtract = document.getElementById("btn-extract-url");
  const urlInput = document.getElementById("job-url-input");
  const extractFeedback = document.getElementById("extract-feedback");

  btnOpen.addEventListener("click", () => {
    form.reset();
    document.getElementById("job-id").value = "";
    document.getElementById("modal-job-title").textContent = "Cadastrar Vaga de Emprego";
    extractFeedback.textContent = "";
    modal.classList.remove("hidden");
  });

  btnClose.addEventListener("click", () => modal.classList.add("hidden"));
  btnCancel.addEventListener("click", () => modal.classList.add("hidden"));

  // Extract from URL button
  btnExtract.addEventListener("click", async () => {
    const url = urlInput.value.trim();
    if (!url) {
      extractFeedback.textContent = "Insira uma URL válida.";
      return;
    }

    extractFeedback.innerHTML = `<span class="text-cyan-400">Buscando página, detectando idioma e calculando pesos TF-IDF...</span>`;

    try {
      const res = await fetch("/api/jobs/extract-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await res.json();

      if (res.ok) {
        document.getElementById("form-job-title").value = data.title || "";
        document.getElementById("form-job-company").value = data.company || "";
        document.getElementById("form-job-description").value = data.description || "";
        extractFeedback.innerHTML = `<span class="text-emerald-400">✓ Extraído com sucesso! Idioma: ${data.language.toUpperCase()} • ${data.keywords.length} keywords identificadas.</span>`;
      } else {
        extractFeedback.innerHTML = `<span class="text-amber-400">${data.error} Cole a descrição manualmente abaixo.</span>`;
      }
    } catch (err) {
      extractFeedback.innerHTML = `<span class="text-rose-400">Erro na conexão. Cole a descrição manualmente.</span>`;
    }
  });

  // Submit job
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById("form-job-title").value,
      company: document.getElementById("form-job-company").value,
      jobUrl: urlInput.value.trim() || undefined,
      status: document.getElementById("form-job-status").value,
      notes: document.getElementById("form-job-notes").value,
      rawDescription: document.getElementById("form-job-description").value
    };

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        modal.classList.add("hidden");
        await loadJobs();
      } else {
        alert("Erro ao cadastrar vaga.");
      }
    } catch (err) {
      alert("Erro na conexão com o servidor.");
    }
  });

  // Filter events
  document.getElementById("search-jobs").addEventListener("input", () => renderJobsTable(currentJobs));
  document.getElementById("filter-status").addEventListener("change", () => renderJobsTable(currentJobs));
}

// 5. SIDE-BY-SIDE OPTIMIZER MODAL
function setupOptimizerModal() {
  const modal = document.getElementById("modal-optimizer");
  const btnClose = document.getElementById("opt-modal-close");
  const btnRecalc = document.getElementById("btn-recalculate-score");
  const btnPdf = document.getElementById("btn-download-pdf");
  const btnDocx = document.getElementById("btn-download-docx");

  btnClose.addEventListener("click", () => modal.classList.add("hidden"));

  btnRecalc.addEventListener("click", async () => {
    if (!activeJobId || !currentTailoredData) return;

    btnRecalc.innerHTML = `<i data-lucide="loader" class="w-3 h-3 animate-spin"></i> Recalculando...`;

    // Gather edited tailored resume
    const editedHeadline = document.getElementById("edit-tailored-headline").value;
    const editedSummary = document.getElementById("edit-tailored-summary").value;
    const editedSkills = document.getElementById("edit-tailored-skills").value.split(",").map(s => s.trim()).filter(Boolean);

    const expTextareas = document.querySelectorAll("#edit-tailored-experiences textarea");
    const editedExperiences = currentTailoredData.tailoredResume.experiences.map((exp, idx) => ({
      ...exp,
      description: expTextareas[idx] ? expTextareas[idx].value : exp.description
    }));

    const updatedResume = {
      ...currentTailoredData.tailoredResume,
      headline: editedHeadline,
      summary: editedSummary,
      skills: editedSkills,
      experiences: editedExperiences
    };

    try {
      const res = await fetch(`/api/jobs/${activeJobId}/tailor`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tailoredResume: updatedResume })
      });
      const data = await res.json();
      if (res.ok) {
        currentTailoredData.tailoredResume = updatedResume;
        currentTailoredData.scoreAfter = data.scoreAfter;
        currentTailoredData.auditAfter = data.auditAfter;
        renderOptimizerData(currentTailoredData);
      }
    } catch (err) {
      alert("Erro ao recalcular score.");
    } finally {
      btnRecalc.innerHTML = `<i data-lucide="refresh-cw" class="w-3 h-3"></i> Recalcular Score`;
      if (window.lucide) window.lucide.createIcons();
    }
  });

  btnPdf.addEventListener("click", () => {
    if (activeJobId) {
      window.location.href = `/api/jobs/${activeJobId}/download/pdf`;
    }
  });

  btnDocx.addEventListener("click", () => {
    if (activeJobId) {
      window.location.href = `/api/jobs/${activeJobId}/download/docx`;
    }
  });
}

async function openOptimizerModal(jobId) {
  if (!currentMasterProfile || !currentMasterProfile.fullName) {
    alert("Cadastre seu Currículo Base antes de personalizar para uma vaga.");
    document.getElementById("nav-profile").click();
    return;
  }

  activeJobId = jobId;
  const modal = document.getElementById("modal-optimizer");
  modal.classList.remove("hidden");

  // Show loading in modal
  document.getElementById("preview-master-cv").innerHTML = `
    <div class="py-12 text-center text-slate-500">
      <i data-lucide="loader" class="w-6 h-6 animate-spin mx-auto mb-2 text-brand-400"></i>
      Processando as 7 camadas algorítmicas de ATS...
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();

  try {
    const res = await fetch(`/api/jobs/${jobId}/tailor`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Erro ao personalizar currículo.");
      modal.classList.add("hidden");
      return;
    }

    currentTailoredData = data;
    renderOptimizerData(data);
    await loadJobs(); // Refresh table score
  } catch (err) {
    alert("Erro na conexão ao personalizar currículo.");
    modal.classList.add("hidden");
  }
}

function renderOptimizerData(data) {
  const { tailoredResume, scoreBefore, scoreAfter, auditAfter, metadata } = data;

  // Header info
  document.getElementById("opt-job-header").textContent = `Otimização: ${metadata.title}`;
  document.getElementById("opt-company-sub").textContent = `${metadata.author} • Preparado para ${metadata.title}`;

  // Scores
  document.getElementById("opt-score-before").textContent = `${scoreBefore}/100`;
  document.getElementById("opt-score-after").textContent = `${scoreAfter}/100`;

  // Breakdown
  document.getElementById("metric-formatting").textContent = `${auditAfter.breakdown.formatting}/30`;
  document.getElementById("metric-keywords").textContent = `${auditAfter.breakdown.keywords}/35`;
  document.getElementById("metric-density").textContent = `${auditAfter.breakdown.density}/20`;
  document.getElementById("metric-entity").textContent = `${auditAfter.breakdown.entityCompliance}/15`;

  // Keyword Chips
  const chipsContainer = document.getElementById("opt-keywords-chips");
  chipsContainer.innerHTML = "";

  const density = auditAfter.keywordDensity || {};
  const matched = new Set(auditAfter.matchedKeywords.map(k => k.toLowerCase()));

  metadata.keywords.forEach(kw => {
    const lower = kw.toLowerCase();
    const count = density[lower] || 0;
    const isMatched = matched.has(lower) || count > 0;

    let badgeClass = "bg-rose-500/10 text-rose-400 border-rose-500/20";
    if (count >= 2) {
      badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    } else if (isMatched || count === 1) {
      badgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }

    const chip = document.createElement("span");
    chip.className = `px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${badgeClass}`;
    chip.innerHTML = `
      <span>${escapeHtml(kw)}</span>
      <span class="text-[9px] opacity-75 font-mono">(${count}x)</span>
    `;
    chipsContainer.appendChild(chip);
  });

  // Render Master CV Preview (Left column)
  const masterPreview = document.getElementById("preview-master-cv");
  masterPreview.innerHTML = `
    <div>
      <h4 class="text-sm font-bold text-white">${escapeHtml(currentMasterProfile.fullName)}</h4>
      <div class="text-slate-400 text-[11px]">${escapeHtml(currentMasterProfile.headline)}</div>
      <div class="text-[10px] text-slate-500 mt-0.5">${escapeHtml(currentMasterProfile.email)} | ${escapeHtml(currentMasterProfile.phone || '')}</div>
    </div>

    <div>
      <h5 class="text-[10px] font-bold uppercase text-slate-400 border-b border-white/5 pb-1">Resumo Original</h5>
      <p class="mt-1 text-slate-300 leading-relaxed">${escapeHtml(currentMasterProfile.summary)}</p>
    </div>

    <div>
      <h5 class="text-[10px] font-bold uppercase text-slate-400 border-b border-white/5 pb-1">Experiências Originais</h5>
      <div class="space-y-3 mt-1.5">
        ${currentMasterProfile.experiences.map(exp => `
          <div>
            <div class="font-bold text-white text-[11px]">${escapeHtml(exp.role)} — ${escapeHtml(exp.company)}</div>
            <div class="text-[10px] text-slate-500">${escapeHtml(exp.startDate)} - ${escapeHtml(exp.endDate)}</div>
            <div class="mt-1 text-[11px] text-slate-300 whitespace-pre-line">${escapeHtml(exp.description)}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div>
      <h5 class="text-[10px] font-bold uppercase text-slate-400 border-b border-white/5 pb-1">Habilidades</h5>
      <div class="mt-1 text-slate-300">${(currentMasterProfile.skills || []).join(' • ')}</div>
    </div>
  `;

  // Render Tailored CV Editor (Right column)
  document.getElementById("edit-tailored-headline").value = tailoredResume.headline;
  document.getElementById("edit-tailored-summary").value = tailoredResume.summary;
  document.getElementById("edit-tailored-skills").value = (tailoredResume.skills || []).join(", ");

  const expContainer = document.getElementById("edit-tailored-experiences");
  expContainer.innerHTML = "";

  tailoredResume.experiences.forEach((exp, idx) => {
    const card = document.createElement("div");
    card.className = "p-3 bg-dark-850 rounded-xl border border-white/5 space-y-1.5";
    card.innerHTML = `
      <div class="flex items-center justify-between text-[11px] font-bold text-white">
        <span>${escapeHtml(exp.role)} — ${escapeHtml(exp.company)}</span>
        <span class="text-[10px] text-slate-400">${escapeHtml(exp.startDate)} - ${escapeHtml(exp.endDate)}</span>
      </div>
      <textarea rows="4" class="w-full bg-dark-800 border border-white/10 rounded-lg p-2 text-[11px] text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-brand-500">${escapeHtml(exp.description)}</textarea>
    `;
    expContainer.appendChild(card);
  });

  if (window.lucide) window.lucide.createIcons();
}

// Security helper
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
