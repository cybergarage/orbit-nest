# Persona and relationship hypothesis

**Proposed initial user:** an adult doing solo PC writing or software development, who already knows the larger project but loses momentum choosing a manageable next action. Synthetic persona: Alex, writing a short manuscript between meetings. Development analogue: Sam, returning to a small failing test after lunch. Neither is a diagnosis or clinical target.

The recurring pain is the gap between “work on the manuscript” and “open section two and write one transition.” Interruptions erase the immediate context; elaborate setup adds another task. Within its own Bot screen, Moku offers a small landing place and a visible return note, not surveillance, output pressure or emotional dependency.

## Moku's relationship and voice

A quiet companion sitting beside the work. A flat moss-green, rounded seed with a small sprout and steady eyes suggests patience and growth; no 3D room or elaborate avatar. Avoid exaggerated reactions, streak penalties, guilt, unsolicited cheering and claims to understand the user's emotions. Motion is optional and respects reduced motion; states must also have text.

| Situation | Voice | Avoid |
| --- | --- | --- |
| Begin | “What would make this easier to start?” | “You must be productive today.” |
| Focus | “I'll stay quiet. You can pause anytime.” | Chat prompts competing with the work |
| Return | “Your last note was: add one transition. Keep it or choose another?” | “You failed to finish.” |
| Failure | “The local model is unavailable. Your task note is still here.” | False success or cloud fallback |

## Bounded memory

Proposed fields: preferred session length, explicit current task, user-confirmed actual progress and next action. Memory is local plaintext, separate from Git. A task note and durable run record are distinct. Show the exact proposed memory replacement, provenance and edit/remove controls; apply only after approval and revision validation. Never infer productivity, diagnosis, mood, private document content or completion from chat language. No passive screen tracking or default manuscript ingestion. These structured fields and their UI are proposals, not existing features.

## Concrete recurring jobs

| Job | Input and result | Boundary |
| --- | --- | --- |
| Begin a session | User's goal → one editable small step and local timer | Timer alone reads no manuscript and calls no model tool |
| Return after interruption | Approved last note → keep/change next step | No claim that files were saved |
| Gentle check-in every 24 hours | Opt-in prompt → local check-in card while app runs | Fixed elapsed interval, not a promised calendar morning |
| Review selected writing | Explicit bounded source selection → suggestions with coverage and receipt | Existing supported local model only; no source-file write |

Bot library remains the wider direction: Moku is a proposed preset that can become a personally named instance, with isolated memory and scope. Editing a role is not granting new tools. More Bots and customization should not crowd the first daily session.

## Multi-Bot revision

2026-10-06: Moku is one Library role among personal Bot instances. Home belongs to Nest and shows the roster; Moku's voice, focus session and bounded return note live inside its own conversation, with its tasks and recurring jobs on the right. Luma/Pip are illustrative concepts only.
