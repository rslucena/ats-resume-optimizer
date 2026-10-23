// ============================================================================
// ATS Optimizer Studio — App Frontend Logic
// Ergonomic, Fluid, Collapsible Sidebars & Theme Engine
// ============================================================================

// Global State
let currentMasterProfile = null;
let currentJobs = [];
let selectedJobId = null;
let activeJobData = null;
let currentFilterStatus = "ALL";
let currentSearchQuery = "";
let currentScannabilityDisplay = 0;
let currentTechnicalDisplay = 0;
let currentKnockoutQuestions = [];
let hasGeminiKey = false;
let hasClaudeKey = false;
let hasOpenRouterKey = false;
let hasOllama = false;
let ollamaInfo = null;
let claudeInfo = null;
let openRouterInfo = null;
let currentTailorEngine = "local";

// On DOM Loaded
document.addEventListener("DOMContentLoaded", async () => {
  setupThemeSwitcher();
  setupCollapsibleSidebars();
  setupResizableDividers();
  setupSidebarNavigation();
  setupProfileDrawer();
  setupAddJobModal();
  setupWorkbenchTabs();
  await checkSystemConfig();
  setupWorkbenchActions();
  setupEmptyStateActions();
  setupKnockoutQuestionsEvents();
  setupCoverLetterStudio();

  await loadMasterProfile();
  await loadJobs();

  if (window.lucide) {
    window.lucide.createIcons();
  }
});

// ============================================================================
// 1. THEME SWITCHER (Light, Dark, System via Semantic CSS Variables)
// ============================================================================
function setupThemeSwitcher() {
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function updateThemeUI(resolvedTheme) {
    if (!themeToggleBtn) return;
    const isDark = resolvedTheme === "dark";
    themeToggleBtn.title = isDark
      ? "Alternar para modo claro"
      : "Alternar para modo escuro";
    themeToggleBtn.innerHTML = isDark
      ? `<i data-lucide="sun" id="theme-toggle-icon" class="w-4 h-4 text-amber-400"></i>`
      : `<i data-lucide="moon" id="theme-toggle-icon" class="w-4 h-4 text-zinc-600"></i>`;
    if (window.lucide) window.lucide.createIcons();
  }

  function applyTheme(themeMode) {
    let resolvedTheme = themeMode;
    if (themeMode === "system") {
      resolvedTheme = mediaQuery.matches ? "dark" : "light";
    }

    document.documentElement.setAttribute("data-theme", resolvedTheme);
    localStorage.setItem("ats_theme", resolvedTheme);
    updateThemeUI(resolvedTheme);
  }

  // Toggle on single button click
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const current =
        document.documentElement.getAttribute("data-theme") || "dark";
      const nextTheme = current === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
    });
  }

  // Listen for OS color scheme changes
  mediaQuery.addEventListener("change", (e) => {
    const saved = localStorage.getItem("ats_theme");
    if (!saved) {
      applyTheme(e.matches ? "dark" : "light");
    }
  });

  // Initial theme on boot
  const initialTheme =
    localStorage.getItem("ats_theme") ||
    (mediaQuery.matches ? "dark" : "light");
  applyTheme(initialTheme);
}

// ============================================================================
// 2. COLLAPSIBLE SIDEBARS & SHORTCUTS (Ctrl+B, Ctrl+J / Ctrl+I)
// ============================================================================
function setupCollapsibleSidebars() {
  const sidebarLeft = document.getElementById("sidebar-left");
  const sidebarLeftCollapsed = document.getElementById(
    "sidebar-left-collapsed",
  );
  const resizerLeft = document.getElementById("resizer-left");
  const btnToggleLeft = document.getElementById("btn-toggle-sidebar-left");
  const btnReopenLeft = document.getElementById("btn-reopen-sidebar-left");

  const sidebarRight = document.getElementById("sidebar-right");
  const sidebarRightCollapsed = document.getElementById(
    "sidebar-right-collapsed",
  );
  const resizerRight = document.getElementById("resizer-right");
  const btnToggleRight = document.getElementById("btn-toggle-sidebar-right");
  const btnCloseRight = document.getElementById("btn-close-sidebar-right");
  const btnReopenRight = document.getElementById("btn-reopen-sidebar-right");

  function setSidebarLeft(collapsed, save = true) {
    if (!sidebarLeft) return;
    if (collapsed) {
      sidebarLeft.classList.add("collapsed");
      sidebarLeft.classList.add("hidden");
      if (sidebarLeftCollapsed) sidebarLeftCollapsed.classList.remove("hidden");
      if (resizerLeft) resizerLeft.classList.add("hidden");
    } else {
      sidebarLeft.classList.remove("collapsed");
      sidebarLeft.classList.remove("hidden");
      if (sidebarLeftCollapsed) sidebarLeftCollapsed.classList.add("hidden");
      if (resizerLeft) resizerLeft.classList.remove("hidden");
      const savedWidth =
        parseInt(localStorage.getItem("ats_sidebar_left_width"), 10) || 360;
      sidebarLeft.style.width = `${savedWidth}px`;
    }
    if (save) {
      localStorage.setItem(
        "ats_sidebar_left",
        collapsed ? "collapsed" : "open",
      );
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function setSidebarRight(collapsed, save = true) {
    if (!sidebarRight) return;
    if (collapsed) {
      sidebarRight.classList.add("collapsed");
      sidebarRight.classList.add("hidden");
      if (sidebarRightCollapsed)
        sidebarRightCollapsed.classList.remove("hidden");
      if (resizerRight) resizerRight.classList.add("hidden");
      if (btnToggleRight) {
        btnToggleRight.innerHTML = `<i data-lucide="panel-right-open" class="w-4 h-4"></i>`;
        btnToggleRight.title = "Expandir Painel Inspetor (Ctrl+J ou Ctrl+I)";
      }
    } else {
      sidebarRight.classList.remove("collapsed");
      sidebarRight.classList.remove("hidden");
      if (sidebarRightCollapsed) sidebarRightCollapsed.classList.add("hidden");
      if (resizerRight) resizerRight.classList.remove("hidden");
      if (btnToggleRight) {
        btnToggleRight.innerHTML = `<i data-lucide="panel-right-close" class="w-4 h-4"></i>`;
        btnToggleRight.title = "Recolher Painel Inspetor (Ctrl+J ou Ctrl+I)";
      }
      const savedWidth =
        parseInt(localStorage.getItem("ats_sidebar_right_width"), 10) || 400;
      sidebarRight.style.width = `${savedWidth}px`;
    }
    if (save) {
      localStorage.setItem(
        "ats_sidebar_right",
        collapsed ? "collapsed" : "open",
      );
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function toggleSidebarLeft() {
    const isCollapsed =
      sidebarLeft?.classList.contains("collapsed") ||
      sidebarLeft?.classList.contains("hidden");
    setSidebarLeft(!isCollapsed);
  }

  function toggleSidebarRight() {
    const isCollapsed =
      sidebarRight?.classList.contains("collapsed") ||
      sidebarRight?.classList.contains("hidden");
    setSidebarRight(!isCollapsed);
  }

  // Left Sidebar listeners
  if (btnToggleLeft)
    btnToggleLeft.addEventListener("click", () => setSidebarLeft(true));
  if (btnReopenLeft)
    btnReopenLeft.addEventListener("click", (e) => {
      e.stopPropagation();
      setSidebarLeft(false);
    });
  if (sidebarLeftCollapsed)
    sidebarLeftCollapsed.addEventListener("click", () => setSidebarLeft(false));

  // Right Sidebar listeners
  if (btnCloseRight)
    btnCloseRight.addEventListener("click", () => setSidebarRight(true));
  if (btnToggleRight)
    btnToggleRight.addEventListener("click", toggleSidebarRight);
  if (btnReopenRight)
    btnReopenRight.addEventListener("click", (e) => {
      e.stopPropagation();
      setSidebarRight(false);
    });
  if (sidebarRightCollapsed)
    sidebarRightCollapsed.addEventListener("click", () =>
      setSidebarRight(false),
    );

  // Keyboard Shortcuts: Ctrl+B (Left), Ctrl+J or Ctrl+I (Right)
  window.addEventListener("keydown", (e) => {
    const activeTag = document.activeElement?.tagName;
    const isEditing =
      ["INPUT", "TEXTAREA"].includes(activeTag) && !e.ctrlKey && !e.metaKey;
    if (isEditing) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleSidebarLeft();
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key.toLowerCase() === "j" || e.key.toLowerCase() === "i")
    ) {
      e.preventDefault();
      toggleSidebarRight();
    }
  });

  // Restore saved states from localStorage (responsive default on tablet/phone <= 1024px)
  const isCompactScreen = window.innerWidth <= 1024;
  const savedLeft = localStorage.getItem("ats_sidebar_left");
  if (savedLeft === "collapsed" || (isCompactScreen && savedLeft !== "open")) {
    setSidebarLeft(true, false);
  }

  const savedRight = localStorage.getItem("ats_sidebar_right");
  if (
    savedRight === "collapsed" ||
    (isCompactScreen && savedRight !== "open")
  ) {
    setSidebarRight(true, false);
  }
}

// ============================================================================
// 2.1 FLEXIBLE RESIZABLE DIVIDERS (Splitters & Gutters)
// ============================================================================
function setupResizableDividers() {
  const sidebarLeft = document.getElementById("sidebar-left");
  const resizerLeft = document.getElementById("resizer-left");

  const sidebarRight = document.getElementById("sidebar-right");
  const resizerRight = document.getElementById("resizer-right");

  const diffPaneLeft = document.getElementById("diff-pane-left");
  const diffPaneRight = document.getElementById("diff-pane-right");
  const resizerDiff = document.getElementById("resizer-diff");

  // Load saved widths
  const savedLeftWidth =
    parseInt(localStorage.getItem("ats_sidebar_left_width"), 10) || 360;
  const savedRightWidth =
    parseInt(localStorage.getItem("ats_sidebar_right_width"), 10) || 400;

  if (sidebarLeft && !sidebarLeft.classList.contains("collapsed")) {
    sidebarLeft.style.width = `${savedLeftWidth}px`;
  }
  if (sidebarRight && !sidebarRight.classList.contains("collapsed")) {
    sidebarRight.style.width = `${savedRightWidth}px`;
  }

  // Generic helper for drag resizing
  function createDragHandler({ resizer, onMove, onEnd, onDoubleClick }) {
    if (!resizer) return;

    resizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      document.body.classList.add("is-resizing");
      resizer.classList.add("is-dragging");

      const startX = e.clientX;

      function onMouseMove(moveEvent) {
        onMove(moveEvent, startX);
      }

      function onMouseUp(upEvent) {
        document.body.classList.remove("is-resizing");
        resizer.classList.remove("is-dragging");
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        if (onEnd) onEnd(upEvent);
      }

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });

    if (onDoubleClick) {
      resizer.addEventListener("dblclick", onDoubleClick);
    }
  }

  // 1. Resizer Left (Sidebar Left / Center)
  createDragHandler({
    resizer: resizerLeft,
    onMove: (e) => {
      if (!sidebarLeft) return;
      const newWidth = Math.max(260, Math.min(e.clientX, 650));
      sidebarLeft.style.width = `${newWidth}px`;
    },
    onEnd: () => {
      if (!sidebarLeft) return;
      const width = parseInt(sidebarLeft.style.width, 10);
      localStorage.setItem("ats_sidebar_left_width", width);
    },
    onDoubleClick: () => {
      if (!sidebarLeft) return;
      sidebarLeft.style.width = "360px";
      localStorage.setItem("ats_sidebar_left_width", "360");
    },
  });

  // 2. Resizer Right (Center / Inspetor ATS)
  createDragHandler({
    resizer: resizerRight,
    onMove: (e) => {
      if (!sidebarRight) return;
      const windowWidth = window.innerWidth;
      const newWidth = Math.max(300, Math.min(windowWidth - e.clientX, 750));
      sidebarRight.style.width = `${newWidth}px`;
    },
    onEnd: () => {
      if (!sidebarRight) return;
      const width = parseInt(sidebarRight.style.width, 10);
      localStorage.setItem("ats_sidebar_right_width", width);
    },
    onDoubleClick: () => {
      if (!sidebarRight) return;
      sidebarRight.style.width = "400px";
      localStorage.setItem("ats_sidebar_right_width", "400");
    },
  });

  // 3. Resizer Diff (Master CV vs Tailored CV inside Editor)
  if (resizerDiff && diffPaneLeft && diffPaneRight) {
    const savedDiffRatio =
      parseFloat(localStorage.getItem("ats_diff_split_ratio")) || 0.5;
    diffPaneLeft.style.flex = `${savedDiffRatio} 1 0%`;
    diffPaneRight.style.flex = `${1 - savedDiffRatio} 1 0%`;

    createDragHandler({
      resizer: resizerDiff,
      onMove: (e) => {
        const parent = resizerDiff.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const totalWidth = rect.width;
        let ratio = offsetX / totalWidth;
        ratio = Math.max(0.25, Math.min(ratio, 0.75));

        diffPaneLeft.style.flex = `${ratio} 1 0%`;
        diffPaneRight.style.flex = `${1 - ratio} 1 0%`;
      },
      onEnd: () => {
        const flexStr = diffPaneLeft.style.flex;
        const match = flexStr.match(/^([\d.]+)/);
        if (match) {
          localStorage.setItem("ats_diff_split_ratio", match[1]);
        }
      },
      onDoubleClick: () => {
        diffPaneLeft.style.flex = "1 1 50%";
        diffPaneRight.style.flex = "1 1 50%";
        localStorage.setItem("ats_diff_split_ratio", "0.5");
      },
    });
  }
}

// ============================================================================
// 3. EMPTY STATE & QUICK START ACTIONS
// ============================================================================
function setupEmptyStateActions() {
  const btnEmptyAddJob = document.getElementById("btn-empty-add-job");
  if (btnEmptyAddJob) {
    btnEmptyAddJob.addEventListener("click", () => {
      document.getElementById("btn-open-add-job")?.click();
    });
  }

  const btnEmptyConfigMaster = document.getElementById(
    "btn-empty-config-master",
  );
  if (btnEmptyConfigMaster) {
    btnEmptyConfigMaster.addEventListener("click", () => {
      openProfileDrawer();
    });
  }

  const btnSidebarEditMaster = document.getElementById(
    "btn-sidebar-edit-master",
  );
  if (btnSidebarEditMaster) {
    btnSidebarEditMaster.addEventListener("click", () => {
      openProfileDrawer();
    });
  }
}

function showWorkbenchEmpty() {
  const emptyEl = document.getElementById("workbench-empty");
  const activeEl = document.getElementById("workbench-active");
  const breadcrumbEmpty = document.getElementById("header-breadcrumb-empty");
  const breadcrumbActive = document.getElementById("header-breadcrumb-active");
  const headerActions = document.getElementById("header-job-actions");

  if (emptyEl) emptyEl.classList.remove("hidden");
  if (activeEl) activeEl.classList.add("hidden");
  if (breadcrumbEmpty) breadcrumbEmpty.classList.remove("hidden");
  if (breadcrumbActive) {
    breadcrumbActive.classList.add("hidden");
    breadcrumbActive.classList.remove("flex");
  }
  if (headerActions) {
    headerActions.classList.add("hidden");
    headerActions.classList.remove("flex");
  }
}

