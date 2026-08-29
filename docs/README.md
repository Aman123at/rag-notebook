# Diagrams

## `architecture.excalidraw`

A high-level architecture diagram of the whole system: the Next.js client, the
strictly layered Express API, the data plane (Postgres + Qdrant + Redis), the
Inngest background jobs, and the external services each integration wraps —
plus two side panels that expand the ingestion pipeline and a single chat turn.

`architecture.png` is a rendered preview of the same file.

**To open or edit it:** drag the `.excalidraw` file onto
[excalidraw.com](https://excalidraw.com), or open it in the Excalidraw VS Code
extension. It is plain JSON, self-contained, and has no external asset
references.

### Icon attribution

Components were taken from the public
[Excalidraw libraries](https://libraries.excalidraw.com) and embedded as native
elements:

| Library | Author | Used for |
| --- | --- | --- |
| [Software Architecture](https://libraries.excalidraw.com/?target=_blank#youritjang-software-architecture) | Youri Tjang | vector store, job pipeline, document stack |
| [Software Logos](https://libraries.excalidraw.com/?target=_blank#drwnio-drwnio) | drwnio.polyrand.net | Postgres, Redis, Docker, server rack, code |
| [IT Logos](https://libraries.excalidraw.com/?target=_blank#pclainchard-it-logos) | Pierre Clainchard | Next.js, React |
| [IT icons](https://libraries.excalidraw.com/?target=_blank#mateuszbaransanok-it-icons) | Mateusz Baran | cloud, message |
| [Architecture diagram components](https://libraries.excalidraw.com/?target=_blank#anna-pastushko-architecture-diagram-components) | Anna Pastushko | end users |
