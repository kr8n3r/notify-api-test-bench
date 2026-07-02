import express from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NotifyClient } from "notifications-node-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

const SAVED_TEMPLATES_PATH = path.join(__dirname, "data", "saved-templates.json");
const ENVIRONMENTS_PATH = path.join(__dirname, "data", "environments.json");
const NOTIFY_PRODUCTION_URL = "https://api.notifications.service.gov.uk";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_ENVIRONMENTS = [
  { id: "production", label: "Production", baseUrl: NOTIFY_PRODUCTION_URL, builtIn: true },
  { id: "staging", label: "Staging", baseUrl: "https://staging-notify.works", builtIn: true },
  { id: "local", label: "Local", baseUrl: "http://notify-api.localhost:6011", builtIn: true },
];

// Async Disk Helpers
async function readJson(filePath, fallback = []) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

// Top-level await disk seed
try {
  await fs.access(ENVIRONMENTS_PATH);
} catch {
  await writeJson(ENVIRONMENTS_PATH, DEFAULT_ENVIRONMENTS);
}

const clients = new Map();

function getClient(apiKey, baseUrl) {
  if (!apiKey || typeof apiKey !== "string") {
    throw Object.assign(new Error("Missing API key"), { isClientError: true });
  }
  const effectiveUrl = baseUrl?.trim() ? baseUrl.trim() : NOTIFY_PRODUCTION_URL;
  const cacheKey = `${effectiveUrl}::${apiKey}`;

  if (!clients.has(cacheKey)) {
    clients.set(cacheKey, new NotifyClient(effectiveUrl, apiKey));
  }
  return clients.get(cacheKey);
}

// Modernized Async Request Execution Wrapper
async function handle(req, res, executor) {
  const { apiKey, baseUrl, ...rest } = req.body ?? {};
  let client;

  try {
    client = getClient(apiKey, baseUrl);
  } catch {
    return res.status(401).json({
      ok: false,
      status_code: 401,
      errors: [{ error: "ClientError", message: "Enter an API key first." }],
    });
  }

  const started = Date.now();
  try {
    const response = await executor(client, rest);
    return res.json({
      ok: true,
      status_code: response?.status ?? 200,
      data: response?.data,
      duration_ms: Date.now() - started,
    });
  } catch (err) {
    const duration_ms = Date.now() - started;
    const errPayload = err?.response?.data;

    if (errPayload) {
      return res.status(200).json({
        ok: false,
        status_code: errPayload.status_code ?? err?.response?.status,
        errors: errPayload.errors ?? [{ error: "Error", message: String(err.message || err) }],
        duration_ms,
      });
    }

    return res.status(200).json({
      ok: false,
      status_code: 0,
      errors: [{ error: "NetworkOrClientError", message: err?.message ?? String(err) }],
      duration_ms,
    });
  }
}

// ---------- Environments ----------

app.get("/api/environments", async (req, res) => {
  res.json({ ok: true, environments: await readJson(ENVIRONMENTS_PATH, DEFAULT_ENVIRONMENTS) });
});

app.post("/api/environments", async (req, res) => {
  const { id, label, baseUrl } = req.body ?? {};
  if (!label?.trim()) return res.status(400).json({ ok: false, error: "label is required" });
  if (!baseUrl || !/^https?:\/\/.+/i.test(baseUrl.trim())) {
    return res.status(400).json({ ok: false, error: "baseUrl must be a full http(s) URL" });
  }

  const list = await readJson(ENVIRONMENTS_PATH, DEFAULT_ENVIRONMENTS);
  const cleanUrl = baseUrl.trim().replace(/\/+$/, "");
  const cleanId = id?.trim() || label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const existingIndex = list.findIndex((e) => e.id === cleanId);

  if (existingIndex >= 0 && list[existingIndex].builtIn) {
    return res.status(400).json({ ok: false, error: "Can't overwrite a built-in environment" });
  }

  const entry = { id: cleanId, label: label.trim(), baseUrl: cleanUrl, builtIn: false };
  existingIndex >= 0 ? (list[existingIndex] = entry) : list.push(entry);

  await writeJson(ENVIRONMENTS_PATH, list);
  res.json({ ok: true, environments: list });
});

app.delete("/api/environments/:id", async (req, res) => {
  const list = await readJson(ENVIRONMENTS_PATH, DEFAULT_ENVIRONMENTS);
  if (list.find((e) => e.id === req.params.id)?.builtIn) {
    return res.status(400).json({ ok: false, error: "Can't delete a built-in environment" });
  }
  const filtered = list.filter((e) => e.id !== req.params.id);
  await writeJson(ENVIRONMENTS_PATH, filtered);
  res.json({ ok: true, environments: filtered });
});

// ---------- Saved Templates ----------

app.get("/api/saved-templates", async (req, res) => {
  res.json({ ok: true, templates: await readJson(SAVED_TEMPLATES_PATH) });
});

app.post("/api/saved-templates", async (req, res) => {
  const { id, label, type } = req.body ?? {};
  if (!id || !UUID_RE.test(id.trim())) return res.status(400).json({ ok: false, error: "Invalid UUID" });
  if (!label?.trim()) return res.status(400).json({ ok: false, error: "label is required" });

  const list = await readJson(SAVED_TEMPLATES_PATH);
  const cleanId = id.trim();
  const existingIndex = list.findIndex((t) => t.id === cleanId);
  const entry = { id: cleanId, label: label.trim(), type: type ?? null, savedAt: new Date().toISOString() };

  existingIndex >= 0 ? (list[existingIndex] = entry) : list.push(entry);
  await writeJson(SAVED_TEMPLATES_PATH, list);
  res.json({ ok: true, templates: list });
});

app.delete("/api/saved-templates/:id", async (req, res) => {
  const list = (await readJson(SAVED_TEMPLATES_PATH)).filter((t) => t.id !== req.params.id);
  await writeJson(SAVED_TEMPLATES_PATH, list);
  res.json({ ok: true, templates: list });
});

app.post("/api/lookup-templates", (req, res) => 
  handle(req, res, (client, b) => client.getAllTemplates(b.templateType ?? undefined))
);

// ---------- Methods ----------

app.post("/api/send-sms", (req, res) =>
  handle(req, res, (c, b) => c.sendSms(b.templateId, b.phoneNumber, {
    personalisation: b.personalisation,
    reference: b.reference ?? undefined,
    smsSenderId: b.smsSenderId ?? undefined,
  }))
);

app.post("/api/send-email", (req, res) =>
  handle(req, res, (c, b) => c.sendEmail(b.templateId, b.emailAddress, {
    personalisation: b.personalisation,
    reference: b.reference ?? undefined,
    emailReplyToId: b.emailReplyToId ?? undefined,
    oneClickUnsubscribeURL: b.oneClickUnsubscribeURL ?? undefined,
    sanitiseContentFor: b.sanitiseContentFor ?? undefined,
  }))
);

app.post("/api/send-letter", (req, res) =>
  handle(req, res, (c, b) => c.sendLetter(b.templateId, {
    personalisation: b.personalisation,
    reference: b.reference ?? undefined,
  }))
);

app.post("/api/send-precompiled-letter", upload.single("pdfFile"), async (req, res) => {
  const { apiKey, baseUrl, reference, postage } = req.body ?? {};
  let client;

  try { client = getClient(apiKey, baseUrl); } 
  catch { return res.status(401).json({ ok: false, status_code: 401, errors: [{ error: "ClientError", message: "Enter an API key first." }] }); }

  if (!req.file) return res.json({ ok: false, status_code: 400, errors: [{ error: "ValidationError", message: "pdfFile is required" }] });

  const started = Date.now();
  try {
    const response = await client.sendPrecompiledLetter(reference, req.file.buffer, postage ?? undefined);
    res.json({ ok: true, status_code: response.status ?? 200, data: response.data, duration_ms: Date.now() - started });
  } catch (err) {
    const duration_ms = Date.now() - started;
    res.json({
      ok: false,
      status_code: err?.response?.data?.status_code ?? 0,
      errors: err?.response?.data?.errors ?? [{ error: "Error", message: err.message }],
      duration_ms
    });
  }
});

app.post("/api/get-notification-by-id", (req, res) => handle(req, res, (c, b) => c.getNotificationById(b.notificationId)));
app.post("/api/get-notifications", (req, res) => handle(req, res, (c, b) => c.getNotifications(b.templateType, b.status, b.reference, b.olderThan)));

app.post("/api/get-pdf-for-letter", async (req, res) => {
  const { apiKey, baseUrl, notificationId } = req.body ?? {};
  try {
    const client = getClient(apiKey, baseUrl);
    const started = Date.now();
    const buffer = await client.getPdfForLetterNotification(notificationId);
    res.json({
      ok: true, status_code: 200, duration_ms: Date.now() - started,
      data: { byte_length: buffer.length, base64_preview: `${buffer.toString("base64").slice(0, 200)}...` }
    });
  } catch (err) {
    res.json({ ok: false, status_code: err?.response?.status ?? 0, errors: [{ message: err.message }] });
  }
});

app.post("/api/get-template-by-id", (req, res) => handle(req, res, (c, b) => c.getTemplateById(b.templateId)));
app.post("/api/get-template-by-id-and-version", (req, res) => handle(req, res, (c, b) => c.getTemplateByIdAndVersion(b.templateId, b.version)));
app.post("/api/get-all-templates", (req, res) => handle(req, res, (c, b) => c.getAllTemplates(b.templateType)));
app.post("/api/preview-template", (req, res) => handle(req, res, (c, b) => c.previewTemplateById(b.templateId, b.personalisation)));
app.post("/api/get-received-texts", (req, res) => handle(req, res, (c, b) => c.getReceivedTexts(b.olderThan)));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Notify API test bench running on http://localhost:${PORT}`));