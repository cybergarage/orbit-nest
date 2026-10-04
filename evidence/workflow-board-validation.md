# 2D workflow validation on secondary M4

- Base: merged main 2efa87b5dc9a52d471ae260b8de1f201afe4813d. Isolated feat/workflow-board checkout. Repository visibility was read as PUBLIC; no visibility or licensing operation performed.
- Companion cards and task filters project existing Orbit runs, attempts, occurrences and schedules. No new persistent activity ledger. Chat completion wording cannot change a run state or produce a saved receipt.
- Unsubmitted previews expose supported action, prompt, scope and limits. Main revalidates the prompt/mode/profile/source token before send/schedule. Profile/source changes require a fresh preview.
- Owned Stop pauses only owned routines and cancels only owned queued/running/approval work. Read cancellation remains cooperative; opaque interruption remains unknown and is not automatically replayed. Other Companions' work stays untouched.
- Final lint/types/build, 9 unit tests, 3 native and 3 packaged Electron UI tests pass. Pinned archive and installed-core verification pass.
- UI checks cover result receipt focus, failed-text claims remaining failed, state filters/keyboard controls, unknown and approval survival across restart, cross-Companion stop/selection, stale previews, repeated Send clicks, and 390px width without horizontal overflow. Empty/offline model paths use deterministic synthetic unit fixtures; no existing Ollama service was stopped.
- Actual installed local gemma4:12b produced initial and changed manuscript reviews across restart, keeping two results on retry. Scheduled SIGKILL after capture recovered one visible result across two attempts with the same request ID and no interrupted baseline. See writing-live.json and crash-live.json.
- Screenshots and source fixtures are synthetic. User history, configuration and manuscript files were not migrated or reset.
- Shared core, website/NUC resources and other Orbit branches are unchanged. External review remains off.

Limits: unsigned development package; local plaintext state bounded to 16 MiB; fixed interval/coalesce scheduling; no arbitrary effect preview, external transactions, cloud inference, source writing, 3D, trading or autonomous multi-Companion delegation. A saved model response is not proof of an external action.
