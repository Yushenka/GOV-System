const config = window.APP_CONFIG || {};
const storageKey = "gov-hr-audit-login";

const actionLabels = {
  hire: "Прийнято",
  promote: "Підвищено",
  transfer: "Переведено",
  fire: "Звільнено"
};

const state = {
  loginCode: "",
  currentUser: null,
  members: [],
  ranks: [],
  history: [],
  actionType: "hire",
  historySearch: "",
  submitting: false
};

const els = {
  setupNotice: document.getElementById("setupNotice"),
  loginScreen: document.getElementById("loginScreen"),
  appShell: document.getElementById("appShell"),
  loginForm: document.getElementById("loginForm"),
  loginInput: document.getElementById("loginInput"),
  loginButton: document.getElementById("loginButton"),
  loginError: document.getElementById("loginError"),
  logoutButton: document.getElementById("logoutButton"),
  currentUserName: document.getElementById("currentUserName"),
  currentUserMeta: document.getElementById("currentUserMeta"),
  currentUserBadge: document.getElementById("currentUserBadge"),
  initiatorName: document.getElementById("initiatorName"),
  initiatorLogin: document.getElementById("initiatorLogin"),
  initiatorStaticId: document.getElementById("initiatorStaticId"),
  initiatorRank: document.getElementById("initiatorRank"),
  targetSelect: document.getElementById("targetSelect"),
  targetStaticId: document.getElementById("targetStaticId"),
  targetRank: document.getElementById("targetRank"),
  hireFullName: document.getElementById("hireFullName"),
  hireStaticId: document.getElementById("hireStaticId"),
  existingTargetBlock: document.getElementById("existingTargetBlock"),
  hireTargetBlock: document.getElementById("hireTargetBlock"),
  actionGroup: document.getElementById("actionGroup"),
  newRankSelect: document.getElementById("newRankSelect"),
  rankFieldBlock: document.getElementById("rankFieldBlock"),
  reasonInput: document.getElementById("reasonInput"),
  summaryText: document.getElementById("summaryText"),
  statusMessage: document.getElementById("statusMessage"),
  submitButton: document.getElementById("submitButton"),
  resetButton: document.getElementById("resetButton"),
  topStatus: document.getElementById("topStatus"),
  historySearch: document.getElementById("historySearch"),
  historyCount: document.getElementById("historyCount"),
  historyList: document.getElementById("historyList")
};

function hasValidConfig() {
  return typeof config.supabaseUrl === "string" && config.supabaseUrl.startsWith("https://") && !config.supabaseUrl.includes("YOUR-PROJECT-REF");
}

function functionUrl(name) {
  return `${config.supabaseUrl.replace(/\/$/, "")}/functions/v1/${name}`;
}

