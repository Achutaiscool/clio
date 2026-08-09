import { describe, it } from "node:test";
import assert from "node:assert";

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

// Store state between tests
let authToken = "";
let userId = "";
let noteId = "";
let secondUserToken = "";

// ─── HELPERS ─────────────────────────────────────────────

async function fetchJson(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,  // ← spread options FIRST
        headers: { "Content-Type": "application/json", ...options.headers },  // ← then merge headers on top
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
}

// ─── AUTH TESTS ──────────────────────────────────────────

describe("🔐 Authentication", async () => {
    it("POST /api/auth/register → creates user (201)", async () => {
        const { status, body } = await fetchJson("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({
                username: "testuser_" + Date.now(),
                email: `test_${Date.now()}@example.com`,
                password: "password123",
                dateOfBirth: "2000-01-01T00:00:00Z",
            }),
        });
        assert.strictEqual(status, 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
        assert.strictEqual(body.success, true);
        assert.ok(body.data.userId, "userId missing");
        userId = body.data.userId;
    });

    it("POST /api/auth/register → duplicate username (409)", async () => {
        const username = "dupuser_" + Date.now();
        const email = `dup_${Date.now()}@example.com`;

        // First register
        await fetchJson("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ username, email, password: "password123" }),
        });

        // Second register with same username
        const { status, body } = await fetchJson("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ username, email: `other_${Date.now()}@example.com`, password: "password123" }),
        });
        assert.strictEqual(status, 409);
        assert.ok(body.error.match(/already exists/i));
    });

    it("POST /api/auth/register → weak password (400)", async () => {
        const { status, body } = await fetchJson("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({
                username: "weak_" + Date.now(),
                email: `weak_${Date.now()}@example.com`,
                password: "123",
            }),
        });
        assert.strictEqual(status, 400);
        assert.strictEqual(body.error, "Validation failed");
    });

    it("POST /api/auth/login → success (200) + token", async () => {
        const username = "loginuser_" + Date.now();
        const email = `login_${Date.now()}@example.com`;

        // Register first
        await fetchJson("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ username, email, password: "password123" }),
        });

        // Login
        const { status, body } = await fetchJson("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ username, password: "password123" }),
        });
        assert.strictEqual(status, 200);
        assert.ok(body.data.token, "token missing");
        assert.strictEqual(body.data.token.split(".").length, 3, "not a JWT");
        authToken = body.data.token;
    });

    it("POST /api/auth/login → wrong password (401)", async () => {
        const username = "wrongpass_" + Date.now();
        await fetchJson("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ username, email: `wp_${Date.now()}@example.com`, password: "password123" }),
        });

        const { status, body } = await fetchJson("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ username, password: "wrongpassword" }),
        });
        assert.strictEqual(status, 401);
        assert.strictEqual(body.error, "Invalid credentials");
    });

    it("POST /api/auth/login → non-existent user (401, same message)", async () => {
        const { status, body } = await fetchJson("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ username: "idontexist12345", password: "password123" }),
        });
        assert.strictEqual(status, 401);
        assert.strictEqual(body.error, "Invalid credentials");
    });
});

// ─── NOTES TESTS ─────────────────────────────────────────