function showWorkbenchActive() {
  const emptyEl = document.getElementById("workbench-empty");
  const activeEl = document.getElementById("workbench-active");
  const breadcrumbEmpty = document.getElementById("header-breadcrumb-empty");
  const breadcrumbActive = document.getElementById("header-breadcrumb-active");
  const headerActions = document.getElementById("header-job-actions");

  if (emptyEl) emptyEl.classList.add("hidden");
  if (activeEl) {
    activeEl.classList.remove("hidden");
    activeEl.classList.remove("fade-slide-up");
    void activeEl.offsetWidth; // trigger reflow for animation
    activeEl.classList.add("fade-slide-up");
  }
  if (breadcrumbEmpty) breadcrumbEmpty.classList.add("hidden");
  if (breadcrumbActive) {
    breadcrumbActive.classList.remove("hidden");
    breadcrumbActive.classList.add("flex");
  }
  if (headerActions) {
    headerActions.classList.remove("hidden");
    headerActions.classList.add("flex");
  }
}

// ============================================================================
// 4. ANIMATED SCORE COUNT UP (Física de Movimento & Dual-Score)
// ============================================================================
function animateDualScores(scannabilityTarget, technicalTarget) {
  const scanEl = document.getElementById("inspect-scannability-val");
  const techEl = document.getElementById("inspect-technical-val");
  const legacyEl = document.getElementById("inspect-score-val");

  if (
    scannabilityTarget === null ||
    scannabilityTarget === undefined ||
    Number.isNaN(scannabilityTarget)
  ) {
    if (scanEl) scanEl.textContent = "--";
    if (techEl) techEl.textContent = "--";
    if (legacyEl) legacyEl.textContent = "--";
    currentScannabilityDisplay = 0;
    currentTechnicalDisplay = 0;
    return;
  }

  const startScan = currentScannabilityDisplay;
  const targetScan = Math.min(100, Math.max(0, Math.round(scannabilityTarget)));

  const startTech = currentTechnicalDisplay;
  const targetTech = Math.min(100, Math.max(0, Math.round(technicalTarget)));

  const duration = 500;
  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - (1 - progress) * (1 - progress);

    const valScan = Math.round(
      startScan + (targetScan - startScan) * easeProgress,
    );
    const valTech = Math.round(
      startTech + (targetTech - startTech) * easeProgress,
    );

    if (scanEl) scanEl.textContent = valScan;
    if (techEl) techEl.textContent = valTech;
    if (legacyEl) legacyEl.textContent = valTech;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      if (scanEl) scanEl.textContent = targetScan;
      if (techEl) techEl.textContent = targetTech;
      if (legacyEl) legacyEl.textContent = targetTech;
      currentScannabilityDisplay = targetScan;
      currentTechnicalDisplay = targetTech;
    }
  }

  requestAnimationFrame(update);
}

function animateScoreCountUp(targetVal) {
  animateDualScores(targetVal, targetVal);
}

// ============================================================================
// 5. MASTER PROFILE (loadMasterProfile preserved for static tests)
// ============================================================================
async function loadMasterProfile() {
  try {
    const res = await fetch("/api/profile");
    const data = await res.json();
    currentMasterProfile = data.profile;

    const nameEl = document.getElementById("sidebar-master-name");
    const statusTextEl = document.getElementById("sidebar-master-status-text");
    const dotEl = document.getElementById("sidebar-master-dot");
    const legacyStatusEl = document.getElementById("sidebar-master-status");

    if (currentMasterProfile?.fullName) {
      if (nameEl) nameEl.textContent = currentMasterProfile.fullName;
      if (statusTextEl) statusTextEl.textContent = "Pronto para matching";
      if (dotEl) {
        dotEl.className = "w-2 h-2 rounded-full bg-emerald-500";
      }
      if (legacyStatusEl) {
        legacyStatusEl.textContent = `Master: ${currentMasterProfile.fullName}`;
        legacyStatusEl.className = "truncate text-zinc-300";
      }
      populateDrawerForm(currentMasterProfile);
    } else {
      if (nameEl) nameEl.textContent = "Pendente de Configuração";
      if (statusTextEl)
        statusTextEl.textContent = "Clique em Editar para importar PDF";
      if (dotEl) {
        dotEl.className = "w-2 h-2 rounded-full bg-amber-500";
      }
      if (legacyStatusEl) {
        legacyStatusEl.textContent = "Master: Pendente";
        legacyStatusEl.className = "truncate text-amber-500";
      }
    }
  } catch (err) {
    console.error("Erro ao carregar master profile:", err);
  }
}

function openProfileDrawer() {
  const drawer = document.getElementById("drawer-profile");
  if (currentMasterProfile) populateDrawerForm(currentMasterProfile);
  if (drawer) drawer.classList.remove("hidden");
  if (window.lucide) window.lucide.createIcons();
}

function setupProfileDrawer() {
  const drawer = document.getElementById("drawer-profile");
  const btnClose = document.getElementById("drawer-profile-close");
  const btnCancel = document.getElementById("btn-drawer-cancel");
  const form = document.getElementById("master-profile-form");
  const dropzone = document.getElementById("pdf-dropzone");
  const fileInput = document.getElementById("drawer-pdf-input");
  const uploadStatus = document.getElementById("drawer-upload-status");

  const closeDrawer = () => {
    if (drawer) drawer.classList.add("hidden");
  };
  if (btnClose) btnClose.addEventListener("click", closeDrawer);
  if (btnCancel) btnCancel.addEventListener("click", closeDrawer);

  // Fechar ao clicar no background externo (backdrop)
  if (drawer) {
    let startedOnBackdrop = false;
    drawer.addEventListener("mousedown", (e) => {
      startedOnBackdrop = e.target === drawer;
    });
    drawer.addEventListener("click", (e) => {
      if (e.target === drawer && startedOnBackdrop) {
        closeDrawer();
      }
      startedOnBackdrop = false;
    });
  }

  // Fechar ao pressionar tecla Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer && !drawer.classList.contains("hidden")) {
      closeDrawer();
    }
  });

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("border-emerald-500");
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("border-emerald-500");
    });
    dropzone.addEventListener("drop", async (e) => {
      e.preventDefault();
      dropzone.classList.remove("border-emerald-500");
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
  }

  async function uploadPdfFile(file) {
    if (uploadStatus)
      uploadStatus.innerHTML = `<span class="text-zinc-400">Processando PDF...</span>`;
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/profile/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        if (uploadStatus)
          uploadStatus.innerHTML = `<span class="text-emerald-400 font-medium">PDF extraído com sucesso</span>`;
        showToast("Master CV atualizado via PDF", "success");
        await loadMasterProfile();
        if (selectedJobId) selectJob(selectedJobId);
      } else {
        if (uploadStatus)
          uploadStatus.innerHTML = `<span class="text-rose-400">${data.error || "Erro no upload"}</span>`;
        showToast("Falha na extração do PDF", "error");
      }
    } catch {
      if (uploadStatus)
        uploadStatus.innerHTML = `<span class="text-rose-400">Erro de rede</span>`;
    }
  }

  // Add Exp & Edu in drawer
  const btnAddExp = document.getElementById("btn-drawer-add-exp");
  if (btnAddExp) {
    btnAddExp.addEventListener("click", () => {
      const exps = collectDrawerExperiences();
      exps.push({
        role: "",
        company: "",
        startDate: "",
        endDate: "",
        description: "",
      });
      if (!currentMasterProfile) currentMasterProfile = {};
      currentMasterProfile.experiences = exps;
      renderDrawerExperiences(exps);
    });
  }

  const btnAddEdu = document.getElementById("btn-drawer-add-edu");
  if (btnAddEdu) {
    btnAddEdu.addEventListener("click", () => {
      const edus = collectDrawerEducation();
      edus.push({ degree: "", institution: "", startDate: "", endDate: "" });
      if (!currentMasterProfile) currentMasterProfile = {};
      currentMasterProfile.education = edus;
      renderDrawerEducation(edus);
    });
  }

  // Reprocess button: Re-extracts stored rawText with smart parser v2
  const btnReprocess = document.getElementById("btn-reprocess-master");
  if (btnReprocess) {
    btnReprocess.addEventListener("click", async () => {
      const origHtml = btnReprocess.innerHTML;
      btnReprocess.disabled = true;
      btnReprocess.innerHTML = `<span class="inline-block animate-spin mr-1">⏳</span> Limpando...`;
      try {
        const res = await fetch("/api/profile/reprocess", { method: "POST" });
        const data = await res.json();
        if (res.ok && data.profile) {
          currentMasterProfile = data.profile;
          populateDrawerForm(data.profile);
          showToast("Master CV reprocessado e limpo com sucesso!", "success");
          await loadMasterProfile();
          if (selectedJobId) selectJob(selectedJobId);
        } else {
          showToast(data.error || "Erro ao reprocessar Master CV", "error");
        }
      } catch {
        showToast("Erro ao conectar com a API", "error");
      } finally {
        btnReprocess.disabled = false;
        btnReprocess.innerHTML = origHtml;
      }
    });
  }

  // Save drawer form
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const experiences = collectDrawerExperiences();
      const education = collectDrawerEducation();

      const payload = {
        fullName: document.getElementById("drawer-fullName").value,
        headline: document.getElementById("drawer-headline").value,
        email: document.getElementById("drawer-email").value,
        phone: document.getElementById("drawer-phone").value,
        location: document.getElementById("drawer-location").value,
        linkedin: document.getElementById("drawer-linkedin").value,
        github: document.getElementById("drawer-github").value,
        summary: document.getElementById("drawer-summary").value,
        skills: document
          .getElementById("drawer-skills")
          .value.split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        experiences,
        education,
      };

      try {
        const res = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
}

function collectDrawerExperiences() {
  const expCards = document.querySelectorAll("#drawer-experiences-list > div");
  const list = [];
  expCards.forEach((card) => {
    list.push({
      role: card.querySelector(".d-exp-role")?.value || "",
      company: card.querySelector(".d-exp-company")?.value || "",
      startDate: card.querySelector(".d-exp-start")?.value || "",
      endDate: card.querySelector(".d-exp-end")?.value || "",
      description: card.querySelector(".d-exp-desc")?.value || "",
    });
  });
  return list;
}

function collectDrawerEducation() {
  const eduCards = document.querySelectorAll("#drawer-education-list > div");
  const list = [];
  eduCards.forEach((card) => {
    list.push({
      degree: card.querySelector(".d-edu-degree")?.value || "",
      institution: card.querySelector(".d-edu-inst")?.value || "",
      startDate: card.querySelector(".d-edu-start")?.value || "",
      endDate: card.querySelector(".d-edu-end")?.value || "",
    });
  });
  return list;
}

function populateDrawerForm(p) {
  if (!p) return;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  };

  setVal("drawer-fullName", p.fullName);
  setVal("drawer-headline", p.headline);
  setVal("drawer-email", p.email);
  setVal("drawer-phone", p.phone);
  setVal("drawer-location", p.location);
  setVal("drawer-linkedin", p.linkedin);
  setVal("drawer-github", p.github);
  setVal("drawer-summary", p.summary);
  setVal("drawer-skills", (p.skills || []).join(", "));

  renderDrawerExperiences(p.experiences || []);
  renderDrawerEducation(p.education || []);
}

function renderDrawerExperiences(exps) {
  const container = document.getElementById("drawer-experiences-list");
  if (!container) return;
  container.innerHTML = "";

  exps.forEach((exp, idx) => {
    const card = document.createElement("div");
    card.className = "p-3 rounded-lg border space-y-2";
    card.style.borderColor = "var(--border-color)";
    card.style.backgroundColor = "var(--bg-subtle)";
    card.innerHTML = `
      <div class="flex items-center justify-between text-xs font-mono text-zinc-500">
        <span>EXPERIÊNCIA #${idx + 1}</span>
        <button type="button" class="btn-del-exp text-zinc-400 hover:text-rose-400 transition-colors font-mono" data-idx="${idx}">Remover</button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Cargo" class="ui-input d-exp-role" value="${escapeHtml(exp.role || "")}" required>
        <input type="text" placeholder="Empresa" class="ui-input d-exp-company" value="${escapeHtml(exp.company || "")}" required>
        <input type="text" placeholder="Início" class="ui-input d-exp-start font-mono text-xs" value="${escapeHtml(exp.startDate || "")}">
        <input type="text" placeholder="Fim" class="ui-input d-exp-end font-mono text-xs" value="${escapeHtml(exp.endDate || "")}">
      </div>
      <textarea rows="2" placeholder="Bullets / Resultados" class="ui-input w-full d-exp-desc font-mono text-xs leading-relaxed">${escapeHtml(exp.description || "")}</textarea>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".btn-del-exp").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const exps = collectDrawerExperiences();
      exps.splice(idx, 1);
      if (currentMasterProfile) currentMasterProfile.experiences = exps;
      renderDrawerExperiences(exps);
    });
  });
}

function renderDrawerEducation(edus) {
  const container = document.getElementById("drawer-education-list");
  if (!container) return;
  container.innerHTML = "";

  edus.forEach((edu, idx) => {
    const card = document.createElement("div");
    card.className = "p-3 rounded-lg border space-y-2";
    card.style.borderColor = "var(--border-color)";
    card.style.backgroundColor = "var(--bg-subtle)";
    card.innerHTML = `
      <div class="flex items-center justify-between text-xs font-mono text-zinc-500">
        <span>FORMAÇÃO #${idx + 1}</span>
        <button type="button" class="btn-del-edu text-zinc-400 hover:text-rose-400 transition-colors font-mono" data-idx="${idx}">Remover</button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Curso / Grau" class="ui-input d-edu-degree" value="${escapeHtml(edu.degree || "")}" required>
        <input type="text" placeholder="Instituição" class="ui-input d-edu-inst" value="${escapeHtml(edu.institution || "")}" required>
        <input type="text" placeholder="Início" class="ui-input d-edu-start font-mono text-xs" value="${escapeHtml(edu.startDate || "")}">
        <input type="text" placeholder="Fim" class="ui-input d-edu-end font-mono text-xs" value="${escapeHtml(edu.endDate || "")}">
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".btn-del-edu").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const edus = collectDrawerEducation();
      edus.splice(idx, 1);
      if (currentMasterProfile) currentMasterProfile.education = edus;
      renderDrawerEducation(edus);
    });
  });
}

// ============================================================================
// 6. PIPELINE SIDEBAR (Column 1)
// ============================================================================
async function loadJobs() {
  try {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    currentJobs = data.jobs || [];

    const qs = document.getElementById("queue-summary");
    if (qs) {
      qs.textContent = `${currentJobs.length} vaga(s)`;
    }

    renderSidebarJobs();

    if (currentJobs.length > 0) {
      if (!selectedJobId || !currentJobs.some((j) => j.id === selectedJobId)) {
        selectJob(currentJobs[0].id);
      }
    } else {
      selectedJobId = null;
      activeJobData = null;
      showWorkbenchEmpty();
    }
  } catch (err) {
    console.error("Erro ao carregar vagas:", err);
  }
}

