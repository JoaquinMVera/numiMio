const editor = document.getElementById("editor");
const results = document.getElementById("results");
const filenameEl = document.getElementById("filename");

let currentPath = null;
let dirty = false;

function baseName(filePath) {
	if (!filePath) return "Untitled";
	return filePath.split(/[\\/]/).pop();
}

function updateTitle() {
	filenameEl.textContent = baseName(currentPath);
	filenameEl.classList.toggle("dirty", dirty);
}

function renderResults() {
	const lines = editor.value.split("\n");
	const evaluated = CalcEngine.evaluateDocument(editor.value);
	results.innerHTML = "";
	for (let i = 0; i < lines.length; i++) {
		const r = evaluated[i];
		const div = document.createElement("div");
		div.className = "result-line";
		if (!r || r.kind === "empty") {
			div.classList.add("empty");
			div.textContent = " ";
		} else if (r.kind === "value") {
			div.textContent = CalcEngine.formatNumber(r.value);
		} else if (r.kind === "assignment") {
			div.classList.add("assignment");
			div.textContent = `${r.name} = ${CalcEngine.formatNumber(r.value)}`;
		} else if (r.kind === "error") {
			div.classList.add("error");
			div.textContent = r.message;
		}
		results.appendChild(div);
	}
}

function syncScroll() {
	results.scrollTop = editor.scrollTop;
}

editor.addEventListener("input", () => {
	dirty = true;
	updateTitle();
	renderResults();
});
editor.addEventListener("scroll", syncScroll);

async function openFile() {
	const file = await window.desktop.openFile();
	if (!file) return;
	editor.value = file.content;
	currentPath = file.path;
	dirty = false;
	updateTitle();
	renderResults();
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
	renderResults();
	editor.focus();
}

window.desktop.onMenu((action) => {
	if (action === "new") newFile();
	else if (action === "open") openFile();
	else if (action === "save") saveFile(false);
	else if (action === "save-as") saveFile(true);
});

editor.value = "a = 12\nb = 8\nmin(a, b)\nmax(a, b)\n(a + b) * 2\nsqrt(144)\n";
updateTitle();
renderResults();
