# Journey A.I &mdash; Domain & Architectural Context

## Domain Vocabulary

- **Course**: An academic unit or subject containing lessons, events, readings, and associated documents.
- **Event**: A task or assessment (assignment, exam, quiz, project, reading, lab) associated with a course, carrying due dates, estimated effort, weight, and completion status.
- **Lesson**: A scheduled lecture or class session within a course.
- **Reading**: An assigned article, book chapter, or textbook section linked to a course.
- **Document**: Full-text file uploaded to the Library (syllabus, lecture notes, textbook), chunked for retrieval.
- **Chunk**: A segment of document text indexed by the BM25 retrieval engine.
- **ChatMessage**: An exchange in the study tutor dialogue between user, assistant, or system.
- **StudyPlan**: Generated schedule of study blocks allocating time across upcoming deadlines.

## Architectural Vocabulary

- **Store (Deep Module)**: Owns the persistent schema, storage quota monitoring, IndexedDB mirroring, and atomic entity mutations (`courses`, `events`, `lessons`, `readings`, `documents`, `chat`, `settings`). Emits in-process `change` events on every mutation and guarantees automatic persistence.
- **Seam**: The interface between modules. 
  - *Store &rarr; Router Seam*: `Store.on('change', Router.scheduleRender)` allows the UI to stay reactive without action handlers coupling to the view layer.
  - *Action Delegation Seam*: `data-act` attributes on DOM elements routed declaratively through `actions-delegation.js` to semantic action handlers.
- **Locality**: Concentrating related invariants (e.g. course deletion cascading to its events, lessons, readings, and document chunks) inside the Store rather than scattering array mutations across multiple action files and modals.
- **Leverage**: Action handlers and modals shrink to single semantic method calls (`Store.courses.remove(id)`), hiding persistence, cascade cleanup, and change notifications behind one deep interface.
