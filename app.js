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
  targetLookupInput: document.getElementById("targetLookupInput"),
  targetResolvedName: document.getElementById("targetResolvedName"),
  targetStaticId: document.getElementById("targetStaticId"),
  targetRank: document.getElementById("targetRank"),
  hireFullName: document.getElementById("hireFullName"),
  hireStaticId: document.getElementById("hireStaticId"),
  existingTargetBlock: document.getElementById("existingTargetBlock"),
  hireTargetBlock: document.getElementById("hireTargetBlock"),
  actionGroup: document.getElementById("actionGroup"),
  rankPicker: document.getElementById("rankPicker"),
  newRankTrigger: document.getElementById("newRankTrigger"),
  newRankTriggerText: document.getElementById("newRankTriggerText"),
  newRankMenu: document.getElementById("newRankMenu"),
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
  return (
    typeof config.supabaseUrl === "string" &&
    config.supabaseUrl.startsWith("https://") &&
    typeof config.supabasePublishableKey === "string" &&
    config.supabasePublishableKey.length > 20
  );
}

function functionUrl(name) {
  return `${config.supabaseUrl.replace(/\/$/, "")}/functions/v1/${name}`;
}

function restUrl(query) {
  return `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/${query}`;
}

async function apiFetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${config.supabasePublishableKey}`,
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (data && (data.message || data.error || data.msg || data.details)) ||
      "Не вдалося отримати дані із Supabase.";
    throw new Error(message);
  }

  return data;
}

async function restFetchJson(url) {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      apikey: config.supabasePublishableKey
    }
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (data && (data.message || data.error || data.msg || data.details)) ||
      "Не вдалося отримати дані із Supabase.";
    throw new Error(message);
  }

  return data;
}

async function callFunction(name, payload) {
  return apiFetchJson(functionUrl(name), {
    method: "POST",
    body: JSON.stringify(payload)
  });
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
  const lookup = els.targetLookupInput.value.trim();
  return state.members.find((member) => member.static_id === lookup) || null;
}

function getSelectedRankNumber() {
  return Number(els.newRankTrigger.dataset.value || 0);
}

function setSelectedRankNumber(rankNumber) {
  const rank = state.ranks.find((item) => Number(item.rank_number) === Number(rankNumber));
  if (!rank) {
    return;
  }

  els.newRankTrigger.dataset.value = String(rank.rank_number);
  els.newRankTriggerText.textContent = formatRank(rank.rank_number, rank.rank_name);

  [...els.newRankMenu.querySelectorAll(".rank-picker-option")].forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.rankNumber) === Number(rank.rank_number));
  });
}

function closeRankMenu() {
  els.newRankMenu.classList.add("hidden");
  els.newRankTrigger.setAttribute("aria-expanded", "false");
  els.rankPicker.classList.remove("open");
}

function toggleRankMenu() {
  const isOpen = !els.newRankMenu.classList.contains("hidden");
  if (isOpen) {
    closeRankMenu();
    return;
  }

  els.newRankMenu.classList.remove("hidden");
  els.newRankTrigger.setAttribute("aria-expanded", "true");
  els.rankPicker.classList.add("open");
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
  updateExistingTargetFields();
}

function renderRanks() {
  els.newRankMenu.innerHTML = state.ranks
    .map(
      (rank) => `
        <button class="rank-picker-option" type="button" data-rank-number="${rank.rank_number}">
          ${escapeHtml(formatRank(rank.rank_number, rank.rank_name))}
        </button>
      `
    )
    .join("");

  [...els.newRankMenu.querySelectorAll(".rank-picker-option")].forEach((button) => {
    button.addEventListener("click", () => {
      setSelectedRankNumber(Number(button.dataset.rankNumber));
      closeRankMenu();
      updateSummary();
    });
  });

  if (state.ranks[0]) {
    setSelectedRankNumber(state.ranks[0].rank_number);
  }
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
      const after = entry.new_rank_name ? formatRank(entry.new_rank_number, entry.new_rank_name) : "—";

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
  els.targetResolvedName.value = member ? member.full_name : "";
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

function fireModeText(member, nextRank) {
  if (state.actionType === "fire") {
    return " зі статусом звільнення";
  }

  if (!nextRank) {
    return "";
  }

  return ` з переходом на ранг ${formatRank(nextRank.rank_number, nextRank.rank_name)}`;
}

function updateSummary() {
  if (!state.currentUser) {
    return;
  }

  const actionLabel = actionLabels[state.actionType];
  const reasonText = els.reasonInput.value.trim();

  if (isHireAction()) {
    const fullName = els.hireFullName.value.trim() || "нового працівника";
    const nextRank = state.ranks.find((rank) => Number(rank.rank_number) === getSelectedRankNumber());
    const rankLabel = nextRank ? formatRank(nextRank.rank_number, nextRank.rank_name) : "обраний ранг";

    els.summaryText.textContent = `${state.currentUser.full_name} оформить дію "${actionLabel}" для ${fullName} з рангом ${rankLabel}.`;
  } else {
    const member = getSelectedExistingMember();
    const nextRank = state.ranks.find((rank) => Number(rank.rank_number) === getSelectedRankNumber());

    if (!member) {
      els.summaryText.textContent = "Вкажіть правильний static ID працівника для дії.";
      return;
    }

    els.summaryText.textContent = `${state.currentUser.full_name} оформить дію "${actionLabel}" для ${member.full_name}${fireModeText(member, nextRank)}.`;
  }

  if (reasonText) {
    setStatusMessage(`Пояснення: ${reasonText}`);
  } else {
    setStatusMessage("");
  }
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
    setSelectedRankNumber(state.ranks[0].rank_number);
  }

  els.targetLookupInput.value = "";
  els.targetResolvedName.value = "";
  els.targetStaticId.value = "";
  els.targetRank.value = "";

  updateActionVisibility();
  updateExistingTargetFields();
  setStatusMessage("");
  closeRankMenu();
}

async function fetchBootstrapData(loginCode) {
  const encodedLogin = encodeURIComponent(loginCode);

  const currentUserPromise = restFetchJson(
    restUrl(
      `members?select=static_id,full_name,login_code,current_rank_number,current_rank_name,is_leadership,is_active&login_code=eq.${encodedLogin}&is_active=eq.true&is_leadership=eq.true&limit=1`
    )
  );

  const membersPromise = restFetchJson(
    restUrl(
      "members?select=static_id,full_name,current_rank_number,current_rank_name,is_active&is_active=eq.true&order=full_name.asc"
    )
  );

  const ranksPromise = restFetchJson(
    restUrl("ranks?select=rank_number,rank_name,is_active,sort_order&is_active=eq.true&order=rank_number.asc")
  );

  const historyPromise = restFetchJson(
    restUrl(
      "audit_history?select=id,action_type,initiator_full_name,target_full_name,target_static_id,previous_rank_number,previous_rank_name,new_rank_number,new_rank_name,reason_text,created_at&order=created_at.desc&limit=100"
    )
  );

  const [currentUserRows, members, ranks, history] = await Promise.all([
    currentUserPromise,
    membersPromise,
    ranksPromise,
    historyPromise
  ]);

  const currentUser = Array.isArray(currentUserRows) ? currentUserRows[0] : null;

  if (!currentUser) {
    throw new Error("Логін не знайдено або для нього ще не відкрито доступ.");
  }

  return {
    currentUser,
    members: Array.isArray(members) ? members : [],
    ranks: Array.isArray(ranks) ? ranks : [],
    history: Array.isArray(history) ? history : []
  };
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
  const data = await fetchBootstrapData(loginCode);

  state.loginCode = loginCode;
  state.currentUser = data.currentUser;
  state.members = data.members;
  state.ranks = data.ranks;
  state.history = data.history;

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
    const newRankNumber = getSelectedRankNumber();

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
    throw new Error("Вкажіть правильний static ID працівника.");
  }

  const payload = {
    initiatorLoginCode: state.loginCode,
    initiatorStaticId: state.currentUser.static_id,
    actionType: state.actionType,
    targetStaticId: targetMember.static_id,
    reasonText
  };

  if (!isFireAction()) {
    payload.newRankNumber = getSelectedRankNumber();
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
  els.targetLookupInput.addEventListener("input", updateExistingTargetFields);
  els.newRankTrigger.addEventListener("click", toggleRankMenu);
  els.reasonInput.addEventListener("input", updateSummary);
  els.hireFullName.addEventListener("input", updateSummary);
  els.hireStaticId.addEventListener("input", updateSummary);
  els.historySearch.addEventListener("input", () => {
    state.historySearch = els.historySearch.value;
    renderHistory();
  });
  els.submitButton.addEventListener("click", submitAudit);
  els.resetButton.addEventListener("click", resetAuditForm);

  document.addEventListener("click", (event) => {
    if (!els.rankPicker.contains(event.target)) {
      closeRankMenu();
    }
  });

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
