# Notify API Bench

A small local web app for exercising every method in [GOV.UK Notify's Node.js client](https://docs.notifications.service.gov.uk/node.html) — sending texts, emails, and letters, looking up notification/template data, and fetching received texts — with the raw request and response visible for each call.

## Setup

```
npm install
npm start
```

Then open `http://localhost:3000`.

## Use

1. Paste an API key (test, team-and-guest-list, or live — [from your service's API integration page](https://www.notifications.service.gov.uk/sign-in)) into the field top-right. It's only ever sent to your local server, per-request, and never written to disk.
2. Pick a method from the left-hand list.
3. Fill in the form. Required fields are marked; "Fill smoke-test values" auto-fills smoke-test-safe values where available (see [Notify's smoke testing numbers/addresses](https://docs.notifications.service.gov.uk/node.html#smoke-testing)).
4. Send the request. The right-hand panel shows the parsed response (or error) and, on the second tab, exactly what was sent (your key is masked).

### Switching environments

The **Environment** dropdown in the top bar controls which Notify host requests are sent to. Three are built in:

| Environment | Base URL |
|---|---|
| Production | `https://api.notifications.service.gov.uk` |
| Staging | `https://staging-notify.works` |
| Local | `http://notify-api.localhost:6011` |

The colored pill next to the dropdown is a quick visual check of which one is active (green = production, amber = staging, purple = local).

Click **+ cog** to add your own (e.g. a different local port, a personal sandbox deployment). Built-in environments can't be edited or removed; custom ones can be deleted from the same panel. The list is stored in `data/environments.json` — also fine to commit, since base URLs aren't secret.

Note that the same API key is sent to whichever host is selected, so make sure the key you've pasted actually belongs to that environment (a production key won't authenticate against staging or a local instance, and vice versa).

### Reusing template IDs

Every `templateId` field has **browse** and **save** buttons next to it instead of a bare text box:

- **browse** opens a dropdown with two sections: your **saved** templates (labelled, stored locally in `data/saved-templates.json`) and the **live** list pulled straight from Notify for whichever key is currently entered. Click any row to fill the field.
- **save** stores whatever ID is currently in the box under a label you choose, so it shows up in the saved section next time — across methods and sessions. Use the **×** next to a saved entry to remove it.
- The live list is cached per key for the session; use **↻ refresh list** in the dropdown if you've added a template in Notify and want it to show up without re-entering the key.

Saved template IDs aren't secret, so `data/saved-templates.json` is fine to keep in the repo if you want your list to travel with the project.

## Notes

- All 11 documented methods are wired up: `sendSms`, `sendEmail`, `sendLetter`, `sendPrecompiledLetter`, `getNotificationById`, `getNotifications`, `getPdfForLetterNotification`, `getTemplateById`, `getTemplateByIdAndVersion`, `getAllTemplates`, `previewTemplateById`, `getReceivedTexts`.
- `getPdfForLetterNotification` normally resolves a raw PDF `Buffer`. Since this tool speaks JSON, the response shown is the buffer's byte length plus a short base64 preview rather than a rendered PDF.
- There is no Notify sandbox environment — all testing happens against the real production API (per Notify's own docs), so use a **test** API key and the documented smoke-test numbers/addresses/simulator addresses to avoid sending real messages while exploring.
- Errors are shown using Notify's real error shape (`status_code` + `errors[]`) wherever the SDK provides one.
