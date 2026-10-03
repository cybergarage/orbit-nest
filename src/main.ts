import fs from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import { Runtime } from "./runtime";

let window: BrowserWindow | undefined;
let runtime: Runtime;
let timer: NodeJS.Timeout;
let quitting = false;
if (process.env.NEST_TEST_DATA)
	app.setPath("userData", process.env.NEST_TEST_DATA);
if (!app.requestSingleInstanceLock()) app.quit();
function show(): void {
	if (window && !window.isDestroyed()) {
		window.show();
		return;
	}
	window = new BrowserWindow({
		width: 1160,
		height: 820,
		minWidth: 850,
		minHeight: 600,
		title: "Orbit Nest",
		backgroundColor: "#f4f5f0",
		webPreferences: {
			preload: path.join(__dirname, "preload.cjs"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
	});
	window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
	window.webContents.on("will-navigate", (e) => e.preventDefault());
	void window.loadFile(path.join(__dirname, "index.html"));
}
void app.whenReady().then(() => {
	runtime = new Runtime(path.join(app.getPath("userData"), "work.json"));
	ipcMain.handle(
		"nest:call",
		async (event, command: unknown, input: unknown) => {
			if (
				!window ||
				event.sender !== window.webContents ||
				event.senderFrame !== window.webContents.mainFrame ||
				event.senderFrame.url !==
					new URL(`file://${path.join(__dirname, "index.html")}`).href
			)
				throw Error("Untrusted sender");
			if (
				typeof command !== "string" ||
				JSON.stringify(input ?? {}).length > 12000
			)
				throw Error("Invalid request");
			const p = input as Record<string, unknown>;
			const id = (): string => {
				if (typeof p?.id !== "string" || p.id.length > 200)
					throw Error("Invalid ID");
				return p.id;
			};
			if (command === "state") return runtime.store.snapshot();
			if (command === "save") runtime.save(input);
			else if (command === "folder") {
				runtime.bot(id());
				const picked = await dialog.showOpenDialog(window, {
					properties: ["openDirectory"],
				});
				if (!picked.canceled)
					runtime.grantFolder(id(), await fs.realpath(picked.filePaths[0]));
			} else if (command === "revoke-folder") {
				runtime.grantFolder(id(), "");
			} else if (command === "run-routine") {
				const schedule = runtime.store
					.snapshot()
					.schedules.find((schedule) => schedule.id === id());
				if (!schedule) throw Error("Unknown routine");
				runtime.store.enqueue(
					`manual:${crypto.randomUUID()}`,
					schedule.payload,
					schedule.effect,
				);
			} else if (command === "run") {
				if (typeof p.prompt !== "string" || typeof p.requestId !== "string")
					throw Error("Invalid task");
				runtime.submit(id(), p.prompt, p.requestId);
			} else if (command === "schedule") {
				if (typeof p.prompt !== "string" || typeof p.minutes !== "number")
					throw Error("Invalid schedule");
				runtime.schedule(id(), p.prompt, p.minutes);
			} else if (command === "pause") {
				if (typeof p.paused !== "boolean") throw Error("Invalid pause");
				runtime.store.pause(id(), p.paused);
			} else if (command === "cancel") runtime.cancel(id());
			else if (command === "approve") {
				if (typeof p.allow !== "boolean") throw Error("Invalid approval");
				runtime.store.approve(id(), p.allow);
			} else if (command === "remember") runtime.remember(id());
			else if (command === "reconcile")
				runtime.store.reconcile(
					id(),
					"User confirmed local memory operation stopped; no automatic replay",
					true,
				);
			else if (command === "health") {
				try {
					const response = await fetch("http://127.0.0.1:11434/api/tags", {
						signal: AbortSignal.timeout(3000),
					});
					const body = (await response.json()) as {
						models: { name: string }[];
					};
					return body.models.some((m) => m.name === "gemma4:12b")
						? "Local gemma4:12b ready"
						: "Install gemma4:12b separately; no model downloads or cloud fallback";
				} catch {
					return "Ollama unavailable. Start the local Ollama app; no cloud fallback.";
				}
			} else throw Error("Unknown command");
			void runtime.tick();
			return runtime.store.snapshot();
		},
	);
	Menu.setApplicationMenu(
		Menu.buildFromTemplate([
			{
				label: "Orbit Nest",
				submenu: [{ label: "Show Nest", click: show }, { role: "quit" }],
			},
			{ role: "editMenu" },
		]),
	);
	show();
	timer = setInterval(() => void runtime.tick().catch(console.error), 1000);
	void runtime.tick();
});
app.on("activate", show);
app.on("second-instance", show);
app.on("window-all-closed", () => {
	/* Scheduling continues while Electron is running. */
});
app.on("before-quit", (event) => {
	if (quitting) return;
	event.preventDefault();
	quitting = true;
	clearInterval(timer);
	void runtime?.close().finally(() => app.quit());
});