function renderSidebarJobs() {
  const container = document.getElementById("jobs-list");
  if (!container) return;

  const filtered = currentJobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(currentSearchQuery) ||
      job.company.toLowerCase().includes(currentSearchQuery);
    const matchesStatus =
      currentFilterStatus === "ALL" || job.status === currentFilterStatus;
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-zinc-500 font-mono text-xs">
        Nenhuma vaga correspondente.
      </div>
    `;
    return;
  }

  container.innerHTML = "";
  filtered.forEach((job) => {
    const isSelected = job.id === selectedJobId;
    const row = document.createElement("div");
    row.className = `px-5 py-3.5 border-b cursor-pointer select-none job-row-spring group relative ${isSelected ? "sidebar-job-active" : ""}`;
    row.style.borderColor = "var(--border-color)";
    row.dataset.id = job.id;

    const statusMap = {
      SAVED: "Salva",
      APPLIED: "Aplicada",
      INTERVIEW: "Entrevista",
      OFFER: "Oferta",
      REJECTED: "Rejeitada",
    };
    const statusLabel = statusMap[job.status] || job.status;

    const scoreText = job.tailored
      ? `<span class="tabular-nums font-mono text-xs" style="color: var(--text-muted);">${job.tailored.scoreBefore}</span> <span style="color: var(--text-muted);">→</span> <span class="tabular-nums font-mono text-xs font-semibold ${job.tailored.scoreAfter >= 80 ? "text-emerald-500" : ""}" style="${job.tailored.scoreAfter >= 80 ? "" : "color: var(--text-primary);"}">${job.tailored.scoreAfter}</span>`
      : `<span class="tabular-nums font-mono text-xs" style="color: var(--text-muted);">--</span>`;

    row.innerHTML = `
      <div class="flex items-baseline justify-between gap-2">
        <div class="text-sm font-semibold truncate pr-2" style="color: var(--text-primary);">${escapeHtml(job.title)}</div>
        <div class="shrink-0 tabular-nums">${scoreText}</div>
      </div>
      <div class="flex items-center justify-between text-xs mt-1.5" style="color: var(--text-secondary);">
        <span class="truncate pr-2">${escapeHtml(job.company)}</span>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[11px] font-medium px-2 py-0.5 rounded border" style="border-color: var(--border-color); background-color: var(--bg-subtle); color: var(--text-secondary);">${statusLabel}</span>
          <button type="button" class="btn-delete-job p-1 rounded text-zinc-400 hover:text-rose-500 hover:bg-rose-500/15 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" title="Excluir vaga" data-job-id="${job.id}">
            <svg class="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>
    `;

    row.addEventListener("click", () => selectJob(job.id));

    const btnDelete = row.querySelector(".btn-delete-job");
    if (btnDelete) {
      btnDelete.addEventListener("click", (e) => {
        e.stopPropagation();
        showDeleteJobModal(job.id, job.title);
      });
    }

    container.appendChild(row);
  });
}

function setupSidebarNavigation() {
  const searchInput = document.getElementById("search-jobs");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearchQuery = e.target.value.toLowerCase();
      renderSidebarJobs();
    });
  }

  document.querySelectorAll(".filter-tab-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-tab-btn").forEach((b) => {
        b.className =
          "filter-tab-btn px-2 py-1 rounded-md text-zinc-400 hover:text-zinc-200";
        b.style.backgroundColor = "transparent";
      });
      e.target.className =
        "filter-tab-btn active px-2.5 py-1 rounded-md font-medium";
      e.target.style.backgroundColor = "var(--bg-subtle)";
      e.target.style.color = "var(--text-primary)";

      currentFilterStatus = e.target.dataset.status;
      renderSidebarJobs();
    });
  });
}

// ============================================================================
// 7. WORKBENCH & INSPECTOR (Columns 2 & 3)
// ============================================================================
async function selectJob(jobId) {
  selectedJobId = jobId;
  renderSidebarJobs();

  const job = currentJobs.find((j) => j.id === jobId);
  if (!job) return;

  activeJobData = job;
  showWorkbenchActive();

  // Populate Header
  const jobHeaderCompany = document.getElementById("job-header-company");
  const jobHeaderTitle = document.getElementById("job-header-title");
  if (jobHeaderCompany) {
    jobHeaderCompany.textContent = job.company || "";
    jobHeaderCompany.title = job.company || "";
  }
  if (jobHeaderTitle) {
    jobHeaderTitle.textContent = job.title || "";
    jobHeaderTitle.title = job.title || "";
  }
  const jobStatusSelect = document.getElementById("job-header-status-select");
  if (jobStatusSelect) jobStatusSelect.value = job.status;

  // Status Change Listener
  document.getElementById("job-header-status-select").onchange = async (e) => {
    const newStatus = e.target.value;
    await fetch(`/api/jobs/${job.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
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

  // Load Knockout Questions for this job
  await loadKnockoutQuestions(job.id);

  // Load Cover Letter for this job
  await loadCoverLetter(job.id);

  if (window.lucide) window.lucide.createIcons();
}

function renderInspectorTelemetry(job) {
  const keywords = job.topKeywords || [];
  const tailored = job.tailored;

  // Section 1: Score ATS with Animated Count Up (Dual-Score)
  if (tailored) {
    const gain = Math.max(
      0,
      Math.round(tailored.scoreAfter - tailored.scoreBefore),
    );
    const sScore =
      tailored.auditAfter?.scannabilityScore !== undefined
        ? tailored.auditAfter.scannabilityScore
        : tailored.scoreAfter;
    const tScore =
      tailored.auditAfter?.technicalScore !== undefined
        ? tailored.auditAfter.technicalScore
        : tailored.scoreAfter;
    animateDualScores(sScore, tScore);

    const diffEl = document.getElementById("inspect-technical-diff");
    if (diffEl) {
      diffEl.textContent = `+${gain} pts`;
      diffEl.className =
        "text-xs font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded";
    }
    const beforeEl = document.getElementById("inspect-technical-before");
    if (beforeEl) beforeEl.textContent = `antes: ${tailored.scoreBefore}`;

    // Legacy elements
    if (document.getElementById("inspect-score-before"))
      document.getElementById("inspect-score-before").textContent =
        `antes: ${tailored.scoreBefore}`;
    if (document.getElementById("inspect-score-diff"))
      document.getElementById("inspect-score-diff").textContent =
        `+${gain} pts`;
  } else {
    animateDualScores(null, null);
    const diffEl = document.getElementById("inspect-technical-diff");
    if (diffEl) {
      diffEl.textContent = "--";
      diffEl.className = "text-xs font-mono text-zinc-500";
    }
    const beforeEl = document.getElementById("inspect-technical-before");
    if (beforeEl) beforeEl.textContent = "antes: --";

    const badgeEl = document.getElementById("inspect-scannability-badge");
    if (badgeEl) {
      badgeEl.textContent = "Aguardando";
      badgeEl.className =
        "text-xs font-mono text-zinc-500 font-semibold px-2 py-0.5 rounded";
    }
    const countEl = document.getElementById(
      "inspect-scannability-metrics-count",
    );
    if (countEl) countEl.textContent = "0 métricas de impacto";

    resetBreakdownLines();
  }

  // Section 2: Densidade TF-IDF Vertical Table
  const tableBody = document.getElementById("inspect-keywords-table");
  document.getElementById("inspect-kw-count").textContent =
    `${keywords.length} termos`;

  const density = job.tailored?.auditAfter?.keywordDensity || {};

  if (keywords.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-zinc-500 text-xs italic">Sem keywords extraídas</td></tr>`;
  } else {
    tableBody.innerHTML = keywords
      .map((kw) => {
        const termLower = kw.term.toLowerCase();
        const rawCount =
          density[kw.term] !== undefined
            ? density[kw.term]
            : density[termLower] !== undefined
              ? density[termLower]
              : null;
        const cvDisplay = rawCount !== null ? `${rawCount}x` : "--";
        const cvClass =
          rawCount !== null && rawCount >= 1
            ? "py-2 text-center text-emerald-400 text-xs font-semibold"
            : "py-2 text-center text-zinc-400 text-xs";
        const safeId =
          "kw-cv-" + kw.term.toLowerCase().replace(/[^a-z0-9]/g, "_");

        return `
        <tr class="hover:bg-zinc-800/20 transition-colors">
          <td class="py-2 font-sans text-xs truncate max-w-[130px]" style="color: var(--text-primary);">${escapeHtml(kw.term)}</td>
          <td class="py-2 text-center text-zinc-400 text-xs">${kw.count}x</td>
          <td class="${cvClass}" id="${safeId}" data-term="${escapeHtml(kw.term)}">${cvDisplay}</td>
          <td class="py-2 text-right text-emerald-500 text-xs font-semibold">
            <svg class="w-3.5 h-3.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </td>
        </tr>
      `;
      })
      .join("");
  }

  // Section 3: Propriedades do Binário
  document.getElementById("prop-title").textContent = job.title;
  document.getElementById("prop-creator").textContent =
    currentMasterProfile?.fullName || "Rodrigo Silva";
  document.getElementById("prop-keywords").textContent =
    keywords
      .slice(0, 4)
      .map((k) => k.term)
      .join(", ") || "--";
}

function resetBreakdownLines() {
  if (document.getElementById("scannability-structure"))
    document.getElementById("scannability-structure").textContent = "--/30";
  if (document.getElementById("scannability-metrics"))
    document.getElementById("scannability-metrics").textContent = "--/45";
  if (document.getElementById("scannability-readability"))
    document.getElementById("scannability-readability").textContent = "--/25";
  if (document.getElementById("line-scannability-structure"))
    document.getElementById("line-scannability-structure").style.width = "0%";
  if (document.getElementById("line-scannability-metrics"))
    document.getElementById("line-scannability-metrics").style.width = "0%";
  if (document.getElementById("line-scannability-readability"))
    document.getElementById("line-scannability-readability").style.width = "0%";

  if (document.getElementById("breakdown-format"))
    document.getElementById("breakdown-format").textContent = "--/30";
  if (document.getElementById("breakdown-keywords"))
    document.getElementById("breakdown-keywords").textContent = "--/35";
  if (document.getElementById("breakdown-density"))
    document.getElementById("breakdown-density").textContent = "--/20";
  if (document.getElementById("breakdown-entity"))
    document.getElementById("breakdown-entity").textContent = "--/15";

  if (document.getElementById("line-format"))
    document.getElementById("line-format").style.width = "0%";
  if (document.getElementById("line-keywords"))
    document.getElementById("line-keywords").style.width = "0%";
  if (document.getElementById("line-density"))
    document.getElementById("line-density").style.width = "0%";
  if (document.getElementById("line-entity"))
    document.getElementById("line-entity").style.width = "0%";
}

function updateInspectorBreakdown(audit) {
  if (!audit) return;

  // 1. Dual-Score Animated Values
  const scannabilityScore =
    audit.scannabilityScore !== undefined
      ? audit.scannabilityScore
      : audit.overallScore || 0;
  const technicalScore =
    audit.technicalScore !== undefined
      ? audit.technicalScore
      : audit.overallScore || 0;
  animateDualScores(scannabilityScore, technicalScore);

  // 2. Scannability & Impact Dimensions (Top Card)
  if (audit.scannabilityBreakdown) {
    const sb = audit.scannabilityBreakdown;
    const structEl = document.getElementById("scannability-structure");
    const structLine = document.getElementById("line-scannability-structure");
    if (structEl) structEl.textContent = `${sb.structureClarity}/30`;
    if (structLine)
      structLine.style.width = `${(sb.structureClarity / 30) * 100}%`;

    const metricsEl = document.getElementById("scannability-metrics");
    const metricsLine = document.getElementById("line-scannability-metrics");
    if (metricsEl) metricsEl.textContent = `${sb.quantifiableMetrics}/45`;
    if (metricsLine)
      metricsLine.style.width = `${(sb.quantifiableMetrics / 45) * 100}%`;

    const readEl = document.getElementById("scannability-readability");
    const readLine = document.getElementById("line-scannability-readability");
    if (readEl) readEl.textContent = `${sb.humanReadability}/25`;
    if (readLine) readLine.style.width = `${(sb.humanReadability / 25) * 100}%`;

    const countEl = document.getElementById(
      "inspect-scannability-metrics-count",
    );
    if (countEl)
      countEl.textContent = `${sb.metricsFoundCount} métricas encontradas`;

    const badgeEl = document.getElementById("inspect-scannability-badge");
    if (badgeEl) {
      if (scannabilityScore >= 85) {
        badgeEl.textContent = "Excelente (6s)";
        badgeEl.className =
          "text-xs font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded";
      } else if (scannabilityScore >= 70) {
        badgeEl.textContent = "Alta Clareza";
        badgeEl.className =
          "text-xs font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded";
      } else if (scannabilityScore >= 50) {
        badgeEl.textContent = "Moderada";
        badgeEl.className =
          "text-xs font-mono text-amber-400 font-semibold px-2 py-0.5 rounded";
      } else {
        badgeEl.textContent = "Necessita Métricas";
        badgeEl.className =
          "text-xs font-mono text-rose-400 font-semibold px-2 py-0.5 rounded";
      }
    }
  }

  // 3. Technical TF-IDF Dimensions (Bottom Card)
  const b = audit.breakdown || {};
  if (document.getElementById("breakdown-format")) {
    document.getElementById("breakdown-format").textContent =
      `${b.formatting || 0}/30`;
    document.getElementById("line-format").style.width =
      `${((b.formatting || 0) / 30) * 100}%`;
  }
  if (document.getElementById("breakdown-keywords")) {
    document.getElementById("breakdown-keywords").textContent =
      `${b.keywords || 0}/35`;
    document.getElementById("line-keywords").style.width =
      `${((b.keywords || 0) / 35) * 100}%`;
  }
  if (document.getElementById("breakdown-density")) {
    document.getElementById("breakdown-density").textContent =
      `${b.density || 0}/20`;
    document.getElementById("line-density").style.width =
      `${((b.density || 0) / 20) * 100}%`;
  }
  if (document.getElementById("breakdown-entity")) {
    document.getElementById("breakdown-entity").textContent =
      `${b.entityCompliance || 0}/15`;
    document.getElementById("line-entity").style.width =
      `${((b.entityCompliance || 0) / 15) * 100}%`;
  }

  // Update CV counts in TF-IDF table
  const density = audit.keywordDensity || {};
  for (const [term, count] of Object.entries(density)) {
    const safeId = "kw-cv-" + term.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const cell =
      document.getElementById(safeId) ||
      document.getElementById(`kw-cv-${term}`);
    if (cell) {
      cell.textContent = `${count}x`;
      cell.className =
        count >= 1
          ? "py-2 text-center text-emerald-400 text-xs font-semibold"
          : "py-2 text-center text-zinc-400 text-xs";
    }
  }

  // Also match any cells by data-term
  document.querySelectorAll("[id^='kw-cv-']").forEach((cell) => {
    const term = cell.getAttribute("data-term");
    if (term) {
      const lower = term.toLowerCase();
      if (density[term] !== undefined || density[lower] !== undefined) {
        const c = density[term] !== undefined ? density[term] : density[lower];
        cell.textContent = `${c}x`;
        cell.className =
          c >= 1
            ? "py-2 text-center text-emerald-400 text-xs font-semibold"
            : "py-2 text-center text-zinc-400 text-xs";
      }
    }
  });
}

// Client-side date range formatter
function formatClientDateRange(start, end) {
  if (!start && !end) return "";
  if (start && (!end || end === "Atual" || end === "")) {
    const two = start.match(
      /^(.+?\b(?:19\d\d|20\d\d))\s+(.+?\b(?:19\d\d|20\d\d|\batual\b|\bpresente?\b))$/i,
    );
    if (two) {
      start = two[1];
      end = two[2];
    }
  }
  const formatSingle = (s) => {
    if (!s) return "";
    const lower = s.trim().toLowerCase();
    if (["atual", "present", "presente", "current"].includes(lower))
      return "Atual";
    const ym = lower.match(/^(\d{4})[-/.](\d{1,2})$/);
    const months = {
      "01": "Jan",
      "02": "Fev",
      "03": "Mar",
      "04": "Abr",
      "05": "Mai",
      "06": "Jun",
      "07": "Jul",
      "08": "Ago",
      "09": "Set",
      10: "Out",
      11: "Nov",
      12: "Dez",
    };
    if (ym) return `${months[ym[2].padStart(2, "0")] || ym[2]} ${ym[1]}`;
    const mMatch = lower
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .match(/\b([a-z]+)\.?\s+(?:de\s+)?(\d{4})\b/);
    const mWords = {
      janeiro: "Jan",
      jan: "Jan",
      fevereiro: "Fev",
      fev: "Fev",
      marco: "Mar",
      mar: "Mar",
      abril: "Abr",
      abr: "Abr",
      maio: "Mai",
      mai: "Mai",
      junho: "Jun",
      jun: "Jun",
      julho: "Jul",
      jul: "Jul",
      agosto: "Ago",
      ago: "Ago",
      setembro: "Set",
      set: "Set",
      outubro: "Out",
      out: "Out",
      novembro: "Nov",
      nov: "Nov",
      dezembro: "Dez",
      dez: "Dez",
    };
    if (mMatch && mWords[mMatch[1]]) return `${mWords[mMatch[1]]} ${mMatch[2]}`;
    const yr = lower.match(/\b(19\d\d|20\d\d)\b/);
    if (yr) return yr[1];
    return s.trim();
  };
  const sFormatted = formatSingle(start);
  const eFormatted = formatSingle(end);
  if (!sFormatted && !eFormatted) return "";
  if (sFormatted && !eFormatted) return sFormatted;
  if (!sFormatted && eFormatted) return eFormatted;
  if (sFormatted === eFormatted) return sFormatted;
  return `${sFormatted} – ${eFormatted}`;
}

// Master CV in Diff Pane
function renderMasterCvDiff() {
  const container = document.getElementById("diff-master-content");
  if (!currentMasterProfile?.fullName) {
    container.innerHTML = `
      <div class="p-8 text-center text-zinc-500 font-mono text-xs">
        Nenhum Master CV cadastrado. Clique no ícone de documento no topo da sidebar para importar seu PDF.
      </div>
    `;
    return;
  }

  const p = currentMasterProfile;
  container.innerHTML = `
    <div class="border-b pb-3" style="border-color: var(--border-color);">
      <div class="text-sm font-semibold" style="color: var(--text-primary);">${escapeHtml(p.fullName)}</div>
      <div class="text-xs text-zinc-400 mt-0.5">${escapeHtml(p.headline)}</div>
      <div class="text-xs text-zinc-500 mt-1">${escapeHtml(p.email)} | ${escapeHtml(p.phone || "")} | ${escapeHtml(p.location || "")}</div>
    </div>

    <div>
      <div class="text-xs font-mono uppercase text-zinc-500 font-semibold mb-1">Resumo Original</div>
      <p class="text-sm leading-relaxed" style="color: var(--text-secondary);">${escapeHtml(p.summary)}</p>
    </div>

    <div>
      <div class="text-xs font-mono uppercase text-zinc-500 font-semibold mb-2">Experiências Originais</div>
      <div class="space-y-3.5">
        ${(p.experiences || [])
          .map(
            (exp) => `
          <div>
            <div class="text-sm font-medium" style="color: var(--text-primary);">${escapeHtml(exp.role)} — <span class="text-zinc-400">${escapeHtml(exp.company)}</span></div>
            <div class="text-xs font-mono tabular-nums" style="color: var(--text-secondary);">${escapeHtml(formatClientDateRange(exp.startDate, exp.endDate))}</div>
            <div class="text-xs mt-1 whitespace-pre-line leading-relaxed" style="color: var(--text-secondary);">${escapeHtml(exp.description)}</div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>

    <div>
      <div class="text-xs font-mono uppercase text-zinc-500 font-semibold mb-1">Habilidades Base</div>
      <div class="font-mono text-xs leading-relaxed" style="color: var(--text-secondary);">${(p.skills || []).join(" • ")}</div>
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
  document.getElementById("edit-tailored-title").value =
    tailoredResume.headline || "";
  document.getElementById("edit-tailored-summary").value =
    tailoredResume.summary || "";
  document.getElementById("edit-tailored-skills").value = (
    tailoredResume.skills || []
  ).join(", ");

  updateSummaryDottedPreview(
    tailoredResume.summary || "",
    activeJobData?.topKeywords || [],
  );

  document.getElementById("edit-tailored-summary").oninput = (e) => {
    updateSummaryDottedPreview(
      e.target.value,
      activeJobData?.topKeywords || [],
    );
  };

  const expContainer = document.getElementById("edit-tailored-experiences");
  expContainer.innerHTML = "";

  (tailoredResume.experiences || []).forEach((exp) => {
    const card = document.createElement("div");
    card.className = "p-3 rounded-lg border space-y-1.5";
    card.style.borderColor = "var(--border-color)";
    card.style.backgroundColor = "var(--bg-subtle)";
    card.innerHTML = `
      <div class="flex items-center justify-between text-xs font-mono">
        <span class="font-semibold" style="color: var(--text-primary);">${escapeHtml(exp.role)} — ${escapeHtml(exp.company)}</span>
        <span class="text-xs tabular-nums" style="color: var(--text-secondary);">${escapeHtml(formatClientDateRange(exp.startDate, exp.endDate))}</span>
      </div>
      <textarea rows="4" class="ui-input w-full font-sans text-xs leading-relaxed tailored-exp-input">${escapeHtml(exp.description)}</textarea>
    `;
    expContainer.appendChild(card);
  });
}

function updateSummaryDottedPreview(text, keywords) {
  const preview = document.getElementById("summary-dotted-preview");
  if (!text) {
    preview.innerHTML = `<span class="text-zinc-500 italic">Sem resumo otimizado</span>`;
    return;
  }

  let html = escapeHtml(text);
  const terms = (keywords || []).slice(0, 10).map((k) => k.term);

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
    <div class="p-8 text-center text-zinc-500 font-mono text-xs">
      Clique em "Otimizar Currículo" para gerar a versão com as 7 camadas.
    </div>
  `;
  document.getElementById("summary-dotted-preview").innerHTML =
    `<span class="text-zinc-500 italic">Aguardando otimização...</span>`;
  document.getElementById("a4-preview-content").innerHTML = `
    <div class="p-16 text-center text-zinc-500 font-mono text-xs">
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
    <div class="border-b pb-4 mb-5" style="border-color: var(--border-color);">
      <h1 class="text-lg font-bold tracking-tight uppercase" style="color: var(--text-primary);">${escapeHtml(resume.fullName)}</h1>
      <div class="text-xs mt-1" style="color: var(--text-secondary);">${escapeHtml(resume.headline)}</div>
      <div class="text-xs text-zinc-500 mt-1">${escapeHtml(resume.email)}  |  ${escapeHtml(resume.phone || "")}  |  ${escapeHtml(resume.location || "")}</div>
    </div>

    <div class="mb-5">
      <div class="text-xs font-bold uppercase pb-1 mb-1.5 font-mono border-b" style="color: var(--text-primary); border-color: var(--border-color);">Resumo Profissional</div>
      <p class="text-xs leading-relaxed" style="color: var(--text-secondary);">${escapeHtml(resume.summary)}</p>
    </div>

    <div class="mb-5">
      <div class="text-xs font-bold uppercase pb-1 mb-2 font-mono border-b" style="color: var(--text-primary); border-color: var(--border-color);">Experiência Profissional</div>
      <div class="space-y-3.5">
        ${(resume.experiences || [])
          .map(
            (exp) => `
          <div>
            <div class="font-bold text-xs" style="color: var(--text-primary);">${escapeHtml(exp.role)} — <span class="font-normal" style="color: var(--text-secondary);">${escapeHtml(exp.company)}</span> <span class="text-[11px] float-right font-mono tabular-nums" style="color: var(--text-secondary);">(${escapeHtml(formatClientDateRange(exp.startDate, exp.endDate))})</span></div>
            <div class="text-xs mt-1 whitespace-pre-line leading-relaxed" style="color: var(--text-secondary);">${escapeHtml(exp.description)}</div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>

    <div class="mb-5">
      <div class="text-xs font-bold uppercase pb-1 mb-1.5 font-mono border-b" style="color: var(--text-primary); border-color: var(--border-color);">Formação Acadêmica</div>
      <div class="space-y-1.5">
        ${(resume.education || [])
          .map(
            (edu) => `
          <div class="text-xs" style="color: var(--text-secondary);"><span class="font-medium" style="color: var(--text-primary);">${escapeHtml(edu.degree)}</span> — <span class="text-zinc-500">${escapeHtml(edu.institution)}</span> <span class="text-[11px] text-zinc-500 float-right font-mono">(${escapeHtml(formatClientDateRange(edu.startDate, edu.endDate))})</span></div>
        `,
          )
          .join("")}
      </div>
    </div>

    <div>
      <div class="text-xs font-bold uppercase pb-1 mb-1.5 font-mono border-b" style="color: var(--text-primary); border-color: var(--border-color);">Habilidades Técnicas</div>
      <div class="text-xs font-mono leading-relaxed" style="color: var(--text-secondary);">${(resume.skills || []).join("   •   ")}</div>
    </div>
  `;
}

// ============================================================================
// 8. WORKBENCH TABS & ACTIONS
// ============================================================================
function setupWorkbenchTabs() {
  document.querySelectorAll(".nav-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      document.querySelectorAll(".nav-tab-btn").forEach((b) => {
        b.className =
          "nav-tab-btn h-full flex items-center text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors";
      });
      btn.className =
        "nav-tab-btn nav-tab-active h-full flex items-center text-sm font-medium transition-colors";

      document.querySelectorAll(".tab-pane-content").forEach((p) => {
        p.classList.add("hidden");
        p.classList.remove("fade-slide-up");
      });

      const targetPane = document.getElementById(target);
      if (targetPane) {
        targetPane.classList.remove("hidden");
        void targetPane.offsetWidth; // re-trigger animation
        targetPane.classList.add("fade-slide-up");
      }

      // If user switches to Knockout Questions tab, reload questions
      if (target === "tab-knockout" && selectedJobId) {
        loadKnockoutQuestions(selectedJobId);
      }

      // If user switches to Cover Letter tab, load cover letter
      if (target === "tab-cover-letter" && selectedJobId) {
        loadCoverLetter(selectedJobId);
      }

      // Actions visibility
      const actions = document.getElementById("tab-diff-actions");
      if (actions) {
        if (target === "tab-diff") {
          actions.classList.remove("hidden");
        } else {
          actions.classList.add("hidden");
        }
      }
    });
  });
}

