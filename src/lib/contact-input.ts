import { z } from "zod";
export const contactInput = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.email("Enter a valid email address.").trim().max(254),
  phone: z.string().trim().max(30).default(""),
  subject: z.enum([
    "General Enquiry",
    "Booking Assistance",
    "Vehicle Enquiry",
    "Existing Reservation",
    "Other",
  ]),
  message: z
    .string()
    .trim()
    .min(10, "Please add a little more detail to your message.")
    .max(5000),
  website: z.string().max(200).optional().default(""),
});
