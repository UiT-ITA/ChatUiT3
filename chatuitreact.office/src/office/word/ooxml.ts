/** Flat OPC packages, the OOXML format of Word's getOoxml and insertOoxml. */

export interface PackagePart {
  /** The part name, such as "/word/charts/chart1.xml". */
  name: string;
  contentType: string;
  /** XML content without an XML declaration, or Base64 for a binary part. */
  xml?: string;
  base64?: string;
}

const RELATIONSHIPS_TYPE = "application/vnd.openxmlformats-package.relationships+xml";
const RELATIONSHIP_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
export const OFFICE_RELATIONSHIP = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** Namespaces declared on the document part, so body fragments can use any of the common prefixes. */
const DOCUMENT_NAMESPACES = [
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
  `xmlns:r="${OFFICE_RELATIONSHIP}"`,
  'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
  'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"',
  'xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"',
  'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"',
  'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"',
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"',
  'xmlns:v="urn:schemas-microsoft-com:vml"',
  'xmlns:o="urn:schemas-microsoft-com:office:office"',
  'xmlns:w10="urn:schemas-microsoft-com:office:word"',
  'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"',
  'xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"',
  'mc:Ignorable="w14 wp14"',
].join(" ");

export function relationship(id: string, type: string, target: string): string {
  return `<Relationship Id="${id}" Type="${OFFICE_RELATIONSHIP}/${type}" Target="${target}"/>`;
}

export function relationshipsXml(relationships: string[]): string {
  return `<Relationships xmlns="${RELATIONSHIP_NS}">${relationships.join("")}</Relationships>`;
}

/** A flat OPC package whose document body is `bodyXml`, with extra parts and document relationships. */
export function flatPackage(bodyXml: string, documentRelationships: string[] = [], parts: PackagePart[] = []): string {
  const allParts: PackagePart[] = [
    {
      name: "/_rels/.rels",
      contentType: RELATIONSHIPS_TYPE,
      xml: relationshipsXml([relationship("rId1", "officeDocument", "word/document.xml")]),
    },
    {
      name: "/word/document.xml",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
      xml: `<w:document ${DOCUMENT_NAMESPACES}><w:body>${bodyXml}</w:body></w:document>`,
    },
    ...(documentRelationships.length > 0
      ? [
          {
            name: "/word/_rels/document.xml.rels",
            contentType: RELATIONSHIPS_TYPE,
            xml: relationshipsXml(documentRelationships),
          },
        ]
      : []),
    ...parts,
  ];
  const partsXml = allParts
    .map((part) =>
      part.base64 !== undefined
        ? `<pkg:part pkg:name="${part.name}" pkg:contentType="${part.contentType}" pkg:compression="store">` +
          `<pkg:binaryData>${part.base64}</pkg:binaryData></pkg:part>`
        : `<pkg:part pkg:name="${part.name}" pkg:contentType="${part.contentType}">` +
          `<pkg:xmlData>${part.xml ?? ""}</pkg:xmlData></pkg:part>`
    )
    .join("");
  return (
    '<?xml version="1.0" standalone="yes"?><?mso-application progid="Word.Document"?>' +
    `<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">${partsXml}</pkg:package>`
  );
}

export function isFlatPackage(ooxml: string): boolean {
  return /<pkg:package[\s>]/.test(ooxml);
}

/**
 * A full flat OPC package as is, or a body fragment wrapped in a package. A fragment that does not
 * start with a paragraph, table or block content control is wrapped in a paragraph.
 */
export function toFlatPackage(ooxml: string): string {
  if (isFlatPackage(ooxml)) {
    return ooxml;
  }
  const fragment = ooxml.trim();
  return flatPackage(/^<w:(p|tbl|sdt)[\s>]/.test(fragment) ? fragment : `<w:p>${fragment}</w:p>`);
}

/** The names of the package's parts. */
export function partNames(packageXml: string): string[] {
  return Array.from(packageXml.matchAll(/<pkg:part\b[^>]*\bpkg:name="([^"]+)"/g), (match) => match[1]);
}

/** The content of the `w:body` of the package's document part, or null when it has none. */
export function documentBody(packageXml: string): string | null {
  const part = packageXml.indexOf('pkg:name="/word/document.xml"');
  if (part < 0) {
    return null;
  }
  const open = /<w:body(?:\s[^>]*)?>/g;
  open.lastIndex = part;
  const start = open.exec(packageXml);
  const end = packageXml.indexOf("</w:body>", part);
  return start && end > start.index ? packageXml.slice(start.index + start[0].length, end) : null;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