async function checkSystemConfig() {
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const data = await res.json();
      hasGeminiKey = !!data.hasGeminiKey;
      hasClaudeKey = !!data.hasClaudeKey;
      hasOpenRouterKey = !!data.hasOpenRouterKey;
      claudeInfo = data.claude || null;
      openRouterInfo = data.openrouter || null;
      hasOllama = !!(data.ollama?.available && data.ollama?.configured);
      ollamaInfo = data.ollama || null;
    } else {
      hasGeminiKey = false;
      hasClaudeKey = false;
      hasOpenRouterKey = false;
      hasOllama = false;
      ollamaInfo = null;
      claudeInfo = null;
      openRouterInfo = null;
    }
  } catch {
    hasGeminiKey = false;
    hasClaudeKey = false;
    hasOpenRouterKey = false;
    hasOllama = false;
    ollamaInfo = null;
    claudeInfo = null;
    openRouterInfo = null;
  }

  // Restore saved choice only if available and configured
  const savedEngine = localStorage.getItem("ats_tailor_engine");

  if (savedEngine === "gemini" && hasGeminiKey) {
    currentTailorEngine = "gemini";
  } else if (savedEngine === "claude" && hasClaudeKey) {
    currentTailorEngine = "claude";
  } else if (savedEngine === "openrouter" && hasOpenRouterKey) {
    currentTailorEngine = "openrouter";
  } else if (savedEngine === "ollama" && hasOllama) {
    currentTailorEngine = "ollama";
  } else if (hasClaudeKey && !savedEngine) {
    currentTailorEngine = "claude";
  } else if (hasOpenRouterKey && !savedEngine) {
    currentTailorEngine = "openrouter";
  } else if (hasGeminiKey && !savedEngine) {
    currentTailorEngine = "gemini";
  } else {
    currentTailorEngine = "local";
  }

  applyEngineAvailability();
}

