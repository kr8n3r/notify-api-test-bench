import { NOTIFY_METHODS } from "./methods.js";

const nav = document.getElementById("methodNav");
const form = document.getElementById("methodForm");
const titleEl = document.getElementById("methodTitle");
const descEl = document.getElementById("methodDesc");
const resultBody = document.getElementById("resultBody");
const sendBtn = document.getElementById("sendBtn");
const fillSmokeBtn = document.getElementById("fillSmokeBtn");
const apiKeyInput = document.getElementById("apiKey");
const keyStatus = document.getElementById("keyStatus");
const toggleKeyBtn = document.getElementById("toggleKeyVisibility");
const resultTabs = document.querySelectorAll(".result-tab");
const envSelect = document.getElementById("envSelect");
const envPill = document.getElementById("envPill");
const manageEnvBtn = document.getElementById("manageEnvBtn");
const envManager = document.getElementById("envManager");
const envList = document.getElementById("envList");
const closeEnvManagerBtn = document.getElementById("closeEnvManagerBtn");
const newEnvLabel = document.getElementById("newEnvLabel");
const newEnvUrl = document.getElementById("newEnvUrl");
const newEnvAddBtn = document.getElementById("newEnvAddBtn");

const DEFAULT_ENVIRONMENTS_FALLBACK = [
  { id: "production", label: "Production", baseUrl: "https://api.notifications.service.gov.uk", builtIn: true },
  { id: "staging", label: "Staging", baseUrl: "https://api.staging-notify.works", builtIn: true },
  { id: "local", label: "Local", baseUrl: "http://notify-api.localhost:6011", builtIn: true },
];

const UUID_RE_CLIENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let currentMethod = NOTIFY_METHODS[0];
let lastRequestSnapshot = null;
let lastResponseSnapshot = null;
let activeTab = "response";
let environments = [];
let selectedEnvId = "production";
let savedTemplatesCache = [];
let liveTemplatesCache = null;

apiKeyInput.addEventListener("input", () => {
  const has = apiKeyInput.value.trim().length > 0;
  keyStatus.textContent = has ? "set" : "not set";
  keyStatus.classList.toggle("set", has);
});

toggleKeyBtn.addEventListener("click", () => {
  const showing = apiKeyInput.type === "text";
  apiKeyInput.type = showing ? "password" : "text";
  toggleKeyBtn.textContent = showing ? "show" : "hide";
});

function currentEnv() {
  return environments.find((e) => e.id === selectedEnvId) ?? environments[0] ?? DEFAULT_ENVIRONMENTS_FALLBACK[0];
}

function pillClassFor(id) {
  const map = { production: "env-production", staging: "env-staging", local: "env-local" };
  return map[id] ?? "env-custom";
}

function renderEnvSelect() {
  envSelect.innerHTML = environments.map(e => `<option value="${e.id}">${escapeHtml(e.label)}</option>`).join("");
  envSelect.value = selectedEnvId;
  updateEnvPill();
}

function updateEnvPill() {
  const env = currentEnv();
  envPill.className = `env-pill ${pillClassFor(env.id)}`;
  envPill.textContent = env.id === "production" ? "PROD" : env.label.slice(0, 8);
  envPill.title = env.baseUrl;
}

envSelect.addEventListener("change", () => {
  selectedEnvId = envSelect.value;
  updateEnvPill();
  liveTemplatesCache = null;
});

async function loadEnvironments() {
  try {
    const res = await fetch("/api/environments");
    const json = await res.json();
    environments = json.ok ? json.environments : DEFAULT_ENVIRONMENTS_FALLBACK;
  } catch {
    environments = DEFAULT_ENVIRONMENTS_FALLBACK;
  }
  if (!environments.some((e) => e.id === selectedEnvId)) {
    selectedEnvId = environments[0]?.id ?? "production";
  }
  renderEnvSelect();
}

