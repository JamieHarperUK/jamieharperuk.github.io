import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker, { buildNotifyPayload } from "../src";

describe("Hello World worker", () => {
	it("responds with Hello World! (unit style)", async () => {
		const request = new Request("http://example.com");
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`
			"{
			  "ok": false,
			  "error": "Not found"
			}"
		`);
	});

	it("responds with Hello World! (integration style)", async () => {
		const response = await SELF.fetch("http://example.com");
		expect(await response.text()).toMatchInlineSnapshot(`
		"{
		  "ok": false,
		  "error": "Not found"
		}"
	`);
	});

	it("builds a game notification payload from the latest decided result", () => {
		const payload = buildNotifyPayload({
			latestResult: {
				homeTeam: "Alpha",
				awayTeam: "Beta",
				homeScore: "2",
				awayScore: "1",
				winner: "Alpha",
				date: "01-08-2026",
				time: "20:00",
				competition: "League"
			},
			commitSha: "abc123"
		}, "fm");

		expect(payload.title).toContain("Alpha");
		expect(payload.title).toContain("Beta");
		expect(payload.body).toContain("2-1");
		expect(payload.data.url).toContain("#team/");
	});
});
