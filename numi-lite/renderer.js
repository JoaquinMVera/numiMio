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

function afterEdit() {
	const tab = activeTab();
	if (tab) {
		tab.content = editor.value;
		tab.dirty = true;
	}
	render();
	renderTabs();
	setWindowTitle();
}

editor.addEventListener("input", () => {
	afterEdit();
	if (ac.open) {
		const prefix = currentPrefix();
		if (!prefix) closeAutocomplete();
		else openAutocomplete(prefix, true);
	}
});
editor.addEventListener("scroll", () => {
	syncScroll();
	if (ac.open) positionAutocomplete();
});

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

const autocompleteEl = document.getElementById("autocomplete");
const measureCtx = document.createElement("canvas").getContext("2d");
const ac = { open: false, items: [], index: 0, start: 0, prefix: "" };

function candidateList() {
	const vars = new Set();
	const funcs = new Set();
	CalcEngine.evaluateDocument(editor.value).forEach((r) => {
		if (r.kind === "assignment") vars.add(r.name);
		else if (r.kind === "function") funcs.add(r.name);
	});
	Object.keys(CalcEngine.CONSTANTS).forEach((k) => vars.add(k));
	Object.keys(CalcEngine.FUNCTIONS).forEach((k) => funcs.add(k));
	const items = [];
	vars.forEach((name) => items.push({ name, kind: "var" }));
	funcs.forEach((name) => items.push({ name, kind: "fn" }));
	return items;
}

function currentPrefix() {
	if (editor.selectionStart !== editor.selectionEnd) return null;
	const caret = editor.selectionStart;
	const match = editor.value.slice(0, caret).match(/[a-zA-Z_]\w*$/);
	if (!match) return null;
	return { text: match[0], start: caret - match[0].length };
}

function caretCoordinates() {
	const style = getComputedStyle(editor);
	measureCtx.font = `${style.fontSize} ${style.fontFamily}`;
	const charWidth = measureCtx.measureText("0").width;
	const lineHeight = parseFloat(style.lineHeight);
	const padL = parseFloat(style.paddingLeft);
	const padT = parseFloat(style.paddingTop);
	const before = editor.value.slice(0, editor.selectionStart);
	const rows = before.split("\n");
	const row = rows.length - 1;
	const col = rows[row].length;
	return {
		x: padL + col * charWidth - editor.scrollLeft,
		y: padT + (row + 1) * lineHeight - editor.scrollTop,
	};
}

function positionAutocomplete() {
	const { x, y } = caretCoordinates();
	autocompleteEl.style.left = `${Math.max(0, x)}px`;
	autocompleteEl.style.top = `${y}px`;
}

function renderAutocomplete() {
	autocompleteEl.innerHTML = "";
	ac.items.forEach((item, i) => {
		const li = document.createElement("li");
		if (i === ac.index) li.className = "active";
		const name = document.createElement("span");
		name.textContent = item.name;
		const kind = document.createElement("span");
		kind.className = "ac-kind";
		kind.textContent = item.kind;
		li.appendChild(name);
		li.appendChild(kind);
		li.addEventListener("mousedown", (event) => {
			event.preventDefault();
			applyCompletion(item);
		});
		autocompleteEl.appendChild(li);
	});
	autocompleteEl.classList.remove("hidden");
}

function openAutocomplete(prefix, keepOpenOnly) {
	const lower = prefix.text.toLowerCase();
	const matches = candidateList()
		.filter((item) => item.name.toLowerCase().startsWith(lower) && item.name !== prefix.text)
		.sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name));

	if (matches.length === 0) {
		closeAutocomplete();
		return keepOpenOnly ? true : false;
	}
	if (matches.length === 1 && !keepOpenOnly) {
		ac.start = prefix.start;
		ac.prefix = prefix.text;
		applyCompletion(matches[0]);
		return true;
	}
	ac.open = true;
	ac.items = matches;
	ac.index = 0;
	ac.start = prefix.start;
	ac.prefix = prefix.text;
	renderAutocomplete();
	positionAutocomplete();
	return true;
}

function closeAutocomplete() {
	ac.open = false;
	autocompleteEl.classList.add("hidden");
}

function applyCompletion(item) {
	const caret = editor.selectionStart;
	const rest = editor.value.slice(caret);
	let insert = item.name;
	let caretOffset = insert.length;
	if (item.kind === "fn") {
		if (rest[0] === "(") {
			caretOffset = insert.length + 1;
		} else {
			insert = `${item.name}()`;
			caretOffset = item.name.length + 1;
		}
	}
	editor.value = editor.value.slice(0, ac.start) + insert + rest;
	editor.selectionStart = editor.selectionEnd = ac.start + caretOffset;
	closeAutocomplete();
	afterEdit();
	syncScroll();
	editor.focus();
}

function exitParens() {
	if (editor.selectionStart !== editor.selectionEnd) return false;
	const text = editor.value;
	let depth = 0;
	for (let i = editor.selectionStart; i < text.length; i++) {
		const c = text[i];
		if (c === "\n") break;
		if (c === "(") depth++;
		else if (c === ")") {
			if (depth === 0) {
				editor.selectionStart = editor.selectionEnd = i + 1;
				return true;
			}
			depth--;
		}
	}
	return false;
}

function insertAtCaret(text) {
	const start = editor.selectionStart;
	const end = editor.selectionEnd;
	editor.value = editor.value.slice(0, start) + text + editor.value.slice(end);
	editor.selectionStart = editor.selectionEnd = start + text.length;
	afterEdit();
	syncScroll();
}

editor.addEventListener("keydown", (event) => {
	if (ac.open) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			ac.index = (ac.index + 1) % ac.items.length;
			renderAutocomplete();
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			ac.index = (ac.index - 1 + ac.items.length) % ac.items.length;
			renderAutocomplete();
			return;
		}
		if (event.key === "Enter" || event.key === "Tab") {
			event.preventDefault();
			applyCompletion(ac.items[ac.index]);
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			closeAutocomplete();
			return;
		}
	}

	if (event.key === "Tab" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
		event.preventDefault();
		const prefix = currentPrefix();
		if (prefix && openAutocomplete(prefix)) return;
		if (exitParens()) return;
		insertAtCaret("\t");
		return;
	}

	if (event.metaKey || event.ctrlKey || event.altKey) return;

	if (event.key === "(") {
		event.preventDefault();
		closeAutocomplete();
		const start = editor.selectionStart;
		const end = editor.selectionEnd;
		const selected = editor.value.slice(start, end);
		editor.value = `${editor.value.slice(0, start)}(${selected})${editor.value.slice(end)}`;
		editor.selectionStart = start + 1;
		editor.selectionEnd = start + 1 + selected.length;
		afterEdit();
		syncScroll();
		return;
	}

	if (event.key === ")" && editor.selectionStart === editor.selectionEnd && editor.value[editor.selectionStart] === ")") {
		event.preventDefault();
		editor.selectionStart = editor.selectionEnd = editor.selectionStart + 1;
		return;
	}

	if (event.key === "Backspace" && editor.selectionStart === editor.selectionEnd) {
		const i = editor.selectionStart;
		if (editor.value[i - 1] === "(" && editor.value[i] === ")") {
			event.preventDefault();
			editor.value = editor.value.slice(0, i - 1) + editor.value.slice(i + 1);
			editor.selectionStart = editor.selectionEnd = i - 1;
			afterEdit();
			syncScroll();
		}
	}
});

editor.addEventListener("blur", closeAutocomplete);

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
