import { test } from "node:test";
import assert from "node:assert/strict";
import { emailHtml, message, smsNumber } from "../src/lib/notify/templates";
const booking = {
  reference: "AN-ABC123",
  customerName: "Ama Mensah",
  pickup: new Date("2026-12-01T09:00:00Z"),
  returnAt: new Date("2026-12-03T09:00:00Z"),
  location: "Accra · Airport pickup",
  total: 300000,
  vehicle: { name: "Toyota Camry" },
};
test("formats Ghana numbers the way SMSOnlineGH expects", () => {
  assert.equal(smsNumber("024 123 4567"), "233241234567");
  assert.equal(smsNumber("+233 24 123 4567"), "233241234567");
  assert.equal(smsNumber("233241234567"), "233241234567");
  assert.equal(smsNumber("241234567"), "233241234567");
  assert.equal(smsNumber("+44 7700 900123"), "447700900123");
  assert.equal(smsNumber("12345"), null);
});
test("writes customer and operations messages for each event", () => {
  const confirmed = message("BOOKING_CONFIRMED", "customer", booking)!;
  assert.match(confirmed.subject, /AN-ABC123 is confirmed/);
  assert.match(confirmed.text, /Hello Ama/);
  assert.match(confirmed.text, /Toyota Camry/);
  assert.ok(confirmed.sms.length <= 160 * 2, "SMS stays within two parts");
  const ops = message("CANCELLATION_REQUESTED", "operations", booking)!;
  assert.match(ops.subject, /Cancellation requested · AN-ABC123/);
  assert.equal(message("PICKUP_REMINDER", "operations", booking), null);
});
test("escapes customer text in HTML email", () => {
  const html = emailHtml('Hello <script>alert("x")</script>\n\nBye');
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
});
