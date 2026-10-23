import { describe, expect, it } from "bun:test";
import { serveStatic } from "@hono/bun";
import { createApp } from "../src/api/routes.ts";

describe("Frontend Static Delivery", () => {
  it("should serve index.html, styles.css, and app.js", async () => {
    const app = createApp();
    app.use("/*", serveStatic({ root: "./public" }));

    // Test index.html
    const indexRes = await app.request("/");
    expect(indexRes.status).toBe(200);
    const indexText = await indexRes.text();
    expect(indexText).toContain("ATS Optimizer");
    expect(indexText).toContain("7-Camadas");

    // Test styles.css
    const cssRes = await app.request("/styles.css");
    expect(cssRes.status).toBe(200);
    const cssText = await cssRes.text();
    expect(cssText).toContain("::-webkit-scrollbar");

    // Test app.js
    const jsRes = await app.request("/app.js");
    expect(jsRes.status).toBe(200);
    const jsText = await jsRes.text();
    expect(jsText).toContain("loadMasterProfile");
  });
});
