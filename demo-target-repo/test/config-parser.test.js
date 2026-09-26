import test from "node:test";
import assert from "node:assert/strict";
import { parseHost, parseLogLevel, parsePortConfig, loadConfig } from "../src/config-parser.js";

test("parseHost defaults to localhost for empty input", () => {
  assert.equal(parseHost(""), "127.0.0.1");
  assert.equal(parseHost(undefined), "127.0.0.1");
  assert.equal(parseHost("  0.0.0.0  "), "0.0.0.0");
});

test("parseLogLevel returns normalized allowed levels", () => {
  assert.equal(parseLogLevel("DEBUG"), "debug");
  assert.equal(parseLogLevel("warn"), "warn");
  assert.equal(parseLogLevel("INVALID"), "info");
});

test("parsePortConfig handles valid numeric string ports", () => {
  assert.equal(parsePortConfig("8080"), 8080);
  assert.equal(parsePortConfig("  443  "), 443);
});

test("parsePortConfig rejects negative or out-of-range ports", () => {
  assert.throws(() => parsePortConfig("-1"), /Invalid port/);
  assert.throws(() => parsePortConfig("70000"), /Invalid port/);
  assert.throws(() => parsePortConfig("abc"), /Invalid port/);
});
