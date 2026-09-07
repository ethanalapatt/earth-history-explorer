import test from "node:test";
import assert from "node:assert/strict";
import { parseHistoryHtml, handleApi } from "../server/history.js";
test("full history preserves section prose without executing upstream markup", () => {
  const sections = parseHistoryHtml(
    `<div class="mw-parser-output"><p>A useful introduction about this place and its people.</p><div class="mw-heading mw-heading2"><h2>Early settlement<span class="mw-editsection">edit</span></h2></div><p>Settlers established a trading center in this region.<sup class="reference">[1]</sup></p><script>alert('unsafe')</script><table><tr><td><p>Table text should not be repeated in the history.</p></td></tr></table><h2>References</h2><p>This reference list should never appear as narrative.</p><h3>Bibliography</h3><p>Another excluded section containing book titles.</p></div>`,
  );
  assert.deepEqual(sections, [
    {
      title: "Overview",
      paragraphs: ["A useful introduction about this place and its people."],
    },
    {
      title: "Early settlement",
      paragraphs: ["Settlers established a trading center in this region."],
    },
  ]);
});
test("a city article yields only history and its subsections", () => {
  const sections = parseHistoryHtml(
    "<p>This is the introductory city description, not the history.</p><h2>Etymology</h2><p>Its name derives from an ancient river nearby.</p><h2>History</h2><p>The first settlements grew near a sheltered harbor.</p><h3>Modern era</h3><p>The port expanded as shipping routes became established.</p><h2>Geography</h2><p>The city is located on a peninsula by the coast.</p>",
    { historyOnly: true },
  );
  assert.equal(sections.length, 2);
  assert.equal(sections[0].title, "History");
  assert.equal(sections[1].title, "Modern era");
  assert.ok(!JSON.stringify(sections).includes("peninsula"));
});
test("a page with no history section returns an honest empty result", () => {
  assert.deepEqual(
    parseHistoryHtml(
      "<h2>Geography</h2><p>The city lies beside a river in a mountainous province.</p>",
      { historyOnly: true },
    ),
    [],
  );
});
test("history endpoint only accepts catalog IDs and GET requests", async () => {
  const response = () => ({
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    writeHead(code) {
      this.status = code;
      return this;
    },
    end(body) {
      this.body = JSON.parse(body);
    },
  });
  const unknown = response();
  await handleApi(
    { method: "GET" },
    unknown,
    new URL("http://localhost/api/history?id=https://localhost/private"),
  );
  assert.equal(unknown.status, 400);
  const post = response();
  await handleApi(
    { method: "POST" },
    post,
    new URL("http://localhost/api/history?id=IND"),
  );
  assert.equal(post.status, 405);
});