function applyEngineAvailability() {
  // 1. Gemini
  const btnEngineGemini = document.getElementById("btn-engine-gemini");
  const badgeGemini = document.getElementById("badge-engine-gemini");
  const descGemini = document.getElementById("engine-gemini-desc");

  const btnClGemini = document.getElementById("btn-cl-engine-gemini");
  const badgeClGemini = document.getElementById("badge-cl-engine-gemini");
  const descClGemini = document.getElementById("cl-engine-gemini-desc");

  if (!hasGeminiKey) {
    [btnEngineGemini, btnClGemini].forEach((btn) => {
      if (btn) {
        btn.disabled = true;
        btn.setAttribute("disabled", "true");
        btn.classList.add("opacity-40", "cursor-not-allowed");
        btn.classList.remove("cursor-pointer", "hover:bg-zinc-500/10");
        btn.title = "Gemini indisponível";
      }
    });
    [badgeGemini, badgeClGemini].forEach((b) => {
      if (b) {
        b.textContent = "Indisponível";
        b.classList.remove("hidden");
      }
    });
    if (descGemini) {
      descGemini.textContent =
        "Reescrita contextual, linguagem fluida e natural";
      descGemini.classList.remove("text-rose-400");
      descGemini.classList.add("text-zinc-400");
    }
    if (descClGemini) {
      descClGemini.textContent = "Reescrita contextual com IA em nuvem";
      descClGemini.classList.remove("text-rose-400");
      descClGemini.classList.add("text-zinc-400");
    }
    if (currentTailorEngine === "gemini") {
      updateTailorEngineUI("local");
    }
  } else {
    [btnEngineGemini, btnClGemini].forEach((btn) => {
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute("disabled");
        btn.classList.remove("opacity-40", "cursor-not-allowed");
        btn.classList.add("cursor-pointer", "hover:bg-zinc-500/10");
        btn.title = "Gemini 1.5 Flash disponível via Google AI Studio";
      }
    });
    [badgeGemini, badgeClGemini].forEach((b) => {
      b?.classList.add("hidden");
    });
    if (descGemini) {
      descGemini.textContent =
        "Reescrita contextual, linguagem fluida e natural";
      descGemini.classList.remove("text-rose-400");
      descGemini.classList.add("text-zinc-400");
    }
    if (descClGemini) {
      descClGemini.textContent = "Reescrita contextual com IA em nuvem";
      descClGemini.classList.remove("text-rose-400");
      descClGemini.classList.add("text-zinc-400");
    }
  }

  // 2. Claude (Anthropic)
  const btnEngineClaude = document.getElementById("btn-engine-claude");
  const badgeClaude = document.getElementById("badge-engine-claude");
  const descClaude = document.getElementById("engine-claude-desc");

  const btnClClaude = document.getElementById("btn-cl-engine-claude");
  const badgeClClaude = document.getElementById("badge-cl-engine-claude");
  const descClClaude = document.getElementById("cl-engine-claude-desc");

  if (!hasClaudeKey) {
    [btnEngineClaude, btnClClaude].forEach((btn) => {
      if (btn) {
        btn.disabled = true;
        btn.setAttribute("disabled", "true");
        btn.classList.add("opacity-40", "cursor-not-allowed");
        btn.classList.remove("cursor-pointer", "hover:bg-zinc-500/10");
        btn.title = "Claude indisponível";
      }
    });
    [badgeClaude, badgeClClaude].forEach((b) => {
      if (b) {
        b.textContent = "Indisponível";
        b.classList.remove("hidden");
      }
    });
    if (descClaude) {
      descClaude.textContent = "Raciocínio avançado e redação executiva";
      descClaude.classList.remove("text-rose-400");
      descClaude.classList.add("text-zinc-400");
    }
    if (descClClaude) {
      descClClaude.textContent = "Raciocínio avançado e redação executiva";
      descClClaude.classList.remove("text-rose-400");
      descClClaude.classList.add("text-zinc-400");
    }
    if (currentTailorEngine === "claude") {
      updateTailorEngineUI("local");
    }
  } else {
    [btnEngineClaude, btnClClaude].forEach((btn) => {
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute("disabled");
        btn.classList.remove("opacity-40", "cursor-not-allowed");
        btn.classList.add("cursor-pointer", "hover:bg-zinc-500/10");
        btn.title = `Claude ativo (${claudeInfo?.model || "Sonnet 3.5"})`;
      }
    });
    [badgeClaude, badgeClClaude].forEach((b) => {
      b?.classList.add("hidden");
    });
    if (descClaude) {
      descClaude.textContent = "Raciocínio avançado e redação executiva";
      descClaude.classList.remove("text-rose-400");
      descClaude.classList.add("text-zinc-400");
    }
    if (descClClaude) {
      descClClaude.textContent = "Raciocínio avançado e redação executiva";
      descClClaude.classList.remove("text-rose-400");
      descClClaude.classList.add("text-zinc-400");
    }
  }

  // 3. OpenRouter (Multi-LLM)
  const btnEngineOpenRouter = document.getElementById("btn-engine-openrouter");
  const badgeOpenRouter = document.getElementById("badge-engine-openrouter");
  const descOpenRouter = document.getElementById("engine-openrouter-desc");

  const btnClOpenRouter = document.getElementById("btn-cl-engine-openrouter");
  const badgeClOpenRouter = document.getElementById(
    "badge-cl-engine-openrouter",
  );
  const descClOpenRouter = document.getElementById("cl-engine-openrouter-desc");

  if (!hasOpenRouterKey) {
    [btnEngineOpenRouter, btnClOpenRouter].forEach((btn) => {
      if (btn) {
        btn.disabled = true;
        btn.setAttribute("disabled", "true");
        btn.classList.add("opacity-40", "cursor-not-allowed");
        btn.classList.remove("cursor-pointer", "hover:bg-zinc-500/10");
        btn.title = "OpenRouter indisponível";
      }
    });
    [badgeOpenRouter, badgeClOpenRouter].forEach((b) => {
      if (b) {
        b.textContent = "Indisponível";
        b.classList.remove("hidden");
      }
    });
    if (descOpenRouter) {
      descOpenRouter.textContent = "Acesso unificado a modelos de ponta";
      descOpenRouter.classList.remove("text-rose-400");
      descOpenRouter.classList.add("text-zinc-400");
    }
    if (descClOpenRouter) {
      descClOpenRouter.textContent = "Acesso unificado a modelos de ponta";
      descClOpenRouter.classList.remove("text-rose-400");
      descClOpenRouter.classList.add("text-zinc-400");
    }
    if (currentTailorEngine === "openrouter") {
      updateTailorEngineUI("local");
    }
  } else {
    [btnEngineOpenRouter, btnClOpenRouter].forEach((btn) => {
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute("disabled");
        btn.classList.remove("opacity-40", "cursor-not-allowed");
        btn.classList.add("cursor-pointer", "hover:bg-zinc-500/10");
        btn.title = `OpenRouter ativo (${openRouterInfo?.model || "Multi-LLM"})`;
      }
    });
    [badgeOpenRouter, badgeClOpenRouter].forEach((b) => {
      b?.classList.add("hidden");
    });
    if (descOpenRouter) {
      descOpenRouter.textContent = "Acesso unificado a modelos de ponta";
      descOpenRouter.classList.remove("text-rose-400");
      descOpenRouter.classList.add("text-zinc-400");
    }
    if (descClOpenRouter) {
      descClOpenRouter.textContent = "Acesso unificado a modelos de ponta";
      descClOpenRouter.classList.remove("text-rose-400");
      descClOpenRouter.classList.add("text-zinc-400");
    }
  }

  // 2. Ollama
  const btnEngineOllama = document.getElementById("btn-engine-ollama");
  const badgeOllama = document.getElementById("badge-engine-ollama");
  const descOllama = document.getElementById("engine-ollama-desc");

  const btnClOllama = document.getElementById("btn-cl-engine-ollama");
  const badgeClOllama = document.getElementById("badge-cl-engine-ollama");
  const descClOllama = document.getElementById("cl-engine-ollama-desc");

  if (!hasOllama) {
    const isConfigured = !!ollamaInfo?.configured;
    const badgeText = isConfigured ? "Offline" : "Indisponível";

    [btnEngineOllama, btnClOllama].forEach((btn) => {
      if (btn) {
        btn.disabled = true;
        btn.setAttribute("disabled", "true");
        btn.classList.add("opacity-40", "cursor-not-allowed");
        btn.classList.remove("cursor-pointer", "hover:bg-zinc-500/10");
        btn.title = isConfigured ? "Ollama offline" : "Ollama indisponível";
      }
    });

    [badgeOllama, badgeClOllama].forEach((b) => {
      if (b) {
        b.textContent = badgeText;
        b.className =
          "text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50 font-medium";
      }
    });

    if (descOllama) {
      descOllama.textContent = "Llama 3.2 / Mistral 100% local e privado";
    }
    if (descClOllama) {
      descClOllama.textContent = "LLM local privada (100% offline)";
    }

    if (currentTailorEngine === "ollama") {
      updateTailorEngineUI("local");
    }
  } else {
    [btnEngineOllama, btnClOllama].forEach((btn) => {
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute("disabled");
        btn.classList.remove("opacity-40", "cursor-not-allowed");
        btn.classList.add("cursor-pointer", "hover:bg-zinc-500/10");
        btn.title = `Ollama ativo (${ollamaInfo?.model}) em ${ollamaInfo?.baseUrl}`;
      }
    });

    [badgeOllama, badgeClOllama].forEach((b) => {
      if (b) {
        b.textContent = ollamaInfo?.model || "Online";
        b.className =
          "text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium font-mono";
      }
    });

    if (descOllama) {
      descOllama.textContent = `Modelo local ${ollamaInfo?.model} (100% offline)`;
    }
    if (descClOllama) {
      descClOllama.textContent = `Modelo local ${ollamaInfo?.model} (100% offline)`;
    }
  }
}

function updateTailorEngineUI(engine) {
  if (engine === "gemini" && !hasGeminiKey) {
    engine = "local";
  }
  if (engine === "claude" && !hasClaudeKey) {
    engine = "local";
  }
  if (engine === "openrouter" && !hasOpenRouterKey) {
    engine = "local";
  }
  if (engine === "ollama" && !hasOllama) {
    engine = "local";
  }

  currentTailorEngine = engine;
  localStorage.setItem("ats_tailor_engine", engine);
  localStorage.setItem(
    "ats_use_gemini_tailoring",
    engine === "gemini" ? "true" : "false",
  );

  // 1. Header elements
  const label = document.getElementById("tailor-btn-label");
  const icon = document.getElementById("tailor-btn-icon");
  const checkGemini = document.getElementById("check-engine-gemini");
  const checkClaude = document.getElementById("check-engine-claude");
  const checkOpenRouter = document.getElementById("check-engine-openrouter");
  const checkOllama = document.getElementById("check-engine-ollama");
  const checkLocal = document.getElementById("check-engine-local");

  if (checkGemini) checkGemini.classList.toggle("hidden", engine !== "gemini");
  if (checkClaude) checkClaude.classList.toggle("hidden", engine !== "claude");
  if (checkOpenRouter)
    checkOpenRouter.classList.toggle("hidden", engine !== "openrouter");
  if (checkOllama) checkOllama.classList.toggle("hidden", engine !== "ollama");
  if (checkLocal) checkLocal.classList.toggle("hidden", engine !== "local");

  if (engine === "gemini") {
    if (label) label.textContent = "Otimizar (Gemini)";
    if (icon) {
      icon.setAttribute("data-lucide", "sparkles");
      icon.className = "w-3.5 h-3.5 fill-current text-amber-300";
    }
  } else if (engine === "claude") {
    if (label) label.textContent = "Otimizar (Claude)";
    if (icon) {
      icon.setAttribute("data-lucide", "brain");
      icon.className = "w-3.5 h-3.5 text-purple-400";
    }
  } else if (engine === "openrouter") {
    if (label) label.textContent = "Otimizar (OpenRouter)";
    if (icon) {
      icon.setAttribute("data-lucide", "globe");
      icon.className = "w-3.5 h-3.5 text-sky-400";
    }
  } else if (engine === "ollama") {
    const modelShort = ollamaInfo?.model
      ? ollamaInfo.model.split(":")[0]
      : "Ollama";
    if (label) label.textContent = `Otimizar (${modelShort})`;
    if (icon) {
      icon.setAttribute("data-lucide", "bot");
      icon.className = "w-3.5 h-3.5 text-emerald-400";
    }
  } else {
    if (label) label.textContent = "Otimizar (Local)";
    if (icon) {
      icon.setAttribute("data-lucide", "cpu");
      icon.className = "w-3.5 h-3.5 text-blue-300";
    }
  }

  // 2. Cover Letter Studio elements
  const clLabel = document.getElementById("cl-generate-label");
  const clIcon = document.getElementById("cl-generate-icon");
  const checkClGemini = document.getElementById("check-cl-engine-gemini");
  const checkClClaude = document.getElementById("check-cl-engine-claude");
  const checkClOpenRouter = document.getElementById(
    "check-cl-engine-openrouter",
  );
  const checkClOllama = document.getElementById("check-cl-engine-ollama");
  const checkClLocal = document.getElementById("check-cl-engine-local");

  if (checkClGemini)
    checkClGemini.classList.toggle("hidden", engine !== "gemini");
  if (checkClClaude)
    checkClClaude.classList.toggle("hidden", engine !== "claude");
  if (checkClOpenRouter)
    checkClOpenRouter.classList.toggle("hidden", engine !== "openrouter");
  if (checkClOllama)
    checkClOllama.classList.toggle("hidden", engine !== "ollama");
  if (checkClLocal) checkClLocal.classList.toggle("hidden", engine !== "local");

  if (clLabel) {
    if (engine === "gemini") {
      clLabel.textContent = "Redigir (Gemini)";
      if (clIcon) {
        clIcon.setAttribute("data-lucide", "sparkles");
        clIcon.className = "w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0";
      }
    } else if (engine === "claude") {
      clLabel.textContent = "Redigir (Claude)";
      if (clIcon) {
        clIcon.setAttribute("data-lucide", "brain");
        clIcon.className = "w-3.5 h-3.5 text-purple-400 shrink-0";
      }
    } else if (engine === "openrouter") {
      clLabel.textContent = "Redigir (OpenRouter)";
      if (clIcon) {
        clIcon.setAttribute("data-lucide", "globe");
        clIcon.className = "w-3.5 h-3.5 text-sky-400 shrink-0";
      }
    } else if (engine === "ollama") {
      const modelShort = ollamaInfo?.model
        ? ollamaInfo.model.split(":")[0]
        : "Ollama";
      clLabel.textContent = `Redigir (${modelShort})`;
      if (clIcon) {
        clIcon.setAttribute("data-lucide", "bot");
        clIcon.className = "w-3.5 h-3.5 text-emerald-400 shrink-0";
      }
    } else {
      clLabel.textContent = "Redigir Carta";
      if (clIcon) {
        clIcon.setAttribute("data-lucide", "sparkles");
        clIcon.className = "w-3.5 h-3.5 fill-current shrink-0";
      }
    }
  }

  if (window.lucide) window.lucide.createIcons();
}

