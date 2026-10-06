import fs from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import { LocalModels } from "./models";
import { Runtime, type TaskMode } from "./runtime";

let window: BrowserWindow | undefined;
let runtime: Runtime;
let timer: NodeJS.Timeout;
let quitting = false;
if (process.env.NEST_TEST_DATA)
	app.setPath("userData", process.env.NEST_TEST_DATA);
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
function show(): void {
	if (!primaryInstance || quitting) return;
	if (window && !window.isDestroyed()) {
		window.show();
		return;
	}
	window = new BrowserWindow({
		width: 1160,
		height: 820,
		minWidth: 360,
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
	if (!primaryInstance) return;
	const helperPath = app.isPackaged
		? path.join(process.resourcesPath, "orbit-apple-helper")
		: path.join(__dirname, "native", "orbit-apple-helper");
	runtime = new Runtime(
		path.join(app.getPath("userData"), "work.json"),
		fetch,
		new LocalModels(helperPath),
	);
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
				JSON.stringify(input ?? {}).length > 16000
			)
				throw Error("Invalid request");
			const p = input as Record<string, unknown>;
			const id = (): string => {
				if (typeof p?.id !== "string" || p.id.length > 200)
					throw Error("Invalid ID");
				return p.id;
			};
			const state = () => {
				const snapshot = runtime.store.snapshot();
				snapshot.data.bots = runtime.bots();
				return snapshot;
			};
			const mode = (): TaskMode => {
				const value = p.mode ?? "chat";
				if (
					value !== "chat" &&
					value !== "summary" &&
					value !== "writing-review"
				)
					throw Error("Invalid task mode");
				return value;
			};
			if (command === "state") return state();
			if (command === "add-bot") runtime.addBot(p);
			else if (command === "focus") runtime.updateLife(id(), p);
			else if (command === "chat") {
				if (
					typeof p.prompt !== "string" ||
					typeof p.requestId !== "string" ||
					!/^[a-zA-Z0-9-]{1,150}$/.test(p.requestId)
				)
					throw Error("Invalid local chat request");
				await runtime.chat(id(), p.prompt, p.requestId);
			} else if (["add-bot", "focus", "chat"].includes(command))
				throw Error("Invalid command");
			if (["add-bot", "focus", "chat"].includes(command)) {
				if (command === "chat") void runtime.tick();
				return state();
			}
			if (command === "catalog") return runtime.catalog();
			if (command === "preview") {
				if (typeof p.prompt !== "string") throw Error("Invalid task");
				return runtime.preview(id(), p.prompt, mode());
			}
			if (command === "manuscript-files") return runtime.files(id());
			if (command === "save") runtime.save(input);
			else if (command === "select-model")
				await runtime.selectModel(id(), p.provider, p.model, p.profileRevision);
			else if (command === "folder") {
				if (runtime.template(runtime.bot(id())) !== "writing")
					throw Error("This Bot has no folder-read capability");
				const picked = await dialog.showOpenDialog(window, {
					properties: ["openDirectory"],
				});
				if (!picked.canceled)
					runtime.grantFolder(id(), await fs.realpath(picked.filePaths[0]));
			} else if (command === "select-files") {
				await runtime.selectFiles(id(), p.files);
			} else if (command === "revoke-folder") {
				runtime.grantFolder(id(), "");
			} else if (command === "stop-companion") runtime.stopCompanion(id());
			else if (command === "run-routine") {
				if (
					typeof p.requestId !== "string" ||
					!p.requestId.trim() ||
					p.requestId.length > 150
				)
					throw Error("Stable manual request ID required");
				const schedule = runtime.store
					.snapshot()
					.schedules.find((schedule) => schedule.id === id());
				if (!schedule) throw Error("Unknown routine");
				runtime.store.enqueue(
					`manual:${p.requestId}`,
					schedule.payload,
					schedule.effect,
				);
			} else if (command === "run") {
				if (typeof p.prompt !== "string" || typeof p.requestId !== "string")
					throw Error("Invalid task");
				runtime.checkPreview(id(), p.prompt, mode(), p.previewToken);
				runtime.submit(id(), p.prompt, p.requestId, mode());
			} else if (command === "schedule") {
				if (typeof p.prompt !== "string" || typeof p.minutes !== "number")
					throw Error("Invalid schedule");
				runtime.checkPreview(id(), p.prompt, mode(), p.previewToken);
				runtime.schedule(id(), p.prompt, p.minutes, mode());
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
			else if (command === "health")
				return (await runtime.catalog()).ollama.message;
			else throw Error("Unknown command");
			void runtime.tick();
			return state();
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
	if (!primaryInstance || quitting) return;
	event.preventDefault();
	quitting = true;
	clearInterval(timer);
	void runtime?.close().then(
		() => app.exit(0),
		(error) => {
			console.error("Failed to close the work store", error);
			app.exit(1);
		},
	);
});
