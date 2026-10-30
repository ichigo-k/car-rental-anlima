"use client";
import { useState } from "react";
import type { FormEvent } from "react";
export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "We couldn’t send your message. Please try again.",
        );
      setReference(result.reference);
      form.reset();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We couldn’t send your message. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="anlima-contact-form" onSubmit={submit} aria-busy={busy}>
      {reference && (
        <div className="contact-form-success" role="status">
          <h3>Message received.</h3>
          <p>
            Thank you for contacting ANLIMA. Your enquiry reference is{" "}
            <strong>{reference}</strong>.
          </p>
        </div>
      )}
      <label>
        Full Name
        <input
          name="name"
          placeholder="John Doe"
          autoComplete="name"
          minLength={2}
          maxLength={120}
          required
        />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          placeholder="example@gmail.com"
          autoComplete="email"
          maxLength={254}
          required
        />
      </label>
      <label>
        Phone Number (Optional)
        <input
          name="phone"
          type="tel"
          placeholder="Your phone number"
          autoComplete="tel"
          maxLength={30}
        />
      </label>
      <label>
        Enquiry Type
        <select name="subject" defaultValue="General Enquiry">
          {[
            "General Enquiry",
            "Booking Assistance",
            "Vehicle Enquiry",
            "Existing Reservation",
            "Other",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Your Message
        <textarea
          name="message"
          placeholder="How can we help you?"
          minLength={10}
          maxLength={5000}
          rows={6}
          required
        />
      </label>
      <div className="contact-honeypot" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={busy} type="submit">
        {busy ? "Sending message…" : "SUBMIT MESSAGE"}
      </button>
    </form>
  );
}