async function callFunction(name, payload) {
  const response = await fetch(functionUrl(name), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Сталася помилка під час звернення до сервера.");
  }

  return data;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatRank(rankNumber, rankName) {
  if (!rankName) {
    return "—";
  }

  return rankNumber ? `[${rankNumber}] ${rankName}` : rankName;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function getSelectedExistingMember() {
  return state.members.find((member) => member.static_id === els.targetSelect.value) || null;
}

function isHireAction() {
  return state.actionType === "hire";
}

function isFireAction() {
  return state.actionType === "fire";
}

function setTopStatus(message) {
  els.topStatus.textContent = message;
}

function setStatusMessage(message, type = "") {
  els.statusMessage.textContent = message;
  els.statusMessage.className = "status-message";
  if (type) {
    els.statusMessage.classList.add(type);
  }
}

function showLoginError(message) {
  els.loginError.textContent = message;
  els.loginError.classList.remove("hidden");
}

function hideLoginError() {
  els.loginError.classList.add("hidden");
}

function renderCurrentUser() {
  if (!state.currentUser) {
    return;
  }

  const rankLabel = formatRank(state.currentUser.current_rank_number, state.currentUser.current_rank_name);
  els.currentUserName.textContent = state.currentUser.full_name;
  els.currentUserMeta.textContent = `Static ID: ${state.currentUser.static_id} • ${rankLabel}`;
  els.currentUserBadge.textContent = state.currentUser.login_code;
  els.initiatorName.value = state.currentUser.full_name;
  els.initiatorLogin.value = state.currentUser.login_code;
  els.initiatorStaticId.value = state.currentUser.static_id;
  els.initiatorRank.value = rankLabel;
}

function renderMembers() {
  els.targetSelect.innerHTML = state.members
    .map((member) => `<option value="${escapeHtml(member.static_id)}">${escapeHtml(member.full_name)} | ${escapeHtml(member.static_id)}</option>`)
    .join("");

  if (!els.targetSelect.value && state.members[0]) {
    els.targetSelect.value = state.members[0].static_id;
  }

  updateExistingTargetFields();
}

function renderRanks() {
  els.newRankSelect.innerHTML = state.ranks
    .map((rank) => `<option value="${rank.rank_number}">[${rank.rank_number}] ${escapeHtml(rank.rank_name)}</option>`)
    .join("");
}

function renderHistory() {
  const query = state.historySearch.trim().toLowerCase();
  const filtered = state.history.filter((entry) => {
    if (!query) {
      return true;
    }

    const haystack = [
      actionLabels[entry.action_type] || entry.action_type,
      entry.initiator_full_name,
      entry.target_full_name,
      entry.target_static_id,
      entry.reason_text
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });

  els.historyCount.textContent = `${filtered.length} записів`;

  if (filtered.length === 0) {
    els.historyList.innerHTML = `<div class="empty-state">Записи не знайдено.</div>`;
    return;
  }

  els.historyList.innerHTML = filtered
    .map((entry) => {
      const before = entry.previous_rank_name
        ? formatRank(entry.previous_rank_number, entry.previous_rank_name)
        : "Не у фракції";
      const after = entry.new_rank_name
        ? formatRank(entry.new_rank_number, entry.new_rank_name)
        : "—";

      return `
        <article class="history-item">
          <div class="history-top">
            <div class="history-main">${escapeHtml(entry.target_full_name)} | ${escapeHtml(entry.target_static_id)}</div>
            <div class="history-tag">${escapeHtml(actionLabels[entry.action_type] || entry.action_type)}</div>
          </div>
          <div class="history-meta">${escapeHtml(formatDateTime(entry.created_at))} • Ініціатор: ${escapeHtml(entry.initiator_full_name)}</div>
          <div class="history-diff">${escapeHtml(before)} → ${escapeHtml(after)}</div>
          <div class="history-meta">${escapeHtml(entry.reason_text)}</div>
        </article>
      `;
    })
    .join("");
}

function updateExistingTargetFields() {
  const member = getSelectedExistingMember();
  els.targetStaticId.value = member ? member.static_id : "";
  els.targetRank.value = member ? formatRank(member.current_rank_number, member.current_rank_name) : "";
  updateSummary();
}

function updateActionVisibility() {
  const hireMode = isHireAction();
  const fireMode = isFireAction();

  els.existingTargetBlock.classList.toggle("active", !hireMode);
  els.hireTargetBlock.classList.toggle("active", hireMode);
  els.rankFieldBlock.classList.toggle("hidden", fireMode);
}

function updateSummary() {
  if (!state.currentUser) {
    return;
  }

  const actionLabel = actionLabels[state.actionType];
  const reasonText = els.reasonInput.value.trim();

  if (isHireAction()) {
    const fullName = els.hireFullName.value.trim() || "нового працівника";
    const nextRank = state.ranks.find((rank) => String(rank.rank_number) === els.newRankSelect.value);
    const rankLabel = nextRank ? formatRank(nextRank.rank_number, nextRank.rank_name) : "обраний ранг";

    els.summaryText.textContent = `${state.currentUser.full_name} оформить дію "${actionLabel}" для ${fullName} з рангом ${rankLabel}.`;
  } else {
    const member = getSelectedExistingMember();
    const nextRank = state.ranks.find((rank) => String(rank.rank_number) === els.newRankSelect.value);

    if (!member) {
      els.summaryText.textContent = "Оберіть працівника для дії.";
      return;
    }

    const ending = fireModeText(member, nextRank);
    els.summaryText.textContent = `${state.currentUser.full_name} оформить дію "${actionLabel}" для ${member.full_name}${ending}.`;
  }

  if (reasonText) {
    setStatusMessage(`Пояснення: ${reasonText}`);
  } else {
    setStatusMessage("");
  }
}

function fireModeText(member, nextRank) {
  if (state.actionType === "fire") {
    return " зі статусом звільнення";
  }

  if (!nextRank) {
    return "";
  }

  return ` з переходом на ранг ${formatRank(nextRank.rank_number, nextRank.rank_name)}`;
}

function resetAuditForm() {
  state.actionType = "hire";
  [...els.actionGroup.querySelectorAll(".action-pill")].forEach((button) => {
    button.classList.toggle("active", button.dataset.action === state.actionType);
  });

  els.hireFullName.value = "";
  els.hireStaticId.value = "";
  els.reasonInput.value = "";
  if (state.ranks[0]) {
    els.newRankSelect.value = String(state.ranks[0].rank_number);
  }
  if (state.members[0]) {
    els.targetSelect.value = state.members[0].static_id;
  }

  updateActionVisibility();
  updateExistingTargetFields();
  setStatusMessage("");
}

async function handleLogin(event) {
  event.preventDefault();
  const loginCode = els.loginInput.value.trim().toLowerCase();

  if (!loginCode) {
    showLoginError("Введіть логін.");
    return;
  }

  try {
    hideLoginError();
    els.loginButton.disabled = true;
    els.loginButton.textContent = "Вхід...";
    await bootstrapApp(loginCode);
  } catch (error) {
    showLoginError(error instanceof Error ? error.message : "Не вдалося увійти.");
  } finally {
    els.loginButton.disabled = false;
    els.loginButton.textContent = "Увійти";
  }
}

async function bootstrapApp(loginCode) {
  const functionName = config.bootstrapFunctionName || "app-bootstrap";
  const data = await callFunction(functionName, { loginCode });

  state.loginCode = loginCode;
  state.currentUser = data.currentUser;
  state.members = data.members || [];
  state.ranks = data.ranks || [];
  state.history = data.history || [];

  localStorage.setItem(storageKey, loginCode);

  renderCurrentUser();
  renderMembers();
  renderRanks();
  renderHistory();
  resetAuditForm();
  setTopStatus("Профіль підключено");

  els.loginScreen.classList.add("hidden");
  els.appShell.classList.remove("hidden");
}

function logout() {
  localStorage.removeItem(storageKey);
  state.loginCode = "";
  state.currentUser = null;
  state.members = [];
  state.ranks = [];
  state.history = [];
  els.loginInput.value = "";
  els.appShell.classList.add("hidden");
  els.loginScreen.classList.remove("hidden");
  setTopStatus("Готово до роботи");
}

function getSubmitPayload() {
  const reasonText = els.reasonInput.value.trim();

  if (!reasonText) {
    throw new Error("Вкажіть пояснення.");
  }

  if (isHireAction()) {
    const targetFullName = els.hireFullName.value.trim();
    const targetStaticId = els.hireStaticId.value.trim();
    const newRankNumber = Number(els.newRankSelect.value);

    if (!targetFullName || !targetStaticId) {
      throw new Error("Для прийому потрібно вказати ім'я та static id.");
    }

    return {
      initiatorLoginCode: state.loginCode,
      initiatorStaticId: state.currentUser.static_id,
      actionType: state.actionType,
      targetStaticId,
      targetFullName,
      newRankNumber,
      reasonText
    };
  }

  const targetMember = getSelectedExistingMember();

  if (!targetMember) {
    throw new Error("Оберіть працівника.");
  }

  const payload = {
    initiatorLoginCode: state.loginCode,
    initiatorStaticId: state.currentUser.static_id,
    actionType: state.actionType,
    targetStaticId: targetMember.static_id,
    reasonText
  };

  if (!isFireAction()) {
    payload.newRankNumber = Number(els.newRankSelect.value);
  }

  return payload;
}

async function submitAudit() {
  if (!state.currentUser || state.submitting) {
    return;
  }

  try {
    state.submitting = true;
    els.submitButton.disabled = true;
    els.submitButton.textContent = "Відправка...";
    setStatusMessage("");
    setTopStatus("Виконується відправка");

    const functionName = config.submitFunctionName || "submit-audit";
    const payload = getSubmitPayload();
    const result = await callFunction(functionName, payload);

    await bootstrapApp(state.loginCode);

    let message = "Кадрову дію успішно відправлено.";
    if (result.leaderLoginCode) {
      message += ` Новий логін керівника: ${result.leaderLoginCode}`;
    }

    setStatusMessage(message, "success");
    setTopStatus("Остання дія збережена");
  } catch (error) {
    setStatusMessage(error instanceof Error ? error.message : "Не вдалося відправити дію.", "error");
    setTopStatus("Сталася помилка");
  } finally {
    state.submitting = false;
    els.submitButton.disabled = false;
    els.submitButton.textContent = "Відправити";
  }
}

function bindTabs() {
  const navButtons = [...document.querySelectorAll("[data-view-target]")];
  const views = [...document.querySelectorAll("[data-view]")];

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      navButtons.forEach((item) => item.classList.remove("active"));
      views.forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`[data-view="${button.dataset.viewTarget}"]`).classList.add("active");
    });
  });
}

