(function (root) {
	const CONSTANTS = {
		pi: Math.PI,
		e: Math.E,
		tau: Math.PI * 2,
	};

	const FUNCTIONS = {
		min: (args) => Math.min(...args),
		max: (args) => Math.max(...args),
		sqrt: (args) => Math.sqrt(args[0]),
		cbrt: (args) => Math.cbrt(args[0]),
		abs: (args) => Math.abs(args[0]),
		round: (args) => (args.length > 1 ? roundTo(args[0], args[1]) : Math.round(args[0])),
		floor: (args) => Math.floor(args[0]),
		ceil: (args) => Math.ceil(args[0]),
		trunc: (args) => Math.trunc(args[0]),
		sign: (args) => Math.sign(args[0]),
		pow: (args) => Math.pow(args[0], args[1]),
		log: (args) => (args.length > 1 ? Math.log(args[1]) / Math.log(args[0]) : Math.log10(args[0])),
		ln: (args) => Math.log(args[0]),
		exp: (args) => Math.exp(args[0]),
		sin: (args) => Math.sin(args[0]),
		cos: (args) => Math.cos(args[0]),
		tan: (args) => Math.tan(args[0]),
		sum: (args) => args.reduce((a, b) => a + b, 0),
		avg: (args) => args.reduce((a, b) => a + b, 0) / args.length,
	};

	function roundTo(value, decimals) {
		const factor = Math.pow(10, decimals);
		return Math.round(value * factor) / factor;
	}

	function tokenize(input) {
		const tokens = [];
		let i = 0;
		const isDigit = (c) => c >= "0" && c <= "9";
		const isIdentStart = (c) => /[a-zA-Z_]/.test(c);
		const isIdentPart = (c) => /[a-zA-Z0-9_]/.test(c);

		while (i < input.length) {
			const c = input[i];
			if (c === " " || c === "\t") {
				i++;
				continue;
			}
			if (isDigit(c) || (c === "." && isDigit(input[i + 1]))) {
				let start = i;
				while (i < input.length && isDigit(input[i])) i++;
				if (input[i] === ".") {
					i++;
					while (i < input.length && isDigit(input[i])) i++;
				}
				if (input[i] === "e" || input[i] === "E") {
					let j = i + 1;
					if (input[j] === "+" || input[j] === "-") j++;
					if (isDigit(input[j])) {
						i = j;
						while (i < input.length && isDigit(input[i])) i++;
					}
				}
				tokens.push({ type: "number", value: parseFloat(input.slice(start, i)) });
				continue;
			}
			if (isIdentStart(c)) {
				let start = i;
				while (i < input.length && isIdentPart(input[i])) i++;
				tokens.push({ type: "ident", value: input.slice(start, i) });
				continue;
			}
			if ("+-*/%^(),".includes(c)) {
				tokens.push({ type: "op", value: c });
				i++;
				continue;
			}
			throw new Error(`Unexpected character "${c}"`);
		}
		tokens.push({ type: "eof" });
		return tokens;
	}

	function parseExpression(tokens, scope) {
		let pos = 0;
		const peek = () => tokens[pos];
		const next = () => tokens[pos++];

		function expect(value) {
			const t = tokens[pos];
			if (t.type === "op" && t.value === value) {
				pos++;
				return;
			}
			throw new Error(`Expected "${value}"`);
		}

		function parseAddSub() {
			let left = parseMulDiv();
			while (peek().type === "op" && (peek().value === "+" || peek().value === "-")) {
				const op = next().value;
				const right = parseMulDiv();
				left = op === "+" ? left + right : left - right;
			}
			return left;
		}

		function parseMulDiv() {
			let left = parsePower();
			while (peek().type === "op" && (peek().value === "*" || peek().value === "/" || peek().value === "%")) {
				const op = next().value;
				const right = parsePower();
				if (op === "*") left = left * right;
				else if (op === "/") left = left / right;
				else left = left % right;
			}
			return left;
		}

		function parsePower() {
			const base = parseUnary();
			if (peek().type === "op" && peek().value === "^") {
				next();
				const exponent = parsePower();
				return Math.pow(base, exponent);
			}
			return base;
		}

		function parseUnary() {
			if (peek().type === "op" && (peek().value === "+" || peek().value === "-")) {
				const op = next().value;
				const value = parseUnary();
				return op === "-" ? -value : value;
			}
			return parsePrimary();
		}

		function parsePrimary() {
			const t = peek();
			if (t.type === "number") {
				next();
				return t.value;
			}
			if (t.type === "op" && t.value === "(") {
				next();
				const value = parseAddSub();
				expect(")");
				return value;
			}
			if (t.type === "ident") {
				next();
				const name = t.value;
				if (peek().type === "op" && peek().value === "(") {
					next();
					const args = [];
					if (!(peek().type === "op" && peek().value === ")")) {
						args.push(parseAddSub());
						while (peek().type === "op" && peek().value === ",") {
							next();
							args.push(parseAddSub());
						}
					}
					expect(")");
					const fn = FUNCTIONS[name];
					if (!fn) throw new Error(`Unknown function "${name}"`);
					return fn(args);
				}
				if (name in scope) return scope[name];
				if (name in CONSTANTS) return CONSTANTS[name];
				throw new Error(`Unknown variable "${name}"`);
			}
			throw new Error("Unexpected end of expression");
		}

		const result = parseAddSub();
		if (peek().type !== "eof") throw new Error("Unexpected input");
		return result;
	}

	function evaluateLine(line, scope) {
		const stripped = line.replace(/#.*$/, "").trim();
		if (stripped === "") return { kind: "empty" };

		const assignMatch = stripped.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
		if (assignMatch) {
			const name = assignMatch[1];
			const value = parseExpression(tokenize(assignMatch[2]), scope);
			scope[name] = value;
			return { kind: "assignment", name, value };
		}

		const value = parseExpression(tokenize(stripped), scope);
		return { kind: "value", value };
	}

	function evaluateDocument(text) {
		const scope = {};
		return text.split("\n").map((line) => {
			try {
				return evaluateLine(line, scope);
			} catch (err) {
				return { kind: "error", message: err.message };
			}
		});
	}

	function formatNumber(value) {
		if (!isFinite(value)) return String(value);
		const rounded = roundTo(value, 10);
		return new Intl.NumberFormat("en-US", { maximumFractionDigits: 10 }).format(rounded);
	}

	const api = { evaluateDocument, evaluateLine, formatNumber, FUNCTIONS, CONSTANTS };

	if (typeof module !== "undefined" && module.exports) module.exports = api;
	else root.CalcEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
