# Site Extractor

A modern, lightweight, and powerful browser extension to extract a live page, all linked pages, or any isolated element (HTML, CSS, and JS) across the web into clean code and offline-ready ZIP packages.

<div align="center">
  <img src="https://github.com/hamzabellouch/site-ex/blob/main/Site%20Ex.jpg" width="800"/>
</div>

Compatible with all major browsers: **Chrome, Brave, Edge, Opera (Chromium-based)** and **Mozilla Firefox**.



### <a name="Features"></a> ⭐ Features

- **Three Extraction Modes:**
  - **Capture Site (Full Crawl):** Recursively crawls all linked pages within the same origin (up to 50 levels deep, 500 pages) and bundles the entire website into a self-contained offline directory.
  - **Capture Page:** Live-captures the current active page with full dynamic DOM state, external stylesheets, scripts, inline styles, fonts, and images.
  - **Select Element (Visual Picker):** Interactive point-and-click picker to isolate and extract any specific component, widget, card, or element with real-time bounding box inspection and breadcrumb hierarchy.
- **Interactive Floating Toolbar:** Sleek, draggable on-page capsule toolbar with smooth 2D dragging and snap physics (top/bottom center), offering one-click access to all extraction tools.
- **Dual Element Inspection & Export Modes:**
  - **Live Mode (HTML + CSS + JS):** Extracts clean, formatted markup and modular CSS with interactive script execution and automated dependency resolution.
  - **Pixel-Accurate Snapshot:** Calculates exact computed styles diffed against default browser element baselines, flattens open Shadow DOM roots, and converts pseudo-elements (`::before` / `::after`) into standalone DOM elements.
- **Automated JavaScript Dependency Resolver:** Detects `ReferenceError`s in extracted elements, searches the source site's script catalog for missing variables, functions, or classes, and automatically loads required dependencies.
- **Sandboxed Interactive Preview:** Secure sandboxed iframe preview environment with real-time DOM/JS rendering, expandable full-screen modal view, and live console error logging.
- **Offline ZIP Bundling & Asset Rewriting:** Automatically rewrites internal links and asset references (`url(...)`, `@import`, script tags) to relative paths, packaging all assets with an offline launcher (`start-server.bat`) and an extraction summary report (`_report.txt`).
- **Pre-Allocated Resource Timing Buffer:** Enhances the browser resource-timing buffer at page start (`early.js`) to capture every dynamically loaded stylesheet, script, and font without omission.
- **Privacy-First & 100% Client-Side:** All crawling, parsing, style diffing, and archiving happen locally in the browser with zero external telemetry or tracking.



### <a name="RepositoryStructure"></a> 📁 Repository Structure

```text
├── chromium/          # Extension build directory for Chrome, Brave, Edge, Opera
│   ├── icons/         # Extension icon assets (16px, 32px, 48px, 128px)
│   ├── background.js  # Service worker handling toolbar injection, message routing & crawler launch
│   ├── crawler.html   # Crawler dashboard and progress logging view
│   ├── crawler.js     # Multi-page & single-page recursive crawler and offline ZIP bundler
│   ├── early.js       # Pre-load script boosting Resource Timing buffer to prevent asset drop
│   ├── jszip.min.js   # Bundled JSZip library for client-side archive compilation
│   ├── manifest.json  # Chromium Manifest V3 configuration
│   ├── picker.js      # Interactive visual element selector and style diffing engine
│   ├── popup.html     # Extension popup user interface
│   ├── popup.js       # Popup action triggers and tab communication
│   ├── preview.html   # Sandboxed preview container for safe code execution
│   ├── preview.js     # Sandboxed renderer script
│   ├── result.html    # Element inspection, code tabs, and live preview dashboard
│   ├── result.js      # Code tabs, dependency resolver, snapshot generator, and export manager
│   └── toolbar.js     # Floating draggable on-page toolbar with snap physics
│
├── firefox/           # Extension build directory for Mozilla Firefox
│   ├── icons/         # Extension icon assets (16px, 32px, 48px, 128px)
│   ├── background.js  # Background script handling toolbar injection, message routing & crawler launch
│   ├── crawler.html   # Crawler dashboard and progress logging view
│   ├── crawler.js     # Multi-page & single-page recursive crawler and offline ZIP bundler
│   ├── early.js       # Pre-load script boosting Resource Timing buffer to prevent asset drop
│   ├── jszip.min.js   # Bundled JSZip library for client-side archive compilation
│   ├── manifest.json  # Firefox Manifest V3 configuration (with Gecko ID)
│   ├── picker.js      # Interactive visual element selector and style diffing engine
│   ├── popup.html     # Extension popup user interface
│   ├── popup.js       # Popup action triggers and tab communication
│   ├── preview.html   # Sandboxed preview container for safe code execution
│   ├── preview.js     # Sandboxed renderer script
│   ├── result.html    # Element inspection, code tabs, and live preview dashboard
│   ├── result.js      # Code tabs, dependency resolver, snapshot generator, and export manager
│   └── toolbar.js     # Floating draggable on-page toolbar with snap physics
│
├── .gitignore         # Prevents tracking of OS metadata, IDE configurations, etc.
├── LICENSE            # Apache-2.0 open-source license
├── Site Ex.jpg        # Extension preview banner
├── README.md          # Project documentation
└── SECURITY.md        # Security policy and reporting guidelines
```



