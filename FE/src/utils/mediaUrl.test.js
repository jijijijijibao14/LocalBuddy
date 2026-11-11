import test from "node:test";
import assert from "node:assert/strict";
import { resolveMediaUrl } from "./mediaUrl.js";

const id = "0123456789abcdef01234567";

test("resolves new and legacy MongoDB media paths against the current backend", () => {
  for (const base of ["http://172.20.10.2:3001/api", "https://api.example.com/api/"]) {
    const root = base.replace(/\/api\/?$/, "");
    assert.equal(resolveMediaUrl(`/media/${id}`, base), `${root}/media/${id}`);
    assert.equal(resolveMediaUrl(`http://192.168.1.12:3001/media/${id}?v=1`, base), `${root}/media/${id}?v=1`);
  }
});

test("preserves external images and absolute legacy upload URLs", () => {
  const base = "https://api.example.com/api";
  assert.equal(resolveMediaUrl("https://images.example.com/photo.jpg", base), "https://images.example.com/photo.jpg");
  assert.equal(resolveMediaUrl("https://old.example.com/uploads/photo.jpg", base), "https://old.example.com/uploads/photo.jpg");
  assert.equal(resolveMediaUrl("/placeholder.jpg", base), "/placeholder.jpg");
  assert.equal(resolveMediaUrl("/uploads/photo.jpg", base), "https://api.example.com/uploads/photo.jpg");
  assert.equal(resolveMediaUrl("", base), "");
});

test("requires a configured backend for stored media paths", () => {
  assert.throws(() => resolveMediaUrl(`/media/${id}`, ""), /VITE_API_URL/);
});
