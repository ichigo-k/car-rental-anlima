import type { Metadata } from "next";
import Image from "next/image";
import { Footer } from "@/components/header";
import { MarketingHero, MarketingCta } from "@/components/anlima-pages";
import { ContactForm } from "@/components/contact-form";
export const metadata: Metadata = { title: "Contact Us" };
export default function ContactPage() {
  return (
    <>
      <main className="anlima-marketing-page">
        <MarketingHero page="contact" />
        <section className="anlima-contact-details">
          <div className="design-container">
            <div>
              <p className="eyebrow">GET IN TOUCH</p>
              <h2>Let’s Start a Conversation</h2>
              <p>
                Whether you’re planning your next trip or need assistance with
                an existing booking, we’re happy to hear from you. Reach out
                using the details below or send us a message through the contact
                form.
              </p>
              <dl>
                {[
                  [
                    "contact-Frame186.svg",
                    "Call Us",
                    "Speak with our team about bookings and general enquiries.",
                    "[Your official phone number]",
                  ],
                  [
                    "contact-Frame187.svg",
                    "Email Us",
                    "Send us your questions and we’ll get back to you.",
                    "[Your official email address]",
                  ],
                  [
                    "Group180.svg",
                    "Our Location",
                    "Visit us for enquiries and assistance.",
                    "[Your official business address]",
                  ],
                  [
                    "Group181.svg",
                    "Business Hours",
                    "We’re available during our regular business hours.",
                    "[Your confirmed operating days and hours]",
                  ],
                ].map(([icon, title, copy, value]) => (
                  <div key={title}>
                    <span className="contact-detail-icon">
                      <img src={`/images/figma/${icon}`} alt="" />
                    </span>
                    <div>
                      <dt>{title}</dt>
                      <dd>
                        {copy}
                        <strong>{value}</strong>
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
            <div className="anlima-contact-photo">
              <Image
                src="/images/figma/contact-support-agent.png"
                alt="ANLIMA customer support representative ready to help"
                fill
                sizes="(max-width: 760px) 100vw, 48vw"
              />
            </div>
          </div>
        </section>
        <section className="anlima-contact-form-section" id="send-message">
          <div className="contact-form-heading">
            <p className="eyebrow">SEND US A MESSAGE</p>
            <h2>Let’s Start a Conversation</h2>
            <p>
              Whether you’re planning your next trip or need assistance with an
              existing booking, we’re happy to hear from you.
            </p>
          </div>
          <ContactForm />
        </section>
        <MarketingCta variant="contact" />
      </main>
      <Footer />
    </>
  );
}