function setupWorkbenchActions() {
  // Sync engine UI with state
  updateTailorEngineUI(currentTailorEngine);

  // Toggle Mode Dropdown Menu
  const btnModeMenu = document.getElementById("btn-tailor-mode-menu");
  const modeDropdown = document.getElementById("tailor-mode-dropdown-menu");
  const modeChevron = document.getElementById("tailor-mode-chevron-icon");

  if (btnModeMenu && modeDropdown) {
    btnModeMenu.addEventListener("click", async (e) => {
      e.stopPropagation();
      await checkSystemConfig();
      const isHidden = modeDropdown.classList.contains("hidden");
      // Close other dropdowns
      document
        .getElementById("download-dropdown-menu")
        ?.classList.add("hidden");
      document
        .getElementById("download-chevron-icon")
        ?.classList.remove("rotate-180");

      if (isHidden) {
        modeDropdown.classList.remove("hidden");
        modeChevron?.classList.add("rotate-180");
      } else {
        modeDropdown.classList.add("hidden");
        modeChevron?.classList.remove("rotate-180");
      }
    });

    // Options inside mode dropdown
    document.querySelectorAll(".tailor-engine-option-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const selectedEngine = btn.dataset.engine;
        if (selectedEngine === "gemini" && !hasGeminiKey) {
          showToast("Gemini indisponível no momento.", "warning");
          return;
        }
        if (selectedEngine === "claude" && !hasClaudeKey) {
          showToast("Claude indisponível no momento.", "warning");
          return;
        }
        if (selectedEngine === "openrouter" && !hasOpenRouterKey) {
          showToast("OpenRouter indisponível no momento.", "warning");
          return;
        }
        if (selectedEngine === "ollama" && !hasOllama) {
          showToast("Ollama indisponível no momento.", "warning");
          return;
        }
        if (selectedEngine) {
          updateTailorEngineUI(selectedEngine);
          const labels = {
            gemini: "Gemini 1.5 Flash (IA)",
            claude: `Claude (${claudeInfo?.model || "Sonnet 3.5"})`,
            openrouter: `OpenRouter (${openRouterInfo?.model || "Multi-LLM"})`,
            ollama: `Ollama (${ollamaInfo?.model || "Local"})`,
            local: "Motor ATS Local",
          };
          showToast(`Motor selecionado: ${labels[selectedEngine]}`, "info");
        }
        modeDropdown.classList.add("hidden");
        modeChevron?.classList.remove("rotate-180");
      });
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
      if (!modeDropdown.contains(e.target) && !btnModeMenu.contains(e.target)) {
        modeDropdown.classList.add("hidden");
        modeChevron?.classList.remove("rotate-180");
      }
    });
  }

  // Otimizar Currículo (Thin top 2.5px bar progress)
  const btnRun = document.getElementById("btn-run-tailor");
  if (btnRun) {
    btnRun.addEventListener("click", async () => {
      if (!selectedJobId) return;
      if (!currentMasterProfile?.fullName) {
        showToast("Cadastre o Master CV primeiro", "error");
        openProfileDrawer();
        return;
      }

      const useAi = currentTailorEngine === "gemini" && hasGeminiKey;
      const label = document.getElementById("tailor-btn-label");
      const icon = document.getElementById("tailor-btn-icon");

      if (currentTailorEngine === "gemini" && hasGeminiKey) {
        if (icon) {
          icon.setAttribute("data-lucide", "sparkles");
          icon.className = "w-4 h-4 animate-spin text-amber-300";
        }
        if (label) label.textContent = "Otimizando com IA...";
        showToast(
          "Conectando ao Gemini 1.5 Flash para otimização contextual...",
          "info",
        );
      } else if (currentTailorEngine === "claude" && hasClaudeKey) {
        if (icon) {
          icon.setAttribute("data-lucide", "loader-2");
          icon.className = "w-4 h-4 animate-spin text-purple-400";
        }
        if (label) label.textContent = "Otimizando (Claude)...";
        showToast(
          `Conectando ao Anthropic Claude (${claudeInfo?.model || "Sonnet 3.5"})...`,
          "info",
        );
      } else if (currentTailorEngine === "openrouter" && hasOpenRouterKey) {
        if (icon) {
          icon.setAttribute("data-lucide", "loader-2");
          icon.className = "w-4 h-4 animate-spin text-sky-400";
        }
        if (label) label.textContent = "Otimizando (OpenRouter)...";
        showToast(
          `Conectando ao OpenRouter (${openRouterInfo?.model || "Multi-LLM"})...`,
          "info",
        );
      } else if (currentTailorEngine === "ollama" && hasOllama) {
        if (icon) {
          icon.setAttribute("data-lucide", "loader-2");
          icon.className = "w-4 h-4 animate-spin text-emerald-400";
        }
        if (label) label.textContent = "Otimizando (Ollama)...";
        showToast(
          `Executando inferência local offline com Ollama (${ollamaInfo?.model})...`,
          "info",
        );
      } else {
        if (icon) {
          icon.setAttribute("data-lucide", "loader-2");
          icon.className = "w-4 h-4 animate-spin text-white";
        }
        if (label) label.textContent = "Otimizando...";
      }
      if (window.lucide) window.lucide.createIcons();
      btnRun.disabled = true;

      const bar = document.getElementById("top-progress-bar");
      bar.style.opacity = "1";
      bar.style.width = "30%";

      setTimeout(() => {
        bar.style.width = "75%";
      }, 150);

      try {
        const res = await fetch(`/api/jobs/${selectedJobId}/tailor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ useAi, engine: currentTailorEngine }),
        });
        const data = await res.json();

        bar.style.width = "100%";
        setTimeout(() => {
          bar.style.opacity = "0";
          bar.style.width = "0%";
        }, 300);

        if (res.ok) {
          const engineLabels = {
            gemini: "Gemini IA",
            claude: "Claude IA",
            openrouter: "OpenRouter IA",
            ollama: "Ollama Local",
            local: "Motor ATS",
          };
          const engineLabel = engineLabels[data.engine] || "Motor ATS";
          const diffPts = Math.round(data.scoreAfter - data.scoreBefore);
          showToast(
            `Otimizado (${engineLabel}): Score ${data.scoreAfter}/100 (+${diffPts} pts)`,
            "success",
          );
          await loadJobs();
          selectJob(selectedJobId);
        } else {
          showToast(data.error || "Erro ao otimizar", "error");
        }
      } catch {
        bar.style.opacity = "0";
        showToast("Erro na requisição", "error");
      } finally {
        updateTailorEngineUI(currentTailorEngine);
        btnRun.disabled = false;
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  // Recalcular Score inline
  const btnRecalculate = document.getElementById("btn-recalculate");
  if (btnRecalculate) {
    btnRecalculate.addEventListener("click", async () => {
      if (!selectedJobId) return;

      btnRecalculate.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5 animate-spin"></i><span>Calculando...</span>`;

      const headline = document.getElementById("edit-tailored-title").value;
      const summary = document.getElementById("edit-tailored-summary").value;
      const skills = document
        .getElementById("edit-tailored-skills")
        .value.split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const expTextareas = document.querySelectorAll(
        "#edit-tailored-experiences textarea",
      );
      const experiences = (currentMasterProfile?.experiences || []).map(
        (exp, idx) => ({
          ...exp,
          description: expTextareas[idx]
            ? expTextareas[idx].value
            : exp.description,
        }),
      );

      const updatedResume = {
        ...currentMasterProfile,
        headline,
        summary,
        skills,
        experiences,
      };

      try {
        const res = await fetch(`/api/jobs/${selectedJobId}/tailor`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tailoredResume: updatedResume }),
        });
        const data = await res.json();
        if (res.ok) {
          showToast(`Score: ${data.scoreAfter}/100`, "success");
          animateScoreCountUp(data.scoreAfter);
          updateInspectorBreakdown(data.auditAfter);
          renderA4Preview(updatedResume);
          await loadJobs();
        }
      } catch {
        showToast("Erro ao recalcular", "error");
      } finally {
        btnRecalculate.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5 text-emerald-400"></i><span>Recalcular Score</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  // Download Dropdown Menu & Formats
  const btnDownloadMenu = document.getElementById("btn-download-menu");
  const downloadDropdown = document.getElementById("download-dropdown-menu");
  const downloadChevron = document.getElementById("download-chevron-icon");
  const downloadOptionBtns = document.querySelectorAll(".download-option-btn");

  if (btnDownloadMenu && downloadDropdown) {
    btnDownloadMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = downloadDropdown.classList.contains("hidden");
      if (isHidden) {
        downloadDropdown.classList.remove("hidden");
        if (downloadChevron) downloadChevron.style.transform = "rotate(180deg)";
      } else {
        downloadDropdown.classList.add("hidden");
        if (downloadChevron) downloadChevron.style.transform = "rotate(0deg)";
      }
    });

    // Close when clicking anywhere outside
    document.addEventListener("click", (e) => {
      if (
        !downloadDropdown.contains(e.target) &&
        !btnDownloadMenu.contains(e.target)
      ) {
        downloadDropdown.classList.add("hidden");
        if (downloadChevron) downloadChevron.style.transform = "rotate(0deg)";
      }
    });

    // Options selection
    downloadOptionBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const format = btn.getAttribute("data-format");
        downloadDropdown.classList.add("hidden");
        if (downloadChevron) downloadChevron.style.transform = "rotate(0deg)";

        if (!selectedJobId) {
          showToast("Selecione uma vaga para exportar", "warning");
          return;
        }

        const formatLabels = {
          docx: "DOCX (Word ATS ⭐)",
          pdf: "PDF (Linear ATS XMP)",
          txt: "Texto Puro (.txt)",
          md: "Markdown (.md)",
          json: "JSON Resume (.json)",
        };

        const label = formatLabels[format] || format.toUpperCase();
        showToast(`Exportando currículo em ${label}...`, "info");
        window.location.href = `/api/jobs/${selectedJobId}/download/${format}`;
      });
    });

    // Quick Action: Copiar Texto Puro (Clipboard)
    const btnCopyPlainText = document.getElementById("btn-copy-plain-text");
    if (btnCopyPlainText) {
      btnCopyPlainText.addEventListener("click", async (e) => {
        e.stopPropagation();

        if (!selectedJobId) {
          showToast("Selecione uma vaga para copiar o currículo", "warning");
          return;
        }

        const copyLabel = document.getElementById("copy-quick-label");
        const copyBadge = document.getElementById("copy-quick-badge");
        const copyDesc = document.getElementById("copy-quick-desc");
        const copyBox = document.getElementById("copy-icon-box");

        // Feedback inicial
        if (copyLabel) copyLabel.textContent = "Compilando...";
        if (copyBadge) copyBadge.textContent = "Aguarde";

        try {
          const res = await fetch(`/api/jobs/${selectedJobId}/download/txt`);
          if (!res.ok)
            throw new Error("Falha ao obter texto puro do currículo");
          const plainText = await res.text();

          // Escrita na área de transferência com fallback
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(plainText);
          } else {
            const textArea = document.createElement("textarea");
            textArea.value = plainText;
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
          }

          // Feedback visual estrito: "Copiado!"
          if (copyLabel) copyLabel.textContent = "✅ Copiado!";
          if (copyBadge) {
            copyBadge.textContent = "Copiado!";
            copyBadge.className =
              "text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500 text-zinc-950 font-bold border border-emerald-400";
          }
          if (copyDesc)
            copyDesc.textContent = "Pronto para colar em formulários da Gupy!";
          if (copyBox)
            copyBox.className =
              "p-1.5 rounded-md bg-emerald-500 text-zinc-950 mt-0.5 border border-emerald-400 shrink-0 transition-colors";

          showToast(
            "Currículo copiado para o Clipboard! Pronto para a Gupy.",
            "success",
          );

          // Restaura estado após 2.5s
          setTimeout(() => {
            if (copyLabel) copyLabel.textContent = "📋 Copiar (Clipboard)";
            if (copyBadge) {
              copyBadge.textContent = "Rápido";
              copyBadge.className =
                "text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30";
            }
            if (copyDesc)
              copyDesc.textContent = "Texto limpo para colar em formulários";
            if (copyBox)
              copyBox.className =
                "p-1.5 rounded-md bg-emerald-500/20 text-emerald-400 mt-0.5 border border-emerald-500/30 shrink-0 transition-colors";
          }, 2500);

          // Fecha dropdown suavemente após 750ms para que o usuário veja a confirmação visual
          setTimeout(() => {
            downloadDropdown.classList.add("hidden");
            if (downloadChevron)
              downloadChevron.style.transform = "rotate(0deg)";
          }, 750);
        } catch (err) {
          console.error("Erro ao copiar texto:", err);
          showToast(
            "Erro ao copiar texto para a área de transferência",
            "error",
          );
          if (copyLabel) copyLabel.textContent = "Copiar (Clipboard)";
          if (copyBadge) copyBadge.textContent = "Rápido";
        }
      });
    }
  }

  // Save JD changes
  const btnSaveJd = document.getElementById("btn-save-jd");
  if (btnSaveJd) {
    btnSaveJd.addEventListener("click", async () => {
      if (!selectedJobId) return;
      const rawDescription = document.getElementById("jd-raw-text").value;
      const jobUrl = document.getElementById("jd-url-input").value;

      await fetch(`/api/jobs/${selectedJobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawDescription, jobUrl }),
      });
      showToast("Requisitos atualizados", "success");
      await loadJobs();
      selectJob(selectedJobId);
    });
  }

  // Re-extract JD
  const btnReExtract = document.getElementById("btn-re-extract-url");
  if (btnReExtract) {
    btnReExtract.addEventListener("click", async () => {
      const url = document.getElementById("jd-url-input").value.trim();
      if (!url) {
        showToast("Insira a URL da vaga", "error");
        return;
      }

      try {
        const res = await fetch("/api/jobs/extract-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
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

  // Delete job modal bindings
  const btnCancelDelete = document.getElementById("btn-cancel-delete-job");
  if (btnCancelDelete) {
    btnCancelDelete.addEventListener("click", hideDeleteJobModal);
  }

  const btnConfirmDelete = document.getElementById("btn-confirm-delete-job");
  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener("click", executeDeleteJob);
  }

  const modalDelete = document.getElementById("modal-confirm-delete-job");
  if (modalDelete) {
    modalDelete.addEventListener("click", (e) => {
      if (e.target === modalDelete) hideDeleteJobModal();
    });
  }

  // Close modal on Escape key
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      modalDelete &&
      !modalDelete.classList.contains("hidden")
    ) {
      hideDeleteJobModal();
    }
  });

  // Delete Job from Top Header
  const btnHeaderDelete = document.getElementById("btn-header-delete-job");
  if (btnHeaderDelete) {
    btnHeaderDelete.addEventListener("click", () => {
      if (selectedJobId) {
        showDeleteJobModal(selectedJobId);
      }
    });
  }

  // Delete Job from JD Tab
  const btnTabDelete = document.getElementById("btn-tab-delete-job");
  if (btnTabDelete) {
    btnTabDelete.addEventListener("click", () => {
      if (selectedJobId) {
        showDeleteJobModal(selectedJobId);
      }
    });
  }
}

let pendingDeleteJobId = null;

function showDeleteJobModal(jobId, jobTitle) {
  if (!jobId) return;
  pendingDeleteJobId = jobId;
  const targetJob =
    currentJobs.find((j) => j.id === jobId) ||
    (activeJobData && activeJobData.id === jobId ? activeJobData : null);
  const title = jobTitle || (targetJob ? targetJob.title : "esta vaga");

  const titleEl = document.getElementById("modal-delete-job-title");
  if (titleEl) titleEl.textContent = `"${title}"`;

  const modal = document.getElementById("modal-confirm-delete-job");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) window.lucide.createIcons();
}

function hideDeleteJobModal() {
  pendingDeleteJobId = null;
  const modal = document.getElementById("modal-confirm-delete-job");
  if (modal) modal.classList.add("hidden");
}

async function executeDeleteJob() {
  if (!pendingDeleteJobId) return;
  const jobId = pendingDeleteJobId;
  hideDeleteJobModal();

  try {
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      showToast("Vaga removida com sucesso", "info");

      // If the deleted job was currently active, clear active selection
      if (selectedJobId === jobId) {
        selectedJobId = null;
        activeJobData = null;
      }

      await loadJobs();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "Erro ao excluir vaga", "error");
    }
  } catch (err) {
    console.error("Erro ao excluir vaga:", err);
    showToast("Erro de rede ao excluir vaga", "error");
  }
}

// Legacy alias for compatibility
window.handleDeleteJob = async function handleDeleteJob(jobId, jobTitle) {
  showDeleteJobModal(jobId, jobTitle);
};

// ============================================================================
// 9. ADD JOB MODAL
// ============================================================================
function setupAddJobModal() {
  const modal = document.getElementById("modal-add-job");
  const btnOpen = document.getElementById("btn-open-add-job");
  const btnClose = document.getElementById("modal-add-job-close");
  const btnCancel = document.getElementById("btn-modal-cancel");
  const form = document.getElementById("form-create-job");
  const btnExtract = document.getElementById("btn-modal-extract");
  const urlInput = document.getElementById("modal-job-url");
  const feedback = document.getElementById("modal-extract-feedback");

  if (btnOpen) {
    btnOpen.addEventListener("click", () => {
      form.reset();
      urlInput.value = "";
      feedback.textContent = "";
      modal.classList.remove("hidden");
    });
  }

  const closeModal = () => modal.classList.add("hidden");
  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);

  // Fechar ao clicar no background externo (backdrop)
  if (modal) {
    let startedOnBackdrop = false;
    modal.addEventListener("mousedown", (e) => {
      startedOnBackdrop = e.target === modal;
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal && startedOnBackdrop) {
        closeModal();
      }
      startedOnBackdrop = false;
    });
  }

  // Fechar ao pressionar tecla Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });

  if (btnExtract) {
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
          body: JSON.stringify({ url }),
        });
        const data = await res.json();

        if (res.ok) {
          document.getElementById("modal-input-title").value = data.title || "";
          document.getElementById("modal-input-company").value =
            data.company || "";
          document.getElementById("modal-input-description").value =
            data.description || "";
          feedback.innerHTML = `<span class="text-emerald-400 font-medium">${escapeHtml(data.company)} • ${data.keywords.length} keywords extraídas</span>`;
        } else {
          feedback.innerHTML = `<span class="text-zinc-400">${data.error}</span>`;
        }
      } catch {
        feedback.innerHTML = `<span class="text-rose-400">Erro na extração</span>`;
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const payload = {
        title: document.getElementById("modal-input-title").value,
        company: document.getElementById("modal-input-company").value,
        jobUrl: urlInput.value.trim() || undefined,
        status: document.getElementById("modal-input-status").value,
        notes: document.getElementById("modal-input-notes").value,
        rawDescription: document.getElementById("modal-input-description")
          .value,
      };

      try {
        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
}

// ============================================================================
// 10. TOAST SYSTEM
// ============================================================================
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");

  const colors = {
    success: "border-emerald-500/40 text-emerald-300",
    error: "border-rose-900/60 text-rose-300",
    info: "border-zinc-700 text-zinc-200",
  };

  toast.className = `toast-item pointer-events-auto px-4 py-2.5 rounded-lg border ${colors[type]} shadow-xl flex items-center gap-2.5`;
  toast.style.backgroundColor = "var(--bg-panel)";
  toast.style.borderColor = "var(--border-color)";
  toast.innerHTML = `<span class="text-xs font-mono font-medium">${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.2s ease";
    setTimeout(() => toast.remove(), 200);
  }, 2600);
}

// ============================================================================
// 11. SECURITY & ESCAPING
// ============================================================================
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================================
// 12. KNOCKOUT QUESTIONS TAB (Perguntas Eliminatórias)
// ============================================================================
const kqAutoSaveTimeouts = new Map();

async function loadKnockoutQuestions(jobId) {
  if (!jobId) return;
  try {
    const res = await fetch(`/api/jobs/${jobId}/knockout`);
    const data = await res.json();
    if (res.ok) {
      currentKnockoutQuestions = data.questions || [];
      renderKnockoutQuestionsList();
    }
  } catch (err) {
    console.error("Erro ao carregar perguntas eliminatórias:", err);
  }
}

function renderKnockoutQuestionsList() {
  const container = document.getElementById("knockout-questions-list");
  const emptyState = document.getElementById("knockout-empty-state");
  if (!container) return;

  if (currentKnockoutQuestions.length === 0) {
    container.innerHTML = "";
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  container.innerHTML = currentKnockoutQuestions
    .map((q, idx) => {
      const currentAnswer = q.candidateAnswer || q.aiSuggestedAnswer || "";

      return `
      <div class="p-5 rounded-xl border space-y-3.5 fade-slide-up" style="border-color: var(--border-color); background-color: var(--bg-panel);" id="kq-card-${escapeHtml(q.id)}">
        
        <!-- Header da Pergunta -->
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-[11px] font-mono px-2 py-0.5 rounded font-semibold border" style="border-color: var(--border-color); background-color: var(--bg-subtle); color: var(--text-secondary);">
                #${idx + 1}
              </span>
              <span class="text-xs font-mono text-zinc-500">Formulário da Vaga</span>
            </div>
            <h4 class="text-sm font-semibold leading-relaxed" style="color: var(--text-primary);">${escapeHtml(q.questionText)}</h4>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <!-- Excluir Pergunta -->
            <button class="btn-delete-kq btn-spring p-1.5 rounded-md text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer" data-id="${escapeHtml(q.id)}" title="Excluir pergunta">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Resposta Final Unificada (Método STAR / IA) com Salvamento Automático -->
        <div class="space-y-2 pt-1">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="text-zinc-500 font-semibold uppercase flex items-center gap-1.5">
              <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-500"></i>
              <span>Resposta Validada (Pronta para Gupy / Greenhouse)</span>
            </span>
            <span class="text-zinc-500 text-[11px]" id="kq-counter-${escapeHtml(q.id)}">${currentAnswer.length} caracteres</span>
          </div>

          <textarea rows="4" class="kq-answer-textarea ui-input w-full font-sans text-xs leading-relaxed" placeholder="A resposta será gerada automaticamente..." data-id="${escapeHtml(q.id)}">${escapeHtml(currentAnswer)}</textarea>

          <div class="flex items-center justify-between pt-1">
            <!-- Indicador de Salvamento Automático -->
            <div class="text-[11px] font-mono flex items-center gap-1.5" id="kq-autosave-${escapeHtml(q.id)}">
              <i data-lucide="check" class="w-3 h-3 text-emerald-500"></i>
              <span class="text-zinc-400">Salvo automaticamente</span>
            </div>

            <!-- Ações -->
            <div class="flex items-center gap-2">
              <button class="btn-regenerate-kq btn-spring p-1.5 rounded-md border text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer" style="border-color: var(--border-color); background-color: var(--bg-subtle);" data-id="${escapeHtml(q.id)}" title="Regerar resposta com IA">
                <i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i>
              </button>
              <button class="btn-copy-kq btn-spring px-3 py-1.5 rounded-md border text-xs font-mono font-medium flex items-center gap-1.5 cursor-pointer transition-colors" style="border-color: var(--border-color); background-color: var(--bg-subtle); color: var(--text-primary);" data-id="${escapeHtml(q.id)}">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                <span>Copiar Resposta</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    `;
    })
    .join("");

  if (window.lucide) window.lucide.createIcons();

  // Attach card event listeners
  setupKnockoutCardListeners();
}

function setupKnockoutCardListeners() {
  // Delete Question
  document.querySelectorAll(".btn-delete-kq").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const qid = btn.dataset.id;
      if (!confirm("Deseja realmente remover esta pergunta eliminatória?"))
        return;
      try {
        const res = await fetch(`/api/jobs/${selectedJobId}/knockout/${qid}`, {
          method: "DELETE",
        });
        if (res.ok) {
          currentKnockoutQuestions = currentKnockoutQuestions.filter(
            (item) => item.id !== qid,
          );
          showToast("Pergunta removida", "info");
          renderKnockoutQuestionsList();
        }
      } catch {
        showToast("Erro ao excluir", "error");
      }
    });
  });

  // Regenerate Answer (discreet refresh option)
  document.querySelectorAll(".btn-regenerate-kq").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const qid = btn.dataset.id;
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>`;
      btn.disabled = true;

      try {
        const res = await fetch(
          `/api/jobs/${selectedJobId}/knockout/${qid}/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ engine: currentTailorEngine }),
          },
        );
        const data = await res.json();
        if (res.ok) {
          showToast("Resposta regerada com sucesso!", "success");
          await loadKnockoutQuestions(selectedJobId);
        } else {
          showToast(data.error || "Erro ao regerar resposta", "error");
          btn.innerHTML = originalHtml;
          btn.disabled = false;
        }
      } catch {
        showToast("Erro de rede na geração", "error");
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }
    });
  });

  // Copy Answer
  document.querySelectorAll(".btn-copy-kq").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const qid = btn.dataset.id;
      const card = document.getElementById(`kq-card-${qid}`);
      const textarea = card?.querySelector(".kq-answer-textarea");
      const answerText = textarea?.value?.trim() || "";

      if (!answerText) {
        showToast("Nenhuma resposta para copiar.", "info");
        return;
      }

      await navigator.clipboard.writeText(answerText);
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i><span class="text-emerald-400">Copiada!</span>`;
      showToast("Resposta copiada para o formulário!", "success");
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        if (window.lucide) window.lucide.createIcons();
      }, 2000);
    });
  });

  // Auto-save on textarea edit
  document.querySelectorAll(".kq-answer-textarea").forEach((textarea) => {
    const qid = textarea.dataset.id;
    const counter = document.getElementById(`kq-counter-${qid}`);
    const indicator = document.getElementById(`kq-autosave-${qid}`);

    const saveAnswer = async (text) => {
      try {
        if (indicator) {
          indicator.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin text-zinc-400"></i><span class="text-zinc-400">Salvando...</span>`;
          if (window.lucide) window.lucide.createIcons();
        }
        const res = await fetch(`/api/jobs/${selectedJobId}/knockout/${qid}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateAnswer: text }),
        });
        if (res.ok) {
          const q = currentKnockoutQuestions.find((i) => i.id === qid);
          if (q) q.candidateAnswer = text;
          if (indicator) {
            indicator.innerHTML = `<i data-lucide="check" class="w-3 h-3 text-emerald-500"></i><span class="text-emerald-500">Salvo automaticamente</span>`;
            if (window.lucide) window.lucide.createIcons();
          }
        }
      } catch {
        if (indicator) {
          indicator.innerHTML = `<span class="text-rose-400">Erro ao salvar</span>`;
        }
      }
    };

    textarea.addEventListener("input", (e) => {
      const val = e.target.value;
      if (counter) counter.textContent = `${val.length} caracteres`;

      if (indicator) {
        indicator.innerHTML = `<span class="text-zinc-400">Alterações não salvas...</span>`;
      }

      if (kqAutoSaveTimeouts.has(qid)) {
        clearTimeout(kqAutoSaveTimeouts.get(qid));
      }

      const timeout = setTimeout(() => {
        saveAnswer(val);
        kqAutoSaveTimeouts.delete(qid);
      }, 600);
      kqAutoSaveTimeouts.set(qid, timeout);
    });

    textarea.addEventListener("blur", (e) => {
      if (kqAutoSaveTimeouts.has(qid)) {
        clearTimeout(kqAutoSaveTimeouts.get(qid));
        kqAutoSaveTimeouts.delete(qid);
        saveAnswer(e.target.value);
      }
    });
  });
}

function setupKnockoutQuestionsEvents() {
  // Quick template pills
  document.querySelectorAll(".kq-quick-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const input = document.getElementById("knockout-new-question-input");
      if (input) {
        input.value = pill.dataset.template || "";
        input.focus();
      }
    });
  });

  // Add Question Button: creates question AND automatically triggers response generation
  const btnAdd = document.getElementById("btn-add-knockout");
  const input = document.getElementById("knockout-new-question-input");

  if (btnAdd && input) {
    const handleAdd = async () => {
      if (!selectedJobId) {
        showToast("Selecione uma vaga primeiro", "info");
        return;
      }
      const text = input.value.trim();
      if (!text) {
        showToast("Insira o texto da pergunta", "info");
        input.focus();
        return;
      }

      const origHtml = btnAdd.innerHTML;
      btnAdd.disabled = true;
      btnAdd.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Gerando resposta...</span>`;

      try {
        // 1. Cria a pergunta
        const res = await fetch(`/api/jobs/${selectedJobId}/knockout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionText: text }),
        });
        const data = await res.json();
        if (!res.ok || !data.question?.id) {
          showToast(data.error || "Erro ao adicionar pergunta", "error");
          btnAdd.disabled = false;
          btnAdd.innerHTML = origHtml;
          return;
        }

        const qid = data.question.id;
        input.value = "";

        // 2. Triga automaticamente a geração de resposta inteligente
        const genRes = await fetch(
          `/api/jobs/${selectedJobId}/knockout/${qid}/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ engine: currentTailorEngine }),
          },
        );
        await genRes.json();

        if (genRes.ok) {
          showToast(
            "Pergunta adicionada e resposta gerada com sucesso!",
            "success",
          );
        } else {
          showToast("Pergunta criada", "info");
        }

        await loadKnockoutQuestions(selectedJobId);
      } catch (err) {
        console.error("Erro ao adicionar pergunta e gerar resposta:", err);
        showToast("Erro na requisição", "error");
      } finally {
        btnAdd.disabled = false;
        btnAdd.innerHTML = origHtml;
        if (window.lucide) window.lucide.createIcons();
      }
    };

    btnAdd.addEventListener("click", handleAdd);

    // Support Ctrl+Enter / Enter in textarea
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleAdd();
      }
    });
  }
}

