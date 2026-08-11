import { LegalPageLayout } from "../components/LegalPageLayout";

const CONTACT = {
  business: "MalluCupid",
  address: "456, Gautam Nagar, JP Nagar 7th Phase, Bengaluru, Karnataka 560078, India",
  grievanceAddress:
    "4, 5 & 6, Kothnur Main Rd, Nayak Layout, JP Nagar 7th Phase, J. P. Nagar, Bengaluru, Karnataka 560076, India",
  email: "support@mallucupid.com",
  infoEmail: "info@mallucupid.com",
  phone: "+91-9581150441",
  site: "www.mallucupid.com",
};

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      intro={`Effective from: 22-07-2026 · Last updated: 22-07-2026. Welcome to MalluCupid. These Terms of Service govern your use of the MalluCupid website and services at ${CONTACT.site}.`}
    >
      <section>
        <h2 className="text-xl font-semibold text-zinc-900">About MalluCupid</h2>
        <p>
          The Platform is owned, managed and operated under the name <strong>{CONTACT.business}</strong>, doing business at{" "}
          <strong>{CONTACT.address}</strong>.
        </p>
        <p className="mt-3">
          <strong>MalluCupid Features:</strong> MalluCupid is a web-based platform that enables creators to publish free and paid digital media (photos and videos), manage a public creator profile, chat with fans, and receive payments for paid unlocks (collectively, “MalluCupid Features”).
        </p>
        <p className="mt-3">
          <strong>Content:</strong> Any media, captions, messages, profile information, or other material created or uploaded by a Creator or User on the Platform is “Content.”
        </p>
        <p className="mt-3">
          <strong>Fans / Users:</strong> Individuals who browse creator pages, follow creators, unlock paid posts, and message creators are “Fans,” “Users,” or “Subscribers” under these Terms.
        </p>
        <p className="mt-3">
          <strong>MalluCupid Services:</strong> Facilitation of Content publishing, paid unlocks, messaging, wallets, withdrawals, and related features offered on the Platform are the “Services.”
        </p>
        <p className="mt-3">
          MalluCupid functions solely as a platform service provider and intermediary. We do not create Creator Content and are not a party to the underlying Content transaction between Creators and Fans, except as facilitator of payments and platform access.
        </p>
        <p className="mt-3">
          By accessing or using MalluCupid, you accept these Terms of Service. If you do not agree, do not use the website or Services.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">1. Conditions of Use</h2>
        <p>
          These Terms of Service (“Agreement”) are a contract between You and MalluCupid, doing business at{" "}
          <strong>{CONTACT.address}</strong>. Other than as stated expressly, there are no third-party beneficiaries of this contract.
        </p>
        <p className="mt-3">
          These terms apply to individuals creating Content on the Platform (“Creators”) and those using the Platform as Fans (“Users”), collectively “You,” “Your,” or “User(s).” References to “MalluCupid,” “we,” “us,” and “our” mean the MalluCupid platform operated from India.
        </p>
        <p className="mt-3">
          These Terms, together with our Privacy Policy and Refund Policy, govern your relationship with MalluCupid. Updated versions may be published on the Platform; continued use after changes constitutes acceptance.
        </p>
        <p className="mt-3">
          You represent that you have full authority to enter this Agreement and that doing so does not violate any other agreement to which you are a party. You are solely responsible for ensuring your use of the Platform does not violate any laws, regulations, or third-party rights.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">2. User Accounts</h2>
        <p>
          To use certain features you must register and create an account. You represent that registration information is complete, true, and accurate, and you agree to update it when it changes. Account creation is free for Creators and Fans.
        </p>
        <p className="mt-3">
          You are responsible for all activity under your Account. We may disable any username, password, or identifier if we believe you violated this Agreement or applicable law.
        </p>
        <h3 className="mt-4 text-base font-semibold text-zinc-900">Information collected for registration</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Creators:</strong> name/email, unique username and password, optional bio, avatar, location, and social links.
          </li>
          <li>
            <strong>Fans:</strong> name, email, and password (and related verification data as required).
          </li>
        </ul>
        <p className="mt-3">Please read our Privacy Policy for how we handle personal data.</p>
        <h3 className="mt-4 text-base font-semibold text-zinc-900">Age restriction</h3>
        <p>
          You must be at least <strong>18 years of age</strong> to sign up, access, or use the Platform. By registering you give explicit consent and confirm you meet this requirement. Persons under 18 may not register or use MalluCupid.
        </p>
        <h3 className="mt-4 text-base font-semibold text-zinc-900">Compatible devices</h3>
        <p>
          You must use a compatible computer, phone, or other device and maintain supported software. Requirements may change over time. Access via mobile networks may incur carrier data charges.
        </p>
        <h3 className="mt-4 text-base font-semibold text-zinc-900">Passwords and security</h3>
        <p>
          Your Account is personal. Do not share credentials. Take reasonable steps to keep passwords confidential, especially on public or shared devices. If your password is compromised, change it immediately or contact us at{" "}
          <strong>{CONTACT.email}</strong> so we can help secure the account.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">3. Payments</h2>
        <p>
          To process purchases and payouts we use third-party payment providers. Online payments on MalluCupid are processed through <strong>Razorpay Software Private Limited</strong>. Razorpay is an independent provider and may charge fees and require personal data to process transactions. Review Razorpay’s terms and privacy policy. MalluCupid is not affiliated with Razorpay as principal for their services, and Razorpay is not our employee or agent for all purposes.
        </p>
        <p className="mt-3">
          When purchasing paid Content you may be redirected to Razorpay-hosted checkout. We do not store complete debit/credit card numbers, CVV, UPI PIN, or full banking credentials. You are responsible for charges incurred through your chosen payment method. MalluCupid is not liable for lost, stolen, or incorrectly processed payments caused solely by the payment provider’s acts or omissions, except as required by applicable law.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">4. Creators on MalluCupid</h2>
        <h3 className="text-base font-semibold text-zinc-900">Content</h3>
        <p>
          Creators must categorize and present Content appropriately and comply with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and other applicable Indian laws. Creators shall not upload Content that promotes or depicts illegal sexual content involving minors, human trafficking, extreme violence, hate speech, or other unlawful material. Fans should report violative Content to our Grievance Officer.
        </p>
        <h3 className="mt-4 text-base font-semibold text-zinc-900">Creator accounts &amp; public pages</h3>
        <p>
          After registration, Creators receive a public profile URL based on their username and serial. Creators retain ownership of their Content but grant MalluCupid a limited license to host, display, transmit, and promote that Content as needed to operate the Platform.
        </p>
        <p className="mt-3">
          MalluCupid grants Creators a limited, non-exclusive, non-transferable, non-sublicensable license to access and use the Platform for personal and commercial purposes consistent with this Agreement. You may not copy, sell, or exploit the Platform itself or our proprietary systems.
        </p>
        <h3 className="mt-4 text-base font-semibold text-zinc-900">Creator pricing &amp; platform charges</h3>
        <p>
          Creators set prices for paid posts at their sole discretion (“Creator Fee”). Fans pay the Creator Fee to unlock paid Content. MalluCupid may charge Creators a platform service charge on withdrawals, as calculated by the Platform and disclosed at the time of withdrawal. Creators are solely responsible for taxes arising from their sales.
        </p>
        <h3 className="mt-4 text-base font-semibold text-zinc-900">Creators based in India (GST)</h3>
        <p>
          Indian Creators who cross applicable GST registration thresholds must register with GST authorities and comply with GST rules. You agree to follow GST guidelines and absolve MalluCupid of liability arising from your GST non-compliance, except where we are legally required to collect or remit tax.
        </p>
        <h3 className="mt-4 text-base font-semibold text-zinc-900">Withdrawals</h3>
        <p>
          Creators may request withdrawal of available earnings to a verified bank account subject to Platform rules (including any holding period after a sale is paid, minimum withdrawal amounts, and admin processing). MalluCupid may reject or delay withdrawals that appear fraudulent or incomplete.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">5. Fans / Users on MalluCupid</h2>
        <p>
          After registration, Fans may follow creators, unlock paid posts, and message Creators subject to messaging and request rules. MalluCupid grants Fans a limited, non-exclusive license to access the Platform for personal use. You may not assign or sublicense this license, or resell, redistribute, or commercially exploit unlocked Content unless the Creator expressly permits it.
        </p>
        <p className="mt-3">
          You are not obligated to purchase any Content. Access to paid Content is subject to successful payment and Creator terms. MalluCupid acts as intermediary/facilitator and is not responsible for Creator Content quality except as required by law. Provide accurate payment information and authority to use the payment method.
        </p>
        <p className="mt-3">
          Digital Content is delivered electronically. Purchases of digital Content are generally non-cancellable once access is granted, subject to our Refund Policy and applicable consumer law. For cancellation or refund questions, email <strong>{CONTACT.email}</strong>.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">6. Access to the Platform</h2>
        <p>
          You may need a suitable internet connection and browser. If you access via mobile network, your carrier’s rates apply. By using MalluCupid you agree to receive service-related updates as needed for security and functionality.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">7. Communication on the Platform</h2>
        <p>
          We may remove Content or links that violate Indian law, our policies, or are reported as illegal or harmful, without prior notice, and may take action against the related account. Messaging and chats are User Content: we do not endorse them; you are responsible for what you send.
        </p>
        <p className="mt-3">
          Sale of paid Content is a direct contract between Creator and Fan. MalluCupid facilitates the Platform and payment rails but does not control the substance of Creator–Fan dealings beyond Platform rules.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">8. Disclaimer of Warranties</h2>
        <p>
          THE PLATFORM, CONTENT, AND MATERIALS ARE PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE FULLEST EXTENT PERMITTED BY LAW, MALLUCUPID AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, OR THAT CONTENT WILL BE ACCURATE OR RELIABLE.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">9. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, MalluCupid shall not be liable for indirect, incidental, special, consequential, or punitive damages, or loss of profits, data, goodwill, or business opportunities, arising from your use of the Platform, even if advised of the possibility. Our aggregate liability for claims relating to the Services shall not exceed the greater of (a) fees you paid to MalluCupid (excluding Creator Fees remitted to Creators) in the three months preceding the claim, or (b) INR 5,000, except where liability cannot be limited under applicable law.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">10. Content Liability &amp; Indemnification</h2>
        <p>
          Creators are solely responsible for their Content, ownership, and legality. Fans are responsible for how they use unlocked Content. You agree to indemnify and hold harmless MalluCupid, its officers, and agents from claims, damages, and expenses (including reasonable legal fees) arising from your Content, your breach of this Agreement, or your violation of law or third-party rights.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">11. Intellectual Property</h2>
        <p>
          MalluCupid’s branding, logos, software, UI, and proprietary materials remain our property. You may not use our trademarks in a confusing or disparaging manner without written consent. Creators retain rights in their Content subject to the licenses granted herein. Feedback you submit may be used by us without obligation to you.
        </p>
        <h3 className="mt-4 text-base font-semibold text-zinc-900">Copyright complaint / takedown</h3>
        <p>
          If you believe your IP rights are infringed, contact us at <strong>{CONTACT.email}</strong> with complete details. We may remove access to Content we reasonably believe infringes rights and may notify the affected User.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">12. Changes to Terms</h2>
        <p>
          MalluCupid may revise these Terms at any time. Continued use after changes are posted constitutes acceptance. We may also change fees, features, or practices at our discretion, subject to notice where required by law.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">13. MalluCupid’s Rights</h2>
        <p>We reserve the right to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Remove accounts or Content that violate this Agreement;</li>
          <li>Deny access, terminate contracts, and report misconduct where you violate law, infringe rights, or harm our legitimate interests;</li>
          <li>Modify, suspend, or refuse Services;</li>
          <li>Retain copies of Content after termination for limited lawful purposes under a non-exclusive license.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">14. User Rights</h2>
        <p>
          Users have rights under applicable Indian data protection law, including the Digital Personal Data Protection Act, 2023, as applicable. You may request account deletion by emailing <strong>{CONTACT.email}</strong>. After deletion, Content may become unavailable and irrecoverable. Creators must clear pending obligations and inform relevant Fans where appropriate before deletion.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">15. Termination or Suspension</h2>
        <p>
          We may suspend or terminate your account for Agreement violations. We will generally notify you of the reason, except where notification would violate law, compromise an investigation or platform security, or cause harm. Suspension or termination does not entitle you to compensation, and does not waive fees already owed.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">16. Disputes, Governing Law &amp; Jurisdiction</h2>
        <p>
          Disputes arising from this Agreement should first be addressed through good-faith discussion or alternate dispute resolution where appropriate. These Terms are governed by the laws of India. Subject to applicable law, courts in <strong>Bengaluru, Karnataka, India</strong> shall have jurisdiction. Applicable frameworks may include the Consumer Protection Act, 2019; DPDPA, 2023; IT Act, 2000; and the IT Intermediary Guidelines Rules, 2021, as amended.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">17. Miscellaneous</h2>
        <p>
          <strong>Creator–Fan relationship:</strong> MalluCupid is not responsible for disputes, claims, or damages arising solely from Creator–Fan interactions or reliance on Creator Content.
        </p>
        <p className="mt-3">
          <strong>Privacy:</strong> We do not sell your personal data for monetary consideration. See our Privacy Policy. Creators may receive limited Fan information needed to fulfil a purchase (e.g. that an unlock occurred).
        </p>
        <p className="mt-3">
          <strong>Communications:</strong> By providing email and phone, you consent to receive service notices and transactional communications. Carrier charges for SMS/calls are your responsibility.
        </p>
        <p className="mt-3">
          <strong>Assignment / waiver / severability / force majeure:</strong> You may not assign this Agreement without our consent; we may assign it. Failure to enforce a provision is not a waiver. Invalid provisions are severed. Neither party is liable for failure due to force majeure events beyond reasonable control.
        </p>
        <p className="mt-3">
          <strong>Illegal or abusive conduct:</strong> Users must behave respectfully. Illegal, harassing, or abusive conduct toward others is prohibited.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-900">18. Contact Us &amp; Grievance Officer</h2>
        <p>
          Complaints, abuse, or concerns regarding Content or breach of these Terms should be sent in writing or by email to the Grievance Officer:
        </p>
        <ul className="mt-3 space-y-2">
          <li><strong>Grievance Officer:</strong> Mr. Shailesh</li>
          <li><strong>Business:</strong> {CONTACT.business}</li>
          <li><strong>Website:</strong> {CONTACT.site}</li>
          <li><strong>Registered / business address:</strong> {CONTACT.address}</li>
          <li><strong>Grievance correspondence address:</strong> {CONTACT.grievanceAddress}</li>
          <li><strong>Email:</strong> {CONTACT.email} / {CONTACT.infoEmail}</li>
          <li><strong>Phone:</strong> {CONTACT.phone}</li>
        </ul>
        <p className="mt-3">
          We will make reasonable efforts to acknowledge and address genuine grievances in accordance with applicable law.
        </p>
      </section>
    </LegalPageLayout>
  );
}
