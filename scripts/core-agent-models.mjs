// Every Nest managed run injects the explicitly selected local model.
export {
	Message,
	MessageType,
} from "@cybergarage/orbit/dist/core/message/message.js";
export function getModel() {
	throw new Error("Nest requires an explicitly injected local model");
}