### <a name="InstallationUsage"></a> ⚙️ Installation & Usage

### <a name="ForChromiumBasedBrowsers"></a> 🌐 For Chromium-Based Browsers (Chrome, Brave, Edge, Opera)

1. Open your Chromium-based browser and navigate to:
   - **Google Chrome / Brave / Opera:** `chrome://extensions/`
   - **Microsoft Edge:** `edge://extensions/`

2. Enable **Developer mode** (toggle in the top-right corner).

3. Click **Load unpacked**.

4. Select the following directory:

```text
chromium/
├── icons/
├── background.js
├── crawler.html
├── crawler.js
├── early.js
├── jszip.min.js
├── manifest.json
├── picker.js
├── popup.html
├── popup.js
├── preview.html
├── preview.js
├── result.html
├── result.js
└── toolbar.js
```

5. The extension will be installed and is now ready to use from the browser toolbar.

### <a name="ForMozillaFirefox"></a> 🦊 For Mozilla Firefox

1. Open **Mozilla Firefox** and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the following file:

```text
firefox/
└── manifest.json
```

4. The extension is now loaded as a temporary add-on.



### <a name="Privacy & Safety"></a> 🛡️ Privacy & Safety

- **Local Processing:** All crawling, DOM parsing, computed style calculations, asset fetching, and ZIP packaging are performed locally within your browser. No data, URLs, or code are sent to external servers or telemetry databases.
- **Sandboxed Execution:** Interactive element previews execute in an isolated sandboxed page (`preview.html`) without access to privileged browser or extension APIs.
- **Privacy Filtering:** The crawler automatically filters out tracking, telemetry, and advertising domains (e.g., Google Analytics, Tag Manager, DoubleClick, Facebook, Hotjar, Sentry, Segment) to maintain clean offline archives.



> [!WARNING]
> There is always a possibility of error or website incompatibility, so we assume no responsibility for any inaccuracies.

</p>
<h3 align="center">Version 1.0.0</h3>
<p align="center">
</p>

> Changes — October 17, 2026

- Full website crawling engine supporting deep recursive link extraction and relative asset structuring
- High-fidelity single live page extraction preserving DOM states, external styles, fonts, and scripts
- Visual element picker with real-time bounding box inspection, hierarchical breadcrumb paths, and click-to-capture
- Dual element extraction engine: Clean modular CSS extraction and baseline-diffed computed style inlining
- Shadow DOM flattening and pseudo-element (`::before` / `::after`) extraction into real DOM nodes
- Interactive sandboxed code preview with Live (HTML+CSS+JS), HTML+CSS only, and Pixel-Accurate Snapshot views
- Automated JavaScript dependency resolution engine dynamically identifying and linking missing script definitions
- Draggable on-page floating toolbar with smooth snap physics and quick action triggers
- Built-in offline ZIP archive packaging powered by JSZip with automatic local HTTP server launcher (`start-server.bat`)
- Multi-browser Manifest V3 architecture with full support for Chromium-based browsers and Mozilla Firefox

> Build Status

```bash
BUILD SUCCESSFUL
```


### <a name="Copyright©2026"></a> Copyright © 2026

Thank you for engaging with us. For inquiries or collaboration, please contact:  
hamzabellouchcontact@gmail.com

Stay connected and follow us on:  
[WhatsApp](https://whatsapp.com/channel/0029Vb7MArw0LKZMpjjqOk2P) | [Facebook](https://facebook.com/hamzabellouch1) | [Instagram](https://instagram.com/hamzabellouch0) | [Twitter](https://twitter.com/hamzabellouch0) | [Telegram](https://t.me/hammzabellouch) | [LinkedIn](https://www.linkedin.com/in/hamzabellouch)
