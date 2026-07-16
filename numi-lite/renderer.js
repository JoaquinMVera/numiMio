const editor = document.getElementById("editor");
const highlightCode = document.getElementById("highlight-code");
const highlight = document.getElementById("highlight");
const results = document.getElementById("results");
const filenameEl = document.getElementById("filename");

let currentPath = null;
let dirty = false;

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

function baseName(filePath) {
	if (!filePath) return "Untitled";
	return filePath.split(/[\\/]/).pop();
}

function updateTitle() {
	filenameEl.textContent = baseName(currentPath);
	filenameEl.classList.toggle("dirty", dirty);
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

editor.addEventListener("input", () => {
	dirty = true;
	updateTitle();
	render();
});
editor.addEventListener("scroll", syncScroll);

async function openFile() {
	const file = await window.desktop.openFile();
	if (!file) return;
	editor.value = file.content;
	currentPath = file.path;
	dirty = false;
	updateTitle();
	render();
}

async function saveFile(forceDialog) {
	const saved = await window.desktop.saveFile({ path: currentPath, content: editor.value, forceDialog });
	if (!saved) return;
	currentPath = saved.path;
	dirty = false;
	updateTitle();
}

function newFile() {
	editor.value = "";
	currentPath = null;
	dirty = false;
	updateTitle();
	render();
	editor.focus();
}

window.desktop.onMenu((action) => {
	if (action === "new") newFile();
	else if (action === "open") openFile();
	else if (action === "save") saveFile(false);
	else if (action === "save-as") saveFile(true);
	else if (action === "zoom-in") changeFontSize(1);
	else if (action === "zoom-out") changeFontSize(-1);
	else if (action === "zoom-reset") resetFontSize();
});

document.getElementById("zoom-in").addEventListener("click", () => changeFontSize(1));
document.getElementById("zoom-out").addEventListener("click", () => changeFontSize(-1));
document.getElementById("zoom-reset").addEventListener("click", resetFontSize);

editor.addEventListener("wheel", (event) => {
	if (!event.metaKey && !event.ctrlKey) return;
	event.preventDefault();
	changeFontSize(event.deltaY < 0 ? 1 : -1);
});

applyFontSize();

editor.value = "iva = 21\ndoble(x) = x * 2\nconIva(p) = p + p * iva / 100\n\ndoble(9)\nconIva(1000)\nmin(3, 4) + max(10, 2)\n";
updateTitle();
render();