function bindActions() {
  [...els.actionGroup.querySelectorAll(".action-pill")].forEach((button) => {
    button.addEventListener("click", () => {
      [...els.actionGroup.querySelectorAll(".action-pill")].forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.actionType = button.dataset.action;
      updateActionVisibility();
      updateSummary();
    });
  });
}

function init() {
  if (!hasValidConfig()) {
    els.setupNotice.classList.remove("hidden");
    els.loginScreen.classList.add("hidden");
    return;
  }

  bindTabs();
  bindActions();

  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutButton.addEventListener("click", logout);
  els.targetSelect.addEventListener("change", updateExistingTargetFields);
  els.newRankSelect.addEventListener("change", updateSummary);
  els.reasonInput.addEventListener("input", updateSummary);
  els.hireFullName.addEventListener("input", updateSummary);
  els.hireStaticId.addEventListener("input", updateSummary);
  els.historySearch.addEventListener("input", () => {
    state.historySearch = els.historySearch.value;
    renderHistory();
  });
  els.submitButton.addEventListener("click", submitAudit);
  els.resetButton.addEventListener("click", resetAuditForm);

  const savedLogin = localStorage.getItem(storageKey);
  if (savedLogin) {
    els.loginInput.value = savedLogin;
    bootstrapApp(savedLogin).catch(() => {
      localStorage.removeItem(storageKey);
      els.loginInput.value = "";
    });
  }
}

init();