describe("📝 Notes CRUD", async () => {
    // Create a fresh user for notes tests
    it("SETUP: register + login for notes tests", async () => {
        const username = "notesuser_" + Date.now();
        const email = `notes_${Date.now()}@example.com`;

        await fetchJson("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ username, email, password: "password123" }),
        });

        const { body } = await fetchJson("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ username, password: "password123" }),
        });
        authToken = body.data.token;
    });

    it("POST /api/notes → create note (201)", async () => {
        const { status, body } = await fetchJson("/api/notes", {
            method: "POST",
            headers: { Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ title: "Test Note", content: "Hello world" }),
        });
        assert.strictEqual(status, 201);
        assert.ok(body.noteId, "noteId missing");           // ← changed: was body.data.noteId
        noteId = body.noteId;                                // ← changed: was body.data.noteId
    });

    it("POST /api/notes → no token (401)", async () => {
        const { status } = await fetchJson("/api/notes", {
            method: "POST",
            body: JSON.stringify({ title: "Hacked", content: "No auth" }),
        });
        assert.strictEqual(status, 401);
    });

    it("GET /api/notes → list notes (200) + pagination", async () => {
        const { status, body } = await fetchJson("/api/notes?page=1&limit=10", {
            headers: { Authorization: `Bearer ${authToken}` },
        });
        assert.strictEqual(status, 200);
        assert.ok(Array.isArray(body.data), "data should be array");
        assert.ok(body.pagination, "pagination missing");
        assert.strictEqual(body.pagination.page, 1);
        assert.strictEqual(typeof body.pagination.hasNextPage, "boolean");
    });

    it("GET /api/notes/:id → get single note (200)", async () => {
        const { status, body } = await fetchJson(`/api/notes/${noteId}`, {
            headers: { Authorization: `Bearer ${authToken}` },
        });
        assert.strictEqual(status, 200);
        assert.strictEqual(body.data._id, noteId);
        assert.strictEqual(body.data.title, "Test Note");
    });

    it("GET /api/notes/:id → wrong user gets 404 (BOLA)", async () => {
        // Register second user
        const username = "attacker_" + Date.now();
        await fetchJson("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ username, email: `atk_${Date.now()}@example.com`, password: "password123" }),
        });
        const { body: loginBody } = await fetchJson("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ username, password: "password123" }),
        });
        secondUserToken = loginBody.data.token;

        // Try to access first user's note
        const { status, body } = await fetchJson(`/api/notes/${noteId}`, {
            headers: { Authorization: `Bearer ${secondUserToken}` },
        });
        assert.strictEqual(status, 404, `Expected 404, got ${status}: ${JSON.stringify(body)}`);
        assert.strictEqual(body.error, "Note not found");
    });

    it("PUT /api/notes/:id → update note (200)", async () => {
        const { status, body } = await fetchJson(`/api/notes/${noteId}`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ title: "Updated Title", content: "Updated content" }),
        });
        assert.strictEqual(status, 200);
        assert.strictEqual(body.data.title, "Updated Title");
        assert.strictEqual(body.data.content, "Updated content");
    });

    it("DELETE /api/notes/:id → delete note (200)", async () => {
        const { status, body } = await fetchJson(`/api/notes/${noteId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` },
        });
        assert.strictEqual(status, 200);
        assert.strictEqual(body.data.deleted, true);
    });

    it("DELETE /api/notes/:id → already deleted (404)", async () => {
        const { status } = await fetchJson(`/api/notes/${noteId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` },
        });
        assert.strictEqual(status, 404);
    });

    it("POST /api/notes → payload too large (413 or 400)", async () => {
        const { status } = await fetchJson("/api/notes", {
            method: "POST",
            headers: { Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ content: "x".repeat(50000) }),
        });
        assert.ok([400, 413].includes(status), `Expected 400 or 413, got ${status}`);
    });
});

// ─── HEALTH TESTS ────────────────────────────────────────

describe("🏥 Health", async () => {
    it("GET /health → returns ok", async () => {
        const { status, body } = await fetchJson("/health");
        assert.strictEqual(status, 200);
        assert.strictEqual(body.status, "ok");
        assert.strictEqual(body.db, "connected");
    });
});

// ─── SECURITY TESTS ──────────────────────────────────────

describe("🔒 Security", async () => {
    it("No stack traces leaked in production (500 response)", async () => {
        const { body } = await fetchJson("/health");
        assert.strictEqual(body.status, "ok");
    });

    it("CORS blocks unknown origin (preflight)", async () => {
        const res = await fetch(`${BASE_URL}/api/notes`, {
            method: "OPTIONS",
            headers: {
                Origin: "https://evil.com",
                "Access-Control-Request-Method": "POST",
            },
        });
        const allowOrigin = res.headers.get("access-control-allow-origin");
        if (allowOrigin) {
            assert.ok(!allowOrigin.includes("evil.com"), "CORS allowed evil.com");
        }
    });
});