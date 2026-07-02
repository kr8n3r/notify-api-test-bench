// Each method describes its own form fields so app.js can render + validate generically.
// field.type: text | textarea | number | select | personalisation | file
export const NOTIFY_METHODS = [
  {
    group: "Send a message",
    id: "send-sms",
    title: "Send a text message",
    code: "notifyClient.sendSms()",
    endpoint: "/api/send-sms",
    smokeFill: { phoneNumber: "07700900000", templateId: "" , reference: "smoke-test-sms" },
    fields: [
      { name: "templateId", label: "Template ID", type: "text", required: true, placeholder: "f33517ff-2a88-4f6e-b855-c550268ce08a" },
      { name: "phoneNumber", label: "Phone number", type: "text", required: true, placeholder: "+447900900123" },
      { name: "personalisation", label: "Personalisation", type: "personalisation", required: false },
      { name: "reference", label: "Reference", type: "text", required: false, placeholder: "your reference" },
      { name: "smsSenderId", label: "SMS sender ID", type: "text", required: false, placeholder: "8e222534-7f05-4972-86e3-17c5d9f894e2" },
    ],
  },
  {
    group: "Send a message",
    id: "send-email",
    title: "Send an email",
    code: "notifyClient.sendEmail()",
    endpoint: "/api/send-email",
    smokeFill: { emailAddress: "simulate-delivered@notifications.service.gov.uk", templateId: "", reference: "smoke-test-email" },
    fields: [
      { name: "templateId", label: "Template ID", type: "text", required: true, placeholder: "9d751e0e-f929-4891-82a1-a3e1c3c18ee3" },
      { name: "emailAddress", label: "Email address", type: "text", required: true, placeholder: "amala@example.com" },
      { name: "personalisation", label: "Personalisation", type: "personalisation", required: false },
      { name: "reference", label: "Reference", type: "text", required: false, placeholder: "your reference" },
      { name: "emailReplyToId", label: "Email reply-to ID", type: "text", required: false, placeholder: "ca4fdde7-2a67-4a6c-8393-62aa7245751f" },
      { name: "oneClickUnsubscribeURL", label: "One-click unsubscribe URL", type: "text", required: false, placeholder: "https://example.com/unsubscribe.html?opaque=123456789" },
      { name: "sanitiseContentFor", label: "Sanitise content for (comma-separated keys)", type: "text", required: false, placeholder: "name, comment" , transform: "csv"},
    ],
  },
  {
    group: "Send a message",
    id: "send-letter",
    title: "Send a letter",
    code: "notifyClient.sendLetter()",
    endpoint: "/api/send-letter",
    note: "Your service must be live to send letters; trial-mode services will get a BadRequestError back, which is still a useful response to see here.",
    fields: [
      { name: "templateId", label: "Template ID", type: "text", required: true, placeholder: "64415853-cb86-4cc4-b597-2aaa94ef8c39" },
      { name: "personalisation", label: "Personalisation (must include address_line_1, address_line_2, and a final line that's a postcode or country)", type: "personalisation", required: true, defaultPairs: [
        ["address_line_1", "Amala Bird"],
        ["address_line_2", "123 High Street"],
        ["address_line_3", "Richmond upon Thames"],
        ["address_line_4", "SW14 6BF"],
      ] },
      { name: "reference", label: "Reference", type: "text", required: false, placeholder: "your_reference_here" },
    ],
  },
  {
    group: "Send a message",
    id: "send-precompiled-letter",
    title: "Send a precompiled letter",
    code: "notifyClient.sendPrecompiledLetter()",
    endpoint: "/api/send-precompiled-letter",
    isMultipart: true,
    note: "The PDF must meet the Notify letter specification. Max 5MB here (Notify's own limit).",
    fields: [
      { name: "reference", label: "Reference", type: "text", required: true, placeholder: "your reference" },
      { name: "pdfFile", label: "PDF file", type: "file", required: true, accept: ".pdf" },
      { name: "postage", label: "Postage", type: "select", required: false, options: ["", "first", "second", "economy"] },
    ],
  },

  // ---------- Get message data ----------
  {
    group: "Get message data",
    id: "get-notification-by-id",
    title: "Get the data for one message",
    code: "notifyClient.getNotificationById()",
    endpoint: "/api/get-notification-by-id",
    fields: [
      { name: "notificationId", label: "Notification ID", type: "text", required: true, placeholder: "740e5834-3a29-46b4-9a6f-16142fde533a" },
    ],
  },
  {
    group: "Get message data",
    id: "get-notifications",
    title: "Get the data for multiple messages",
    code: "notifyClient.getNotifications()",
    endpoint: "/api/get-notifications",
    fields: [
      { name: "templateType", label: "Template type", type: "select", required: false, options: ["", "sms", "email", "letter"] },
      { name: "status", label: "Status", type: "select", required: false, options: ["", "cancelled", "created", "sending", "sent", "delivered", "pending", "failed", "technical-failure", "temporary-failure", "permanent-failure", "pending-virus-check", "validation-failed", "virus-scan-failed", "returned-letter", "accepted", "received"] },
      { name: "reference", label: "Reference", type: "text", required: false, placeholder: "your_reference_here" },
      { name: "olderThan", label: "Older than (notification ID)", type: "text", required: false, placeholder: "8e222534-7f05-4972-86e3-17c5d9f894e2" },
    ],
  },
  {
    group: "Get message data",
    id: "get-pdf-for-letter",
    title: "Get a PDF for a letter notification",
    code: "notifyClient.getPdfForLetterNotification()",
    endpoint: "/api/get-pdf-for-letter",
    note: "The real SDK resolves a raw PDF Buffer. Since this is a JSON tester, the response below shows the buffer's byte length and a base64 preview rather than rendering the PDF itself.",
    fields: [
      { name: "notificationId", label: "Notification ID", type: "text", required: true, placeholder: "3d1ce039-5476-414c-99b2-fac1e6add62c" },
    ],
  },

  // ---------- Get a template ----------
  {
    group: "Get a template",
    id: "get-template-by-id",
    title: "Get a template by ID",
    code: "notifyClient.getTemplateById()",
    endpoint: "/api/get-template-by-id",
    fields: [
      { name: "templateId", label: "Template ID", type: "text", required: true, placeholder: "f33517ff-2a88-4f6e-b855-c550268ce08a" },
    ],
  },
  {
    group: "Get a template",
    id: "get-template-by-id-and-version",
    title: "Get a template by ID and version",
    code: "notifyClient.getTemplateByIdAndVersion()",
    endpoint: "/api/get-template-by-id-and-version",
    fields: [
      { name: "templateId", label: "Template ID", type: "text", required: true, placeholder: "f33517ff-2a88-4f6e-b855-c550268ce08a" },
      { name: "version", label: "Version", type: "number", required: true, placeholder: "1" },
    ],
  },
  {
    group: "Get a template",
    id: "get-all-templates",
    title: "Get all templates",
    code: "notifyClient.getAllTemplates()",
    endpoint: "/api/get-all-templates",
    fields: [
      { name: "templateType", label: "Template type", type: "select", required: false, options: ["", "sms", "email", "letter"] },
    ],
  },
  {
    group: "Get a template",
    id: "preview-template",
    title: "Generate a preview template",
    code: "notifyClient.previewTemplateById()",
    endpoint: "/api/preview-template",
    fields: [
      { name: "templateId", label: "Template ID", type: "text", required: true, placeholder: "f33517ff-2a88-4f6e-b855-c550268ce08a" },
      { name: "personalisation", label: "Personalisation", type: "personalisation", required: false },
    ],
  },

  // ---------- Received text messages ----------
  {
    group: "Received text messages",
    id: "get-received-texts",
    title: "Get a page of received text messages",
    code: "notifyClient.getReceivedTexts()",
    endpoint: "/api/get-received-texts",
    fields: [
      { name: "olderThan", label: "Older than (message ID)", type: "text", required: false, placeholder: "740e5834-3a29-46b4-9a6f-16142fde533a" },
    ],
  },
];

const SMOKE_TEST_PHONES = ["07700900000", "07700900111", "07700900222"];
const SMOKE_TEST_EMAILS = [
  "simulate-delivered@notifications.service.gov.uk",
  "simulate-delivered-2@notifications.service.gov.uk",
  "simulate-delivered-3@notifications.service.gov.uk",
];
