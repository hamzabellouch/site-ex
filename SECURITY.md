# Security Policy

## Supported Versions

The following versions of **Site Extractor** are currently supported with security and stability updates.

| Version | Supported |
| -------- | --------- |
| 1.0.x (latest release) | ✅ |
| < 1.0.0 | ❌ |

---

## Reporting a Vulnerability

If you discover a security vulnerability, privacy issue, or any behavior that could negatively impact users or **Site Extractor**, please report it responsibly.

### Before Reporting

Please ensure that:

- The issue is reproducible.
- You are using the latest supported version of **Site Extractor**.
- The issue is not caused by modified builds, unsupported browsers, or conflicting third-party extensions.

### How to Report

You can report vulnerabilities through:

- **GitHub Issues** (for non-sensitive bug reports or general questions)
- **Private Email:** `hamzabellouchcontact@gmail.com` (for sensitive vulnerabilities, security disclosures, or exploit details)

When submitting a report, please include:

- Browser name and version (e.g., Chrome 129, Firefox 131)
- Operating system and version
- Site Extractor version (e.g., v1.0.0)
- Steps to reproduce the issue
- Target webpage URL or sample HTML/DOM structure (if applicable)
- Screenshots, logs, or console errors (if available)
- A clear description of the potential impact

### Response Policy

Security reports are reviewed as quickly as possible.

If a report is confirmed:

- The vulnerability will be investigated and resolved promptly.
- A fix will be included in the next release.
- Credit may be given to the reporter upon request.

If a report cannot be reproduced, lacks sufficient information, or is determined not to be a security issue, it may be closed without further action.

---

## Security Notes

**Site Extractor** runs locally within your browser to crawl webpages, inspect DOM trees, capture live web assets, and extract web components. Depending on its features and configuration, it interacts with browser extension APIs and target web pages.

### Architectural Safeguards

- **Sandboxed Execution:** Interactive element previews execute inside a dedicated sandboxed page (`preview.html`) declared under `sandbox.pages` in Manifest V3. This environment strips all extension APIs and elevated privileges, safeguarding against untrusted scripts attempting privilege escalation.
- **Local Processing:** All crawling, CSS computation, script extraction, and ZIP compression occur entirely on the client side. No extracted data, source code, or telemetry is sent to any external server.
- **Tracker & Telemetry Filtration:** The crawling engine automatically excludes known tracking, telemetry, and advertising domains (such as Google Analytics, DoubleClick, Facebook, Hotjar, Sentry, Segment) to prevent data collection and keep archives clean.
- **Permissions Model:** The extension requests only necessary permissions:
  - `activeTab` & `scripting`: Injects the on-page toolbar and element picker overlay on demand.
  - `storage` & `unlimitedStorage`: Saves picked element bundles and metadata locally in browser storage.
  - `<all_urls>`: Fetches stylesheets, fonts, and assets cross-origin during site crawling and offline bundling.

### User Recommendations

To help maintain a secure experience, users are encouraged to:

- Keep **Site Extractor** updated to the latest version.
- Install the extension only from official sources.
- Review the permissions requested by the extension before installation.
- Avoid installing modified or unofficial builds.
- Be cautious when capturing pages or sites that contain sensitive personal data, credentials, or confidential sessions.
- Report any unexpected behavior that could affect security or privacy.

Security and privacy are core priorities of the project, and improvements will continue to be incorporated as **Site Extractor** evolves.
