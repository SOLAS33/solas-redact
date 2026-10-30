import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, PDFName, PDFString, StandardFonts, degrees } from "pdf-lib";
import { strToU8, zipSync } from "fflate";

export const SECRETS = {
  name: "Seán Murphy",
  email: "sean.murphy@example.ie",
  phone: "087 123 4567",
  pps: "1234567TA",
  iban: "IE29 AIBK 9311 5212 3456 78",
  date: "14/03/2025",
  eircode: "D02 X285",
  project: "Project Falcon",
  formValue: "murphy-secret",
  attachment: "secret attachment Murphy",
  link: "https://secret.example.ie/murphy",
  title: "Confidential: Murphy settlement",
  author: "Jane Doe Solicitors",
  subject: "Murphy v Acme",
  creator: "Test Suite Creator",
  producer: "Test Producer XYZ",
  rotatedName: "Declan Doyle",
};

export interface Fixtures {
  dir: string;
  contract: string;
  scanPdf: string;
  notes: string;
  mail: string;
  letter: string;
  sheet: string;
  rotated: string;
  /** Where each term sits on page 1 of the contract, for the box-accuracy check. */
  geometry: { pageW: number; pageH: number; font: number; x: number; baselineFromTop: number; before: string; term: string };
}

/** A picture of text (made in the browser, so it needs no image library) is passed in as PNG bytes. */
export async function makeFixtures(dir: string, scanPng: Uint8Array): Promise<Fixtures> {
  mkdirSync(dir, { recursive: true });
  const W = 612;
  const H = 792;

  // ---- contract.pdf: real text, standard fonts, hidden extras ----
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([W, H]);
  const x = 72;
  const size = 12;
  const line = (page: ReturnType<typeof doc.addPage>, y: number, text: string) => page.drawText(text, { x, y, size, font });
  const before = "Settlement agreement between ";
  line(p1, 700, `${before}${SECRETS.name} and Acme Ltd`);
  line(p1, 680, `Contact: ${SECRETS.email} or ${SECRETS.phone}`);
  line(p1, 660, `PPS number ${SECRETS.pps}, IBAN ${SECRETS.iban}`);
  line(p1, 640, "Keep this paragraph: nothing sensitive here at all.");
  const p2 = doc.addPage([W, H]);
  line(p2, 700, `${SECRETS.name} signed on ${SECRETS.date} at ${SECRETS.eircode}.`);
  line(p2, 600, `Reference: ${SECRETS.project} is confidential.`);
  const p3 = doc.addPage([W, H]);
  line(p3, 700, "Nothing to hide on this page except the word Falcon.");

  const form = doc.getForm();
  const tf = form.createTextField("secretField");
  tf.setText(SECRETS.formValue);
  tf.addToPage(p1, { x, y: 560, width: 200, height: 20 });
  const link = doc.context.obj({ Type: "Annot", Subtype: "Link", Rect: [72, 695, 200, 712], Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(SECRETS.link) } });
  p1.node.set(PDFName.of("Annots"), doc.context.obj([...(p1.node.Annots()?.asArray() ?? []), doc.context.register(link)]));
  await doc.attach(strToU8(SECRETS.attachment), "notes.txt", { mimeType: "text/plain" });
  doc.setTitle(SECRETS.title);
  doc.setAuthor(SECRETS.author);
  doc.setSubject(SECRETS.subject);
  doc.setKeywords(["murphy", "falcon"]);
  doc.setCreator(SECRETS.creator);
  doc.setProducer(SECRETS.producer);
  const contract = join(dir, "contract.pdf");
  writeFileSync(contract, await doc.save());

  // ---- scan.pdf: a page that is only a picture ----
  const sdoc = await PDFDocument.create();
  const img = await sdoc.embedPng(scanPng);
  const sp = sdoc.addPage([612, 220]);
  sp.drawImage(img, { x: 0, y: 0, width: 612, height: 220 });
  const scanPdf = join(dir, "scan.pdf");
  writeFileSync(scanPdf, await sdoc.save());
  writeFileSync(join(dir, "scan.png"), scanPng);

  // ---- text, email, Word, and one that is not supported ----
  const notes = join(dir, "notes.txt");
  writeFileSync(notes, `Dear ${SECRETS.name},\n\nYour PPS number is ${SECRETS.pps}.\nWe will write to ${SECRETS.eircode}.\n\nRegards\n`);
  const mail = join(dir, "mail.eml");
  writeFileSync(
    mail,
    [
      `From: "${SECRETS.name}" <${SECRETS.email}>`,
      "To: office@example.ie",
      "Subject: Meeting about the file",
      "Date: Thu, 30 Oct 2026 10:00:00 +0000",
      'Content-Type: text/plain; charset="utf-8"',
      "",
      `Hello, please call ${SECRETS.phone} about ${SECRETS.project}.`,
      "",
    ].join("\r\n")
  );
  const docxXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Letter of offer</w:t></w:r></w:p><w:p><w:r><w:t>${SECRETS.name} lives at ${SECRETS.eircode}. Phone ${SECRETS.phone}.</w:t></w:r></w:p></w:body></w:document>`;
  const letter = join(dir, "letter.docx");
  writeFileSync(
    letter,
    zipSync({
      "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`),
      "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
      "word/document.xml": strToU8(docxXml),
    })
  );
  // ---- rotated.pdf: a page turned a quarter turn ----
  const rdoc = await PDFDocument.create();
  const rfont = await rdoc.embedFont(StandardFonts.Helvetica);
  const rp = rdoc.addPage([W, H]);
  rp.setRotation(degrees(90));
  rp.drawText(`Name: ${SECRETS.rotatedName} here`, { x: 72, y: 700, size: 12, font: rfont });
  const rotated = join(dir, "rotated.pdf");
  writeFileSync(rotated, await rdoc.save());

  const sheet = join(dir, "budget.xlsx");
  writeFileSync(sheet, strToU8("PK not really a spreadsheet"));

  return { dir, contract, scanPdf, notes, mail, letter, sheet, rotated, geometry: { pageW: W, pageH: H, font: size, x, baselineFromTop: H - 700, before, term: SECRETS.name } };
}

/** Width in points of a prefix of the first contract line, from the standard Helvetica metrics. */
export async function helveticaWidth(text: string, size: number): Promise<number> {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  return f.widthOfTextAtSize(text, size);
}
