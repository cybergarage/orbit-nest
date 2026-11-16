import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import { LocalModels } from "./models";
import { Runtime, type TaskMode } from "./runtime";

let window: BrowserWindow | undefined;
let runtime: Runtime;
let timer: NodeJS.Timeout;
let quitting = false;
let ready = false;
if (process.env.NEST_TEST_DATA)
	app.setPath("userData", process.env.NEST_TEST_DATA);
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
function show(): void {
	if (!primaryInstance || quitting || !ready) return;
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
async function startHost(): Promise<void> {
	if (!primaryInstance) return;
	const helperPath = app.isPackaged
		? path.join(process.resourcesPath, "orbit-apple-helper")
		: path.join(__dirname, "native", "orbit-apple-helper");
	const catalogRoot = app.isPackaged
		? path.join(
				process.resourcesPath,
				"app.asar.unpacked",
				"dist",
				"catalog-native",
			)
		: path.join(__dirname, "catalog-native");
	const manifest = JSON.parse(
		await fs.readFile(path.join(catalogRoot, "bundle-provenance.json"), "utf8"),
	);
	if (
		manifest.identity.electronVersion !== process.versions.electron ||
		manifest.identity.arch !== process.arch ||
		manifest.identity.platform !== process.platform ||
		!/^[a-f\d]{40}$/.test(manifest.sourceCommit)
	)
		throw new Error(
			"Catalog artifact identity does not match this Electron runtime",
		);
	for (const file of [
		"context.mjs",
		"sqlite-worker.js",
		"node_modules/better-sqlite3/build/Release/better_sqlite3.node",
	]) {
		const hash = createHash("sha256")
			.update(await fs.readFile(path.join(catalogRoot, file)))
			.digest("hex");
		if (manifest.hashes[file] !== hash)
			throw new Error("Packaged catalog artifact checksum mismatch");
	}
	runtime = new Runtime(
		path.join(app.getPath("userData"), "work.json"),
		fetch,
		new LocalModels(helperPath),
	);
	const { openContext } = (await import(
		pathToFileURL(path.join(catalogRoot, "context.mjs")).href
	)) as typeof import("./project-context");
	try {
		runtime.context = await openContext(
			path.join(app.getPath("userData"), "context"),
			runtime,
		);
	} catch (error) {
		await runtime.close();
		throw error;
	}
	const context = runtime.context;
	if (!context) throw new Error("Project context startup did not complete");
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
			const state = async () => {
				const snapshot = runtime.store.snapshot();
				snapshot.data.bots = runtime.bots();
				snapshot.data.approvalRequests = runtime.approvalRequests();
				try {
					snapshot.data.messageReceipts = runtime.conversationInput.list(
						runtime.store,
					);
				} catch (error) {
					snapshot.data.messageReceipts = [];
					snapshot.data.messageError =
						error instanceof Error
							? error.message
							: "Local input inspection required";
				}
				try {
					snapshot.data.resultNotices = runtime.notifications.list(snapshot);
				} catch (error) {
					snapshot.data.notificationError =
						error instanceof Error
							? error.message
							: "Notification inspection required";
					snapshot.data.resultNotices = [];
				}
				snapshot.data.contextViews = Object.fromEntries(
					await Promise.all(
						runtime
							.bots()
							.map(async (bot) => [bot.id, await context.view(bot.id)]),
					),
				);
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
			if (command === "appearance") {
				runtime.setAppearance(id(), p.color);
				return state();
			}
			if (command === "project-note-change") {
				await context.changeMemory(
					id(),
					p as unknown as import("./project-notes").NoteChange,
				);
				return state();
			}
			if (command === "project-note-history") {
				if (p.after !== undefined && typeof p.after !== "string")
					throw new Error("Invalid note history cursor");
				return context.noteHistory(
					id(),
					p.target as import("./context-target").ContextTarget,
					p.after as string | undefined,
				);
			}

			if (command === "notification-read") {
				if (typeof p.botId !== "string" || typeof p.sessionId !== "string")
					throw new Error("Explicit notification target required");
				await runtime.readNotification(id(), p.botId, p.sessionId);
				return state();
			}
			if (
				[
					"project-create",
					"session-create",
					"context-select",
					"project-note",
				].includes(command)
			) {
				const botId = id();
				if (command === "context-select") {
					if (typeof p.sessionId !== "string")
						throw new Error("Invalid Session selection");
					await context.select(botId, p.sessionId);
				} else {
					if (typeof p.operationId !== "string")
						throw new Error("Stable context operation ID required");
					if (command === "project-note") {
						if (typeof p.body !== "string")
							throw new Error("Invalid Project note");
						if (typeof p.sessionId !== "string")
							throw new Error("Explicit Project note target required");
						if (!p.target || typeof p.generation !== "number")
							throw new Error(
								"Explicit Project note target and generation required",
							);
						await context.addMemory(botId, p.body, p.operationId, p.sessionId, {
							target: p.target as import("./context-target").ContextTarget,
							generation: p.generation,
						});
					} else {
						if (typeof p.name !== "string")
							throw new Error("Invalid context name");
						if (command === "project-create")
							await context.createProject(botId, p.name, p.operationId);
						else {
							if (typeof p.projectId !== "string")
								throw new Error("Invalid Project identity");
							await context.createSession(
								botId,
								p.projectId,
								p.name,
								p.operationId,
							);
						}
					}
				}
				return state();
			}
			if (command === "add-bot") runtime.addBot(p);
			else if (command === "focus") runtime.updateLife(id(), p);
			else if (command === "chat") {
				if (
					typeof p.prompt !== "string" ||
					typeof p.requestId !== "string" ||
					!/^[a-zA-Z0-9-]{1,150}$/.test(p.requestId)
				)
					throw Error("Invalid local chat request");
				if (typeof p.sessionId !== "string")
					throw new Error("Invalid conversation target");
				await runtime.chat(
					id(),
					p.prompt,
					p.requestId,
					p.sessionId,
					p.previewToken,
				);
			} else if (["add-bot", "focus", "chat"].includes(command))
				throw Error("Invalid command");
			if (["add-bot", "focus", "chat"].includes(command)) {
				if (command === "chat") void runtime.tick().catch(console.error);
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
				if (mode() === "chat") {
					if (typeof p.sessionId !== "string")
						throw new Error("Explicit conversation target required");
					await runtime.chat(
						id(),
						p.prompt,
						p.requestId,
						p.sessionId,
						p.previewToken,
					);
				} else {
					runtime.checkPreview(id(), p.prompt, mode(), p.previewToken);
					runtime.submit(id(), p.prompt, p.requestId, mode());
				}
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
				if (
					typeof p.botId !== "string" ||
					typeof p.sessionId !== "string" ||
					typeof p.token !== "string"
				)
					throw new Error("Explicit approval target and token required");
				runtime.answerApproval({
					id: id(),
					botId: p.botId,
					sessionId: p.sessionId,
					token: p.token,
					allow: p.allow,
				});
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
			void runtime.tick().catch(console.error);
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
	ready = true;
	show();
	timer = setInterval(() => void runtime.tick().catch(console.error), 1000);
	void runtime.tick().catch(console.error);
}
void app
	.whenReady()
	.then(startHost)
	.catch(async (error) => {
		console.error(
			"Nest startup failed; existing work and recovery evidence were preserved",
			error,
		);
		try {
			await runtime?.close();
		} catch (cleanupError) {
			console.error("Failed to close startup resources", cleanupError);
		}
		app.exit(1);
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
	void Promise.resolve(runtime?.close()).then(
		() => app.exit(0),
		(error) => {
			console.error("Failed to close the work store", error);
			app.exit(1);
		},
	);
});