manageEnvBtn.addEventListener("click", () => {
  envManager.hidden = false;
  renderEnvManagerList();
  newEnvLabel.value = "";
  newEnvUrl.value = "";
});

closeEnvManagerBtn.addEventListener("click", () => {
  envManager.hidden = true;
});

envManager.querySelector(".modal__backdrop").addEventListener("click", () => {
  envManager.hidden = true;
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !envManager.hidden) envManager.hidden = true;
});

function renderEnvManagerList() {
  envList.innerHTML = "";
  environments.forEach((e) => {
    const row = document.createElement("div");
    row.className = "env-list-row";
    row.innerHTML = `
      <span class="env-list-label">${escapeHtml(e.label)}</span>
      <span class="env-list-url">${escapeHtml(e.baseUrl)}</span>
    `;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "env-list-remove";
    removeBtn.textContent = "×";
    removeBtn.disabled = !!e.builtIn;
    removeBtn.addEventListener("click", async () => {
      const res = await fetch(`/api/environments/${encodeURIComponent(e.id)}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        environments = json.environments;
        if (selectedEnvId === e.id) selectedEnvId = "production";
        renderEnvSelect();
        renderEnvManagerList();
      }
    });
    row.appendChild(removeBtn);
    envList.appendChild(row);
  });
}

newEnvAddBtn.addEventListener("click", async () => {
  const label = newEnvLabel.value.trim();
  const baseUrl = newEnvUrl.value.trim();
  if (!label || !baseUrl) return;

  const res = await fetch("/api/environments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, baseUrl }),
  });
  const json = await res.json();
  if (json.ok) {
    environments = json.environments;
    renderEnvSelect();
    renderEnvManagerList();
    newEnvLabel.value = "";
    newEnvUrl.value = "";
  } else {
    newEnvUrl.placeholder = json.error ?? "Error adding environment";
  }
});

// ---------- Navigation & Form Rendering ----------

function renderNav() {
  nav.innerHTML = "";
  let lastGroup = null;

  NOTIFY_METHODS.forEach((m) => {
    if (m.group !== lastGroup) {
      const label = document.createElement("div");
      label.className = "nav-group-label";
      label.textContent = m.group;
      nav.appendChild(label);
      lastGroup = m.group;
    }
    const btn = document.createElement("button");
    btn.className = `nav-item${m.id === currentMethod.id ? " active" : ""}`;
    btn.textContent = m.title;
    btn.addEventListener("click", () => {
      currentMethod = m;
      renderNav();
      renderForm();
      resetResult();
    });
    nav.appendChild(btn);
  });
}

function renderForm() {
  titleEl.textContent = currentMethod.title;
  descEl.innerHTML = `Calls <code>${currentMethod.code}</code>${currentMethod.note ? `<span class="method-header__note">${escapeHtml(currentMethod.note)}</span>` : ""}`;
  form.innerHTML = "";
  form.enctype = currentMethod.isMultipart ? "multipart/form-data" : "";

  currentMethod.fields.forEach((field) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.innerHTML = `
      <label for="f_${field.name}">
        <span>${escapeHtml(field.label)}</span>
        <span class="${field.required ? "req-tag" : "opt-tag"}">${field.required ? "required" : "optional"}</span>
      </label>
    `;

    if (field.type === "personalisation") {
      wrap.appendChild(buildPersonalisationField(field));
    } else if (field.name === "templateId") {
      wrap.appendChild(buildTemplateIdField(field));
    } else if (field.type === "select") {
      const select = document.createElement("select");
      select.id = `f_${field.name}`;
      select.name = field.name;
      select.innerHTML = field.options.map(opt => `<option value="${opt}">${opt === "" ? "— none —" : opt}</option>`).join("");
      wrap.appendChild(select);
    } else {
      const input = document.createElement("input");
      input.type = field.type === "file" ? "file" : field.type === "number" ? "number" : "text";
      input.id = `f_${field.name}`;
      input.name = field.name;
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.accept) input.accept = field.accept;
      wrap.appendChild(input);
    }

    if (field.hint) wrap.innerHTML += `<p class="hint">${escapeHtml(field.hint)}</p>`;
    form.appendChild(wrap);
  });
}

function resetResult() {
  lastRequestSnapshot = null;
  lastResponseSnapshot = null;
  activeTab = "response";
  resultTabs.forEach(t => t.classList.toggle("active", t.dataset.tab === "response"));
  resultBody.innerHTML = `<div class="empty-state"><p>No request sent yet.</p></div>`;
}

async function fetchSavedTemplates() {
  try {
    const res = await fetch("/api/saved-templates");
    savedTemplatesCache = (await res.json()).templates ?? [];
  } catch { savedTemplatesCache = []; }
}

async function fetchLiveTemplates(force = false) {
  if (liveTemplatesCache && !force) return liveTemplatesCache;
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) return (liveTemplatesCache = { ok: false, reason: "no-key" });

  try {
    const res = await fetch("/api/lookup-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, baseUrl: currentEnv().baseUrl }),
    });
    const json = await res.json();
    liveTemplatesCache = json.ok ? { ok: true, templates: json.data?.templates ?? [] } : { ok: false, reason: "api-error" };
  } catch { liveTemplatesCache = { ok: false, reason: "network-error" }; }
  return liveTemplatesCache;
}

apiKeyInput.addEventListener("change", () => { liveTemplatesCache = null; });

function buildTemplateIdField(field) {
  const wrap = document.createElement("div");
  wrap.className = "template-picker";
  wrap.innerHTML = `
    <div class="template-picker-row">
      <input type="text" id="f_${field.name}" name="${field.name}" placeholder="${field.placeholder ?? ""}" autocomplete="off" />
      <button type="button" class="btn btn--secondary picker-btn browse-action">browse</button>
      <button type="button" class="btn btn--primary picker-btn save-action">☆ save</button>
    </div>
    <div class="template-panel"></div>
    <div class="template-save-form">
      <input type="text" class="save-label-input" placeholder="Label, e.g. Appointment reminder SMS" />
      <button type="button" class="btn btn--primary save-confirm-btn">Save</button>
      <button type="button" class="btn btn--secondary save-cancel-btn">Cancel</button>
    </div>
  `;

  const input = wrap.querySelector("input");
  const panel = wrap.querySelector(".template-panel");
  const saveForm = wrap.querySelector(".template-save-form");

  wrap.querySelector(".browse-action").addEventListener("click", async () => {
    // Toggle via classList
    if (panel.classList.contains("template-panel--open")) {
        panel.classList.remove("template-panel--open");
        return;
    }
    panel.classList.add("template-panel--open");
    panel.innerHTML = `<p class="picker-loading">Loading templates…</p>`;

    await fetchSavedTemplates();
    const live = await fetchLiveTemplates();

    panel.innerHTML = `<div class="picker-heading">Saved</div>`;
    if (!savedTemplatesCache.length) panel.innerHTML += `<p class="picker-empty">No saved templates yet.</p>`;
    
    savedTemplatesCache.forEach(t => {
      const row = document.createElement("div");
      row.className = "picker-row";
      row.innerHTML = `<button type="button" class="picker-row-main"><span class="picker-row-label">${escapeHtml(t.name)}</span><span class="picker-row-type">${t.type}</span><span class="picker-row-id">${t.id}</span></button>`;
      row.querySelector("button").onclick = () => { input.value = t.id; panel.classList.remove("template-panel--open"); };
      panel.appendChild(row);
    });

    panel.innerHTML += `<div class="picker-heading">From Notify</div>`;
    if (live.ok && live.templates.length) {
      live.templates.forEach(t => {
        console.log('t',t)
        const row = document.createElement("div");
        row.className = "picker-row";
        row.innerHTML = `<button type="button" class="picker-row-main"><span class="picker-row-label">${escapeHtml(t.name)}</span><span class="picker-row-type">${t.type}</span><span class="picker-row-id">${t.id}</span></button>`;
        row.querySelector("button").onclick = () => { input.value = t.id; panel.classList.remove("template-panel--open"); };
        panel.appendChild(row);
      });
    } else {
      panel.innerHTML += `<p class="picker-empty">${live.reason === "no-key" ? "Enter an API key above to browse live templates." : "Could not fetch templates."}</p>`;
    }
  });

  wrap.querySelector(".save-action").addEventListener("click", () => {
    if (!UUID_RE_CLIENT.test(input.value.trim())) return alert("Enter a valid template UUID first.");
    saveForm.classList.add("template-save-form--open");
    panel.classList.remove("template-panel--open");
  });

  saveForm.querySelector(".save-cancel-btn").onclick = () => { saveForm.classList.remove("template-save-form--open"); };
  saveForm.querySelector(".save-confirm-btn").onclick = async () => {
    const label = saveForm.querySelector(".save-label-input").value.trim();
    if (!label) return;
    await fetch("/api/saved-templates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: input.value.trim(), label })
    });
    saveForm.classList.remove("template-save-form--open");
  };

  return wrap;
}

function buildPersonalisationField(field) {
  const container = document.createElement("div");
  container.className = "kv-list";
  container.dataset.fieldName = field.name;
  container.innerHTML = `<div class="kv-rows"></div><button type="button" class="kv-add">+ Add field</button>`;
  
  const rowsHolder = container.querySelector(".kv-rows");

  const addRow = (k = "", v = "") => {
    const row = document.createElement("div");
    row.className = "kv-row";
    row.innerHTML = `
      <input type="text" placeholder="key" value="${escapeHtml(k)}" class="kv-key" />
      <input type="text" placeholder="value" value="${escapeHtml(v)}" class="kv-value" />
      <button type="button" class="kv-remove">×</button>
    `;
    row.querySelector(".kv-remove").onclick = () => row.remove();
    rowsHolder.appendChild(row);
  };

  (field.defaultPairs ?? [["", ""]]).forEach(([k, v]) => addRow(k, v));
  container.querySelector(".kv-add").onclick = () => addRow();

  container.collectValue = () => {
    const out = {};
    rowsHolder.querySelectorAll(".kv-row").forEach(row => {
      const k = row.querySelector(".kv-key").value.trim();
      const v = row.querySelector(".kv-value").value;
      if (k) out[k] = v.includes("\n") ? v.split("\n").filter(Boolean) : v;
    });
    return out;
  };

  return container;
}

// ---------- Submission & Output ----------

fillSmokeBtn.addEventListener("click", () => {
  Object.entries(currentMethod.smokeFill ?? {}).forEach(([k, v]) => {
    const el = document.getElementById(`f_${k}`);
    if (el) el.value = v;
  });
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const apiKey = apiKeyInput.value.trim();
  const baseUrl = currentEnv().baseUrl;

  setLoading(true);
  try {
    let res, bodyOrForm;

    if (currentMethod.isMultipart) {
      bodyOrForm = new FormData();
      bodyOrForm.append("apiKey", apiKey);
      bodyOrForm.append("baseUrl", baseUrl);
      const snapshot = { apiKey: maskApiKey(apiKey), baseUrl };
      currentMethod.fields.forEach(f => {
        const el = document.getElementById(`f_${f.name}`);
        if (f.type === "file") {
          const file = el?.files?.[0];
          if (file) {
            bodyOrForm.append(f.name, file);
            snapshot[f.name] = `<file: ${file.name}>`;
          }
        } else if (el && el.value !== "") {
          bodyOrForm.append(f.name, el.value);
          snapshot[f.name] = el.value;
        }
      });
      lastRequestSnapshot = snapshot;
      res = await fetch(currentMethod.endpoint, { method: "POST", body: bodyOrForm });
    } else {
      const payload = { apiKey, baseUrl };
      const snapshotPayload = { apiKey: maskApiKey(apiKey), baseUrl };
      currentMethod.fields.forEach(f => {
        if (f.type === "personalisation") {
          const val = form.querySelector(`[data-field-name="${f.name}"]`).collectValue();
          if (Object.keys(val).length) {
            payload[f.name] = val;
            snapshotPayload[f.name] = val;
          }
          return;
        }
        const el = document.getElementById(`f_${f.name}`);
        if (el.value === "") return;
        const value = f.type === "number" ? Number(el.value) : f.transform === "csv" ? el.value.split(",").map(s=>s.trim()).filter(Boolean) : el.value;
        payload[f.name] = value;
        snapshotPayload[f.name] = value;
      });
      lastRequestSnapshot = snapshotPayload;
      res = await fetch(currentMethod.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }

    lastResponseSnapshot = await res.json();
    activateTab("response");
    renderResult(lastResponseSnapshot);
  } catch (err) {
    renderResult({ ok: false, status_code: 0, errors: [{ message: err.message }] });
  } finally { setLoading(false); }
});

function activateTab(tab) {
  activeTab = tab;
  resultTabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  renderActiveTab();
}

resultTabs.forEach(t => t.addEventListener("click", () => activateTab(t.dataset.tab)));

function renderActiveTab() {
  if (activeTab === "request") {
    resultBody.innerHTML = `<pre class="json-block">${syntaxHighlight(lastRequestSnapshot ?? { note: "No request sent" })}</pre>`;
  } else {
    renderResult(lastResponseSnapshot ?? null);
  }
}

function renderResult(json) {
  if (!json) return (resultBody.innerHTML = `<div class="empty-state"><p>No request sent yet.</p></div>`);
  const ok = json.ok;
  
  resultBody.innerHTML = `
    <div class="result-meta">
      <span class="status-pill ${ok ? "ok" : "err"}">${ok ? "SUCCESS" : "ERROR"} · ${json.status_code ?? 0}</span>
      ${json.duration_ms ? `<span class="duration-pill">${json.duration_ms}ms</span>` : ""}
    </div>
    <pre class="json-block">${syntaxHighlight(ok ? json.data : { errors: json.errors })}</pre>
  `;

  const stamp = document.getElementById("stampTemplate").content.cloneNode(true).querySelector(".stamp");
  stamp.classList.add(ok ? "ok" : "err");
  stamp.querySelector(".stamp__code").textContent = json.status_code ?? "ERR";
  stamp.querySelector(".stamp__label").textContent = ok ? "delivered" : "rejected";
  resultBody.appendChild(stamp);
}

function setLoading(isLoading) {
  sendBtn.disabled = isLoading;
  const spinner = sendBtn.querySelector(".btn-spinner");
  spinner.classList.toggle("btn-spinner--visible", isLoading);
  sendBtn.querySelector(".btn-label").textContent = isLoading ? "Sending…" : "Send request";
}

function syntaxHighlight(obj) {
  return JSON.stringify(obj, null, 2)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?)/g, match => {
      let cls = "json-number";
      if (/^"/.test(match)) cls = /:$/.test(match) ? "json-key" : "json-string";
      else if (/true|false/.test(match)) cls = "json-boolean";
      else if (/null/.test(match)) cls = "json-null";
      return `<span class="${cls}">${match}</span>`;
    });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function maskApiKey(key) {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}${"•".repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`;
}

document.addEventListener("click", (e) => {
  document.querySelectorAll(".template-panel--open").forEach(p => {
    if (!p.closest(".template-picker")?.contains(e.target)) p.classList.remove("template-panel--open");
  });
});

renderNav();
renderForm();
loadEnvironments();