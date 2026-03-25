/*
  CONTENT GUIDE — Contact Page
  =============================
  CONTACT DETAILS:
  - Replace email, phone, and address below with real club information.
  - Replace social media links (Facebook, Instagram, Twitter) with real URLs.

  GOOGLE MAPS EMBED:
  - Go to Google Maps, find your address, click "Share" → "Embed a map".
  - Copy the src URL from the <iframe> code and paste it as `mapsEmbedSrc` below.
  - Replace the placeholder value with the real URL.

  FORM:
  - This is a static form — it does NOT submit to any server.
  - To make it functional, integrate a service such as Formspree (https://formspree.io)
    or EmailJS, or replace with a backend endpoint.
  - Example with Formspree: change <form> action attribute to your Formspree form URL.
*/

import { useState } from "react";

// TODO: Replace with real club contact details
const contactDetails = {
  email: "info@hkmastershockey.com",
  phone: "+852 1234 5678", // TODO: Replace with real phone
  address: "c/o HKFC, 1 Sports Road, Happy Valley, Hong Kong", // TODO: Replace with real address
  social: {
    facebook: "#", // TODO: Replace with real Facebook URL
    instagram: "#", // TODO: Replace with real Instagram URL
    twitter: "#",  // TODO: Replace with real Twitter/X URL
  },
};

// TODO: Replace with real Google Maps embed src URL
// How to get: Google Maps → search your address → Share → Embed a map → copy the src value
const mapsEmbedSrc = null;

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Connect this form to a real backend or form service (e.g., Formspree, EmailJS)
    // For now, this just shows a success state as a placeholder
    setSubmitted(true);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#006B3C] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold mb-3">Contact Us</h1>
          <p className="text-green-200 text-lg max-w-xl">
            Get in touch with Hong Kong Masters Hockey.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

          {/* Contact Form */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Send Us a Message</h2>
            {submitted ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-[#006B3C] rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">Message received!</h3>
                <p className="text-sm text-gray-600">
                  {/* TODO: Customise this success message */}
                  Thank you for getting in touch. We'll get back to you as soon as possible.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setFormData({ name: "", email: "", subject: "", message: "" }); }}
                  className="mt-4 text-sm text-[#006B3C] font-medium hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              /*
                TODO: To make this form functional, add an action attribute pointing to your
                form service, e.g.: <form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
              */
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/40 focus:border-[#006B3C] transition-colors duration-150"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/40 focus:border-[#006B3C] transition-colors duration-150"
                  />
                </div>
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/40 focus:border-[#006B3C] transition-colors duration-150 bg-white"
                  >
                    <option value="">Select a subject</option>
                    {/* TODO: Update or add subject options as needed */}
                    <option value="joining">Joining the Club</option>
                    <option value="sponsorship">Sponsorship Enquiry</option>
                    <option value="rotterdam">Rotterdam 2026</option>
                    <option value="media">Media Enquiry</option>
                    <option value="general">General Enquiry</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Write your message here..."
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/40 focus:border-[#006B3C] transition-colors duration-150 resize-y"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#006B3C] text-white font-semibold py-3 rounded-lg hover:bg-green-800 transition-colors duration-150"
                >
                  Send Message
                </button>
                <p className="text-xs text-gray-400 text-center">
                  {/* TODO: This form is currently a demo. Connect it to a real service before publishing. */}
                  Note: This form is currently for demonstration. Email us directly at{" "}
                  <a href={`mailto:${contactDetails.email}`} className="text-[#006B3C] hover:underline">
                    {contactDetails.email}
                  </a>
                </p>
              </form>
            )}
          </div>

          {/* Contact Details + Map */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Club Details</h2>
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-[#006B3C]/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-[#006B3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Email</p>
                  <a href={`mailto:${contactDetails.email}`} className="text-sm font-medium text-[#006B3C] hover:underline">
                    {contactDetails.email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-[#006B3C]/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-[#006B3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                  {/* TODO: Replace with real phone number */}
                  <a href={`tel:${contactDetails.phone}`} className="text-sm font-medium text-gray-800">
                    {contactDetails.phone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-[#006B3C]/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-[#006B3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Address</p>
                  {/* TODO: Replace with real club address */}
                  <p className="text-sm font-medium text-gray-800">{contactDetails.address}</p>
                </div>
              </div>
            </div>

            {/* Social Media Links */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Follow Us</h3>
              <div className="flex gap-3">
                {/* TODO: Replace # with real social media URLs in contactDetails above */}
                <a href={contactDetails.social.facebook} aria-label="Facebook" className="w-10 h-10 bg-[#006B3C]/10 rounded-lg flex items-center justify-center text-[#006B3C] hover:bg-[#006B3C] hover:text-white transition-colors duration-150">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
                  </svg>
                </a>
                <a href={contactDetails.social.instagram} aria-label="Instagram" className="w-10 h-10 bg-[#006B3C]/10 rounded-lg flex items-center justify-center text-[#006B3C] hover:bg-[#006B3C] hover:text-white transition-colors duration-150">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"/>
                  </svg>
                </a>
                <a href={contactDetails.social.twitter} aria-label="Twitter/X" className="w-10 h-10 bg-[#006B3C]/10 rounded-lg flex items-center justify-center text-[#006B3C] hover:bg-[#006B3C] hover:text-white transition-colors duration-150">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Google Maps Embed */}
            <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm">
              {mapsEmbedSrc ? (
                /* Real map — rendered when mapsEmbedSrc is set */
                <iframe
                  src={mapsEmbedSrc}
                  width="100%"
                  height="260"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Club location map"
                />
              ) : (
                /* Placeholder — TODO: add mapsEmbedSrc at the top of this file */
                <div className="h-52 bg-gray-100 flex flex-col items-center justify-center text-gray-400 gap-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <p className="text-sm font-medium">Map placeholder</p>
                  <p className="text-xs px-4 text-center">
                    {/* TODO: Embed a Google Maps iframe here */}
                    Add Google Maps embed src in the mapsEmbedSrc variable at the top of Contact.jsx
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
