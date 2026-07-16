const editor = document.getElementById("editor");
const highlightCode = document.getElementById("highlight-code");
const highlight = document.getElementById("highlight");
const results = document.getElementById("results");
const tabbar = document.getElementById("tabbar");

let tabs = [];
let activeId = null;
let seq = 0;

function baseName(filePath) {
	if (!filePath) return "Untitled";
	return filePath.split(/[\\/]/).pop();
}

function activeTab() {
	return tabs.find((t) => t.id === activeId) || null;
}

function setWindowTitle() {
	const tab = activeTab();
	const name = tab ? baseName(tab.path) : "Numi J";
	document.title = `${tab && tab.dirty ? "• " : ""}${name} — Numi J`;
}

function escapeHtml(text) {
	return text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function highlightLine(line) {
	const commentIndex = line.indexOf("#");
	const code = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
	const comment = commentIndex >= 0 ? line.slice(commentIndex) : "";

	let html = "";
	const tokenRe = /(\s+)|(\d*\.?\d+(?:[eE][+\-]?\d+)?)|([a-zA-Z_]\w*)|([+\-*/%^(),=])/g;
	let lastIndex = 0;
	let match;
	while ((match = tokenRe.exec(code)) !== null) {
		if (match.index > lastIndex) html += escapeHtml(code.slice(lastIndex, match.index));
		lastIndex = tokenRe.lastIndex;
		const [, ws, num, ident, op] = match;
		if (ws !== undefined) {
			html += escapeHtml(ws);
		} else if (num !== undefined) {
			html += `<span class="tok-num">${escapeHtml(num)}</span>`;
		} else if (ident !== undefined) {
			const isFunc = /^\s*\(/.test(code.slice(tokenRe.lastIndex));
			html += `<span class="${isFunc ? "tok-func" : "tok-var"}">${escapeHtml(ident)}</span>`;
		} else if (op !== undefined) {
			html += `<span class="tok-op">${escapeHtml(op)}</span>`;
		}
	}
	if (lastIndex < code.length) html += escapeHtml(code.slice(lastIndex));
	if (comment) html += `<span class="tok-comment">${escapeHtml(comment)}</span>`;
	return html;
}

function renderHighlight() {
	const html = editor.value.split("\n").map(highlightLine).join("\n");
	highlightCode.innerHTML = html + "\n";
}

function renderResults() {
	const lines = editor.value.split("\n");
	const evaluated = CalcEngine.evaluateDocument(editor.value);
	results.innerHTML = "";
	for (let i = 0; i < lines.length; i++) {
		const r = evaluated[i];
		const div = document.createElement("div");
		div.className = "result-line";
		if (!r || r.kind === "empty" || r.kind === "error" || r.kind === "function") {
			div.classList.add("empty");
			div.textContent = " ";
		} else if (r.kind === "value") {
			div.textContent = CalcEngine.formatNumber(r.value);
		} else if (r.kind === "assignment") {
			div.classList.add("assignment");
			div.textContent = CalcEngine.formatNumber(r.value);
		}
		results.appendChild(div);
	}
}

function render() {
	renderHighlight();
	renderResults();
}

function syncScroll() {
	highlight.scrollTop = editor.scrollTop;
	highlight.scrollLeft = editor.scrollLeft;
	results.scrollTop = editor.scrollTop;
}

function renderTabs() {
	tabbar.innerHTML = "";
	tabs.forEach((tab) => {
		const el = document.createElement("div");
		el.className = "tab" + (tab.id === activeId ? " active" : "") + (tab.dirty ? " dirty" : "");
		el.title = tab.path || "Untitled";
		el.addEventListener("click", () => switchTo(tab.id));

		const name = document.createElement("span");
		name.className = "tab-name";
		name.textContent = baseName(tab.path);
		el.appendChild(name);

		const close = document.createElement("button");
		close.className = "tab-close";
		close.textContent = "×";
		close.title = "Close tab (Cmd W)";
		close.addEventListener("click", (event) => {
			event.stopPropagation();
			closeTab(tab.id);
		});
		el.appendChild(close);

		tabbar.appendChild(el);
	});

	const add = document.createElement("button");
	add.id = "tab-add";
	add.textContent = "+";
	add.title = "New tab (Cmd N)";
	add.addEventListener("click", () => newTab());
	tabbar.appendChild(add);
}

function loadActiveIntoEditor() {
	const tab = activeTab();
	editor.value = tab ? tab.content : "";
	render();
	syncScroll();
}

function switchTo(id) {
	if (id === activeId) return;
	activeId = id;
	loadActiveIntoEditor();
	renderTabs();
	setWindowTitle();
	editor.focus();
}

function newTab(content, path) {
	const tab = { id: ++seq, content: content || "", path: path || null, dirty: false };
	tabs.push(tab);
	activeId = tab.id;
	loadActiveIntoEditor();
	renderTabs();
	setWindowTitle();
	editor.focus();
}

function closeTab(id) {
	const index = tabs.findIndex((t) => t.id === id);
	if (index === -1) return;
	const tab = tabs[index];
	if (tab.dirty && !window.confirm(`Discard unsaved changes in "${baseName(tab.path)}"?`)) return;
	tabs.splice(index, 1);
	if (tabs.length === 0) {
		newTab();
		return;
	}
	if (activeId === id) {
		activeId = tabs[Math.min(index, tabs.length - 1)].id;
		loadActiveIntoEditor();
		setWindowTitle();
	}
	renderTabs();
}

editor.addEventListener("input", () => {
	const tab = activeTab();
	if (tab) {
		tab.content = editor.value;
		tab.dirty = true;
	}
	render();
	renderTabs();
	setWindowTitle();
});
editor.addEventListener("scroll", syncScroll);

async function openFile() {
	const file = await window.desktop.openFile();
	if (!file) return;
	const tab = activeTab();
	if (tab && !tab.dirty && !tab.path && tab.content.trim() === "") {
		tab.content = file.content;
		tab.path = file.path;
		tab.dirty = false;
		loadActiveIntoEditor();
		renderTabs();
		setWindowTitle();
	} else {
		newTab(file.content, file.path);
	}
}

async function saveActive(forceDialog) {
	const tab = activeTab();
	if (!tab) return;
	const saved = await window.desktop.saveFile({ path: tab.path, content: tab.content, forceDialog });
	if (!saved) return;
	tab.path = saved.path;
	tab.dirty = false;
	renderTabs();
	setWindowTitle();
}

window.desktop.onMenu((action) => {
	if (action === "new") newTab();
	else if (action === "open") openFile();
	else if (action === "save") saveActive(false);
	else if (action === "save-as") saveActive(true);
	else if (action === "close-tab") closeTab(activeId);
	else if (action === "zoom-in") changeFontSize(1);
	else if (action === "zoom-out") changeFontSize(-1);
	else if (action === "zoom-reset") resetFontSize();
});

document.addEventListener("keydown", (event) => {
	if ((event.metaKey || event.ctrlKey) && event.key >= "1" && event.key <= "9") {
		const index = parseInt(event.key, 10) - 1;
		if (tabs[index]) {
			event.preventDefault();
			switchTo(tabs[index].id);
		}
	}
});

const MIN_FONT_SIZE = 9;
const MAX_FONT_SIZE = 40;
const DEFAULT_FONT_SIZE = 15;
let fontSize = parseInt(localStorage.getItem("fontSize"), 10) || DEFAULT_FONT_SIZE;

function applyFontSize() {
	document.documentElement.style.setProperty("--font-size", `${fontSize}px`);
	localStorage.setItem("fontSize", String(fontSize));
}

function changeFontSize(delta) {
	fontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize + delta));
	applyFontSize();
	syncScroll();
}

function resetFontSize() {
	fontSize = DEFAULT_FONT_SIZE;
	applyFontSize();
	syncScroll();
}

document.getElementById("zoom-in").addEventListener("click", () => changeFontSize(1));
document.getElementById("zoom-out").addEventListener("click", () => changeFontSize(-1));
document.getElementById("zoom-reset").addEventListener("click", resetFontSize);

editor.addEventListener("wheel", (event) => {
	if (!event.metaKey && !event.ctrlKey) return;
	event.preventDefault();
	changeFontSize(event.deltaY < 0 ? 1 : -1);
});

const THEMES = ["dark", "light", "violet"];
const themeSelect = document.getElementById("theme");
let theme = localStorage.getItem("theme");
if (!THEMES.includes(theme)) theme = "dark";

function applyTheme() {
	document.documentElement.setAttribute("data-theme", theme);
	localStorage.setItem("theme", theme);
	themeSelect.value = theme;
}

themeSelect.addEventListener("change", () => {
	theme = themeSelect.value;
	applyTheme();
});

applyFontSize();
applyTheme();
newTab("iva = 21\ndoble(x) = x * 2\nconIva(p) = p + p * iva / 100\n\ndoble(9)\nconIva(1000)\nmin(3, 4) + max(10, 2)\n");
