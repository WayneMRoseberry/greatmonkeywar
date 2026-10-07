# Great Monkey War — Requirements

Status: Draft. These are the foundational requirements. Gameplay has not been defined yet.

## 1. Product

- **REQ-1.1** Great Monkey War is a 2D side-scrolling game.
- **REQ-1.2** The game is distributed on Steam.

## 2. Technology and packaging

- **REQ-2.1** The game is written in HTML and JavaScript.
- **REQ-2.2** The game runs inside the minimal host needed to ship it as a Steam desktop application. The host should add as little size, complexity, and dependency weight as possible while still meeting Steam's requirements.
- **REQ-2.3** The host is Electron. Chosen for consistent rendering across platforms (bundled Chromium), maintained Steam integration (steamworks.js), Steam Deck/Linux support, and a large track record of shipped Steam games. Electron is free to use commercially (MIT license).

## 3. Separation of code and data

- **REQ-3.1** The core game engine is code. This includes rendering, physics, collision, input, audio, and the game loop.
- **REQ-3.2** Game content is defined in data files, not code. This includes levels, artwork, sprites, animations, and other content definitions.
- **REQ-3.3** Artists and level designers can create and change game content without writing or reading code.
- **REQ-3.4** Data file formats are documented so that contributors know how to author content.
- **REQ-3.5** Invalid or broken data files are detected and reported with messages a non-programmer can understand and act on.

## 4. Testing and quality gates

- **REQ-4.1** Game logic is covered by automated unit tests.
- **REQ-4.2** Unit tests can run without a browser or display. This requires game logic to be separate from rendering.
- **REQ-4.3** Unit tests run locally before code is committed.
- **REQ-4.4** Unit tests run as required checks on pull requests in the GitHub repository. A pull request cannot merge into `main` unless they pass.
- **REQ-4.5** Data file validation (REQ-3.5) runs at the same points as unit tests: before commit and as a pull request check.

## 5. Repository

- **REQ-5.1** The default branch is `main`.

## Open questions

- How Electron integrates with Steam features such as the overlay and achievements (expected approach: steamworks.js). Answer: steamworks.js
- What formats to use for levels and other content (for example JSON, or output from an existing level editor such as Tiled). Answer: JSON
- Gameplay: everything about how the game plays is still to be defined. Answer: Pending initial project setup. Implement enough code to demonstrate a player/hero that can move left, right, jump, pick things up, drop and throw, collect reward items, has obstacles with scrolling background with parallax effects, and enemies. This implementation is purely for evaluating the behavior of the core engine and understanding enough to go further on game design and iterate on architecture requirements.