// ============================================================================
// 14. COVER LETTER STUDIO (Gerador de Carta de Apresentação)
// ============================================================================
let currentCoverLetter = null;
let coverLetterAutosaveTimer = null;
let currentCoverLetterTone = "tecnico";

function updateCoverLetterLetterhead() {
  const senderName = document.getElementById("cl-sender-name");
  const senderHeadline = document.getElementById("cl-sender-headline");
  const senderContact = document.getElementById("cl-sender-contact");
  const senderSignature = document.getElementById("cl-signature-name");
  const dateEl = document.getElementById("cl-letter-date");
  const headerCompany = document.getElementById("cl-header-company");
  const headerTitle = document.getElementById("cl-header-title");
  const emptyCompany = document.getElementById("cl-empty-company");

  const name = currentMasterProfile?.fullName || "Candidato";
  const headline =
    currentMasterProfile?.headline || "Profissional de Tecnologia";
  const loc = currentMasterProfile?.location || "";
  const email = currentMasterProfile?.email || "";
  const contactText = [loc, email].filter(Boolean).join(" • ");

  if (senderName) senderName.textContent = name;
  if (senderHeadline) senderHeadline.textContent = headline;
  if (senderContact) senderContact.textContent = contactText || email;
  if (senderSignature) senderSignature.textContent = name;

  if (dateEl) {
    const today = new Date();
    dateEl.textContent = today.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const comp = activeJobData?.company || "Empresa";
  const jobTitle = activeJobData?.title || "Vaga Alvo";

  if (headerCompany) headerCompany.textContent = comp;
  if (headerTitle)
    headerTitle.textContent = `Candidatura à posição de ${jobTitle}`;
  if (emptyCompany) emptyCompany.textContent = comp;
}

async function loadCoverLetter(jobId) {
  if (!jobId) return;

  updateCoverLetterLetterhead();

  const contentEl = document.getElementById("cover-letter-content");
  const emptyState = document.getElementById("cl-empty-state");
  const paperCard = document.getElementById("cl-paper-card");

  try {
    const res = await fetch(`/api/jobs/${jobId}/cover-letter`);
    if (res.ok) {
      const data = await res.json();
      const letter = data.coverLetter || data;
      currentCoverLetter = letter;

      if (letter?.content && letter.content.trim().length > 0) {
        if (contentEl) contentEl.value = letter.content;
        currentCoverLetterTone = letter.tone || "tecnico";
        setCoverLetterTonePill(currentCoverLetterTone);
        if (emptyState) emptyState.classList.add("hidden");
        if (paperCard) paperCard.classList.remove("hidden");
      } else {
        currentCoverLetter = null;
        if (contentEl) contentEl.value = "";
        if (emptyState) emptyState.classList.remove("hidden");
        if (paperCard) paperCard.classList.add("hidden");
      }
      updateCoverLetterCounters();
    } else {
      currentCoverLetter = null;
      if (contentEl) contentEl.value = "";
      if (emptyState) emptyState.classList.remove("hidden");
      if (paperCard) paperCard.classList.add("hidden");
      updateCoverLetterCounters();
    }
  } catch (err) {
    console.error("Erro ao carregar carta de apresentação:", err);
  }
}

function setCoverLetterTonePill(tone) {
  const normalizedKey = tone?.toLowerCase().includes("executiv")
    ? "executivo"
    : tone?.toLowerCase().includes("entusiast") ||
        tone?.toLowerCase().includes("cultural")
      ? "entusiasta"
      : "tecnico";

  currentCoverLetterTone = normalizedKey;
  document.querySelectorAll(".cl-tone-pill").forEach((pill) => {
    const match = pill.dataset.tone === normalizedKey;
    pill.classList.toggle("active", match);
  });

  const toneLabels = {
    tecnico: "Técnico & Direto",
    executivo: "Executivo & Liderança",
    entusiasta: "Entusiasta & Cultural",
  };
  const toneFooter = document.getElementById("cl-badge-tone-footer");
  if (toneFooter) {
    toneFooter.textContent = `Tom: ${toneLabels[normalizedKey] || "Técnico & Direto"}`;
  }
}

function updateCoverLetterCounters() {
  const contentEl = document.getElementById("cover-letter-content");
  const wordCounter = document.getElementById("cl-word-counter");
  const charCounter = document.getElementById("cl-char-counter");
  const readTime = document.getElementById("cl-read-time");

  const text = (contentEl?.value || "").trim();
  const words = text ? text.split(/\s+/).length : 0;
  const chars = text.length;

  if (wordCounter) wordCounter.textContent = `${words} palavras`;
  if (charCounter) charCounter.textContent = `${chars} caracteres`;
  if (readTime) {
    const minutes = Math.max(1, Math.ceil(words / 180));
    readTime.textContent = words > 0 ? `~${minutes} min` : "0 min";
  }
}

async function generateCoverLetter(jobId) {
  if (!jobId) {
    showToast("Selecione uma vaga no pipeline primeiro", "info");
    return;
  }
  if (!currentMasterProfile?.fullName) {
    showToast("Cadastre o Master CV primeiro", "error");
    openProfileDrawer();
    return;
  }

  const btnGen = document.getElementById("btn-generate-cover-letter");
  const labelGen = document.getElementById("cl-generate-label");
  const iconGen = document.getElementById("cl-generate-icon");
  const btnEmptyGen = document.getElementById("btn-empty-generate-cl");

  // Determine actual engine
  let engineToUse = currentTailorEngine;
  if (engineToUse === "gemini" && !hasGeminiKey) {
    engineToUse = "local";
  } else if (engineToUse === "claude" && !hasClaudeKey) {
    engineToUse = "local";
  } else if (engineToUse === "openrouter" && !hasOpenRouterKey) {
    engineToUse = "local";
  } else if (engineToUse === "ollama" && !hasOllama) {
    engineToUse = "local";
  }

  if (btnGen) btnGen.disabled = true;
  if (btnEmptyGen) btnEmptyGen.disabled = true;
  if (labelGen) labelGen.textContent = "Redigindo...";
  if (iconGen) {
    iconGen.setAttribute("data-lucide", "loader-2");
    iconGen.className = "w-3.5 h-3.5 animate-spin";
  }
  if (window.lucide) window.lucide.createIcons();

  const engineFeedback =
    engineToUse === "ollama"
      ? `Ollama (${ollamaInfo?.model || "local"})`
      : engineToUse === "claude"
        ? `Claude (${claudeInfo?.model || "Sonnet 3.5"})`
        : engineToUse === "openrouter"
          ? `OpenRouter (${openRouterInfo?.model || "Multi-LLM"})`
          : engineToUse === "gemini"
            ? "Gemini 1.5 Flash"
            : "Motor ATS Determinístico";
  showToast(`Redigindo carta personalizada com ${engineFeedback}...`, "info");

  try {
    const res = await fetch(`/api/jobs/${jobId}/cover-letter/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tone: currentCoverLetterTone,
        engine: engineToUse,
        recipientCompany: activeJobData?.company || "",
        jobTitle: activeJobData?.title || "",
      }),
    });
    const data = await res.json();
    if (res.ok) {
      const letter = data.coverLetter || data;
      currentCoverLetter = letter;
      const contentEl = document.getElementById("cover-letter-content");
      if (contentEl) contentEl.value = letter.content || "";

      const emptyState = document.getElementById("cl-empty-state");
      const paperCard = document.getElementById("cl-paper-card");
      if (emptyState) emptyState.classList.add("hidden");
      if (paperCard) paperCard.classList.remove("hidden");

      updateCoverLetterLetterhead();
      updateCoverLetterCounters();

      if (contentEl) {
        contentEl.classList.add("ring-2", "ring-emerald-500/30");
        setTimeout(
          () => contentEl.classList.remove("ring-2", "ring-emerald-500/30"),
          1200,
        );
      }

      const toneLabels = {
        tecnico: "Técnico & Direto",
        executivo: "Executivo & Liderança",
        entusiasta: "Entusiasta & Cultural",
      };
      const activeToneName =
        toneLabels[currentCoverLetterTone] || "Técnico & Direto";
      showToast(
        `Carta gerada com sucesso no tom ${activeToneName}!`,
        "success",
      );
    } else {
      showToast(data.error || "Erro ao gerar carta", "error");
    }
  } catch (err) {
    console.error("Erro ao gerar carta:", err);
    showToast("Erro na requisição ao gerar carta", "error");
  } finally {
    if (btnGen) btnGen.disabled = false;
    if (btnEmptyGen) btnEmptyGen.disabled = false;
    if (labelGen) labelGen.textContent = "Redigir Carta";
    if (iconGen) {
      iconGen.setAttribute("data-lucide", "sparkles");
      iconGen.className = "w-3.5 h-3.5 fill-current";
    }
    if (window.lucide) window.lucide.createIcons();
  }
}

async function saveCoverLetter(jobId) {
  if (!jobId) return;
  const contentEl = document.getElementById("cover-letter-content");
  const autosaveIndicator = document.getElementById("cl-autosave-indicator");
  const content = contentEl?.value || "";

  if (autosaveIndicator) {
    autosaveIndicator.className = "flex items-center gap-1 text-zinc-400";
    autosaveIndicator.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i><span>Salvando...</span>`;
    if (window.lucide) window.lucide.createIcons();
  }

  try {
    const res = await fetch(`/api/jobs/${jobId}/cover-letter`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        tone: currentCoverLetterTone,
        recipientCompany: activeJobData?.company || "",
        jobTitle: activeJobData?.title || "",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      currentCoverLetter = data.coverLetter || data;
      if (autosaveIndicator) {
        autosaveIndicator.className =
          "flex items-center gap-1 text-emerald-400";
        autosaveIndicator.innerHTML = `<i data-lucide="check" class="w-3 h-3"></i><span>Salvo automaticamente</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  } catch (err) {
    console.error("Erro ao salvar carta:", err);
    if (autosaveIndicator) {
      autosaveIndicator.className = "flex items-center gap-1 text-rose-400";
      autosaveIndicator.innerHTML = `<i data-lucide="alert-circle" class="w-3 h-3"></i><span>Erro ao salvar</span>`;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

function setupCoverLetterStudio() {
  const btnGen = document.getElementById("btn-generate-cover-letter");
  if (btnGen) {
    btnGen.addEventListener("click", () => generateCoverLetter(selectedJobId));
  }

  // Cover Letter Engine Dropdown Menu (Mesmo comportamento do Header)
  const btnClEngineMenu = document.getElementById("btn-cl-engine-menu");
  const clEngineDropdown = document.getElementById("cl-engine-dropdown-menu");
  const clEngineChevron = document.getElementById("cl-engine-chevron-icon");

  if (btnClEngineMenu && clEngineDropdown) {
    btnClEngineMenu.addEventListener("click", async (e) => {
      e.stopPropagation();
      await checkSystemConfig();
      const isHidden = clEngineDropdown.classList.contains("hidden");

      // Close other dropdowns
      document
        .getElementById("cl-export-dropdown-menu")
        ?.classList.add("hidden");
      document
        .getElementById("cl-export-chevron")
        ?.classList.remove("rotate-180");

      if (isHidden) {
        clEngineDropdown.classList.remove("hidden");
        clEngineChevron?.classList.add("rotate-180");
      } else {
        clEngineDropdown.classList.add("hidden");
        clEngineChevron?.classList.remove("rotate-180");
      }
    });

    document.querySelectorAll(".cl-engine-option-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const selectedEngine = btn.dataset.engine;
        if (selectedEngine === "gemini" && !hasGeminiKey) {
          showToast("Gemini indisponível no momento.", "warning");
          return;
        }
        if (selectedEngine === "claude" && !hasClaudeKey) {
          showToast("Claude indisponível no momento.", "warning");
          return;
        }
        if (selectedEngine === "openrouter" && !hasOpenRouterKey) {
          showToast("OpenRouter indisponível no momento.", "warning");
          return;
        }
        if (selectedEngine === "ollama" && !hasOllama) {
          showToast("Ollama indisponível no momento.", "warning");
          return;
        }
        if (selectedEngine) {
          updateTailorEngineUI(selectedEngine);
          const labels = {
            gemini: "Gemini 1.5 Flash (IA)",
            claude: `Claude (${claudeInfo?.model || "Sonnet 3.5"})`,
            openrouter: `OpenRouter (${openRouterInfo?.model || "Multi-LLM"})`,
            ollama: `Ollama (${ollamaInfo?.model || "Local"})`,
            local: "Motor ATS Local",
          };
          showToast(
            `Motor de redação ativo: ${labels[selectedEngine]}`,
            "info",
          );
        }
        clEngineDropdown.classList.add("hidden");
        clEngineChevron?.classList.remove("rotate-180");
      });
    });

    document.addEventListener("click", (e) => {
      if (
        !clEngineDropdown.contains(e.target) &&
        !btnClEngineMenu.contains(e.target)
      ) {
        clEngineDropdown.classList.add("hidden");
        clEngineChevron?.classList.remove("rotate-180");
      }
    });
  }

  const btnEmptyGen = document.getElementById("btn-empty-generate-cl");
  if (btnEmptyGen) {
    btnEmptyGen.addEventListener("click", () =>
      generateCoverLetter(selectedJobId),
    );
  }

  // Tone segmented pills
  document.querySelectorAll(".cl-tone-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const tone = pill.dataset.tone;
      if (tone) {
        setCoverLetterTonePill(tone);
        const toneLabels = {
          tecnico: "Técnico & Direto",
          executivo: "Executivo & Liderança",
          entusiasta: "Entusiasta & Cultural",
        };
        const toneName = toneLabels[tone] || tone;
        if (currentCoverLetter?.content) {
          showToast(
            `Tom "${toneName}" selecionado. Clique em "Redigir Carta" para redigir neste tom.`,
            "info",
          );
        } else {
          showToast(`Tom "${toneName}" selecionado.`, "info");
        }
      }
    });
  });

  // Seamless Textarea with input counter & auto-save
  const contentEl = document.getElementById("cover-letter-content");
  if (contentEl) {
    contentEl.addEventListener("input", () => {
      updateCoverLetterCounters();
      const autosaveIndicator = document.getElementById(
        "cl-autosave-indicator",
      );
      if (autosaveIndicator) {
        autosaveIndicator.className = "flex items-center gap-1 text-zinc-400";
        autosaveIndicator.innerHTML = `<i data-lucide="edit-3" class="w-3 h-3"></i><span>Digitando...</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
      clearTimeout(coverLetterAutosaveTimer);
      coverLetterAutosaveTimer = setTimeout(() => {
        saveCoverLetter(selectedJobId);
      }, 800);
    });

    contentEl.addEventListener("blur", () => {
      clearTimeout(coverLetterAutosaveTimer);
      saveCoverLetter(selectedJobId);
    });
  }

  // Copy to clipboard button
  const btnCopy = document.getElementById("btn-copy-cover-letter");
  if (btnCopy) {
    btnCopy.addEventListener("click", async () => {
      const content = contentEl?.value || "";
      if (!content.trim()) {
        showToast(
          "Carta vazia. Clique em 'Redigir Carta' primeiro.",
          "warning",
        );
        return;
      }
      try {
        await navigator.clipboard.writeText(content);
        const origText = document.getElementById("cl-copy-text");
        const origIcon = document.getElementById("cl-copy-icon");
        if (origText) origText.textContent = "Copiado!";
        if (origIcon) {
          origIcon.setAttribute("data-lucide", "check");
          origIcon.className = "w-3.5 h-3.5 text-emerald-400";
        }
        if (window.lucide) window.lucide.createIcons();
        showToast(
          "Carta de apresentação copiada para a área de transferência!",
          "success",
        );
        setTimeout(() => {
          if (origText) origText.textContent = "Copiar";
          if (origIcon) {
            origIcon.setAttribute("data-lucide", "copy");
            origIcon.className = "w-3.5 h-3.5 text-zinc-400";
          }
          if (window.lucide) window.lucide.createIcons();
        }, 2000);
      } catch {
        showToast("Não foi possível copiar automaticamente", "error");
      }
    });
  }

  // Export Dropdown menu
  const btnExportMenu = document.getElementById("btn-cl-export-menu");
  const exportDropdown = document.getElementById("cl-export-dropdown-menu");
  const exportChevron = document.getElementById("cl-export-chevron");

  if (btnExportMenu && exportDropdown) {
    btnExportMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = exportDropdown.classList.contains("hidden");
      if (isHidden) {
        exportDropdown.classList.remove("hidden");
        exportChevron?.classList.add("rotate-180");
      } else {
        exportDropdown.classList.add("hidden");
        exportChevron?.classList.remove("rotate-180");
      }
    });

    document.addEventListener("click", (e) => {
      if (
        !exportDropdown.contains(e.target) &&
        !btnExportMenu.contains(e.target)
      ) {
        exportDropdown.classList.add("hidden");
        exportChevron?.classList.remove("rotate-180");
      }
    });
  }

  // Download buttons
  const btnPdf = document.getElementById("btn-download-cl-pdf");
  if (btnPdf) {
    btnPdf.addEventListener("click", () => {
      if (!selectedJobId) {
        showToast("Selecione uma vaga primeiro", "info");
        return;
      }
      exportDropdown?.classList.add("hidden");
      window.open(
        `/api/jobs/${selectedJobId}/download/cover-letter/pdf`,
        "_blank",
      );
    });
  }

  const btnDocx = document.getElementById("btn-download-cl-docx");
  if (btnDocx) {
    btnDocx.addEventListener("click", () => {
      if (!selectedJobId) {
        showToast("Selecione uma vaga primeiro", "info");
        return;
      }
      exportDropdown?.classList.add("hidden");
      window.open(
        `/api/jobs/${selectedJobId}/download/cover-letter/docx`,
        "_blank",
      );
    });
  }

  const btnTxt = document.getElementById("btn-download-cl-txt");
  if (btnTxt) {
    btnTxt.addEventListener("click", () => {
      if (!selectedJobId) {
        showToast("Selecione uma vaga primeiro", "info");
        return;
      }
      exportDropdown?.classList.add("hidden");
      window.open(
        `/api/jobs/${selectedJobId}/download/cover-letter/txt`,
        "_blank",
      );
    });
  }
}
