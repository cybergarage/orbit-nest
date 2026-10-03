import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("nest", {
	call: (command: string, input: unknown = {}) =>
		ipcRenderer.invoke("nest:call", command, input),
});
