// Server-only helpers: mock SEFAZ data, XML building and ZIP packaging.

export type MockInvoice = {
  access_key: string;
  number: string;
  series: string;
  doc_type: string;
  direction: string;
  issuer_name: string;
  issuer_cnpj: string;
  recipient_name: string;
  recipient_cnpj: string;
  issued_at: string;
  total_amount: number;
  status: string;
  xml_content: string;
};

const COMPANIES: Array<[string, string]> = [
  ["Comercial Aurora Ltda", "12345678000190"],
  ["Distribuidora Bandeirante S/A", "23456789000181"],
  ["Metalúrgica Serra Azul Ltda", "34567890000172"],
  ["Padaria Bela Vista ME", "45678901000163"],
  ["Transportes Rio Claro Ltda", "56789012000154"],
  ["Tech Insumos do Brasil Ltda", "67890123000145"],
  ["Atacado Vale Verde Ltda", "78901234000136"],
  ["Farmácia Central EIRELI", "89012345000127"],
];

const PRODUCTS = [
  "Papel A4 75g - Caixa",
  "Cabo HDMI 2m",
  "Cimento CP-II 50kg",
  "Óleo lubrificante 1L",
  "Notebook 14 polegadas",
  "Café torrado e moído 500g",
  "Parafuso sextavado M8",
  "Monitor LED 24 polegadas",
];

function pad(value: number, size: number) {
  return String(value).padStart(size, "0");
}

function formatCnpj(cnpj: string) {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

export function buildXml(invoice: Omit<MockInvoice, "xml_content">, items: Array<{ name: string; qty: number; unit: number }>) {
  const itemsXml = items
    .map(
      (item, index) => `      <det nItem="${index + 1}">
        <prod>
          <xProd>${item.name}</xProd>
          <qCom>${item.qty.toFixed(4)}</qCom>
          <vUnCom>${item.unit.toFixed(2)}</vUnCom>
          <vProd>${(item.qty * item.unit).toFixed(2)}</vProd>
        </prod>
      </det>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00">
  <NFe>
    <infNFe Id="${invoice.doc_type}${invoice.access_key}" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <natOp>${invoice.direction === "entrada" ? "Compra de mercadoria" : "Venda de mercadoria"}</natOp>
        <mod>${invoice.doc_type === "NFCe" ? "65" : "55"}</mod>
        <serie>${invoice.series}</serie>
        <nNF>${invoice.number}</nNF>
        <dhEmi>${invoice.issued_at}</dhEmi>
        <tpNF>${invoice.direction === "entrada" ? "0" : "1"}</tpNF>
      </ide>
      <emit>
        <CNPJ>${invoice.issuer_cnpj}</CNPJ>
        <xNome>${invoice.issuer_name}</xNome>
      </emit>
      <dest>
        <CNPJ>${invoice.recipient_cnpj}</CNPJ>
        <xNome>${invoice.recipient_name}</xNome>
      </dest>
${itemsXml}
      <total>
        <ICMSTot>
          <vNF>${invoice.total_amount.toFixed(2)}</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <chNFe>${invoice.access_key}</chNFe>
      <xMotivo>${invoice.status}</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;
}

export function generateMockInvoices(options: {
  from: string;
  to: string;
  count: number;
  ownerName: string;
  ownerCnpj: string;
  seed: number;
}): MockInvoice[] {
  const start = new Date(options.from).getTime();
  const end = new Date(options.to).getTime();
  const span = Math.max(end - start, 86_400_000);
  let seed = options.seed || 1;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  const invoices: MockInvoice[] = [];
  for (let i = 0; i < options.count; i += 1) {
    const company = COMPANIES[Math.floor(random() * COMPANIES.length)]!;
    const isInbound = random() < 0.5;
    const docType = random() < 0.3 ? "NFCe" : "NFe";
    const issuedAt = new Date(start + Math.floor(random() * span)).toISOString();
    const itemCount = 1 + Math.floor(random() * 3);
    const items = Array.from({ length: itemCount }, () => ({
      name: PRODUCTS[Math.floor(random() * PRODUCTS.length)]!,
      qty: 1 + Math.floor(random() * 10),
      unit: Number((15 + random() * 900).toFixed(2)),
    }));
    const total = Number(items.reduce((sum, item) => sum + item.qty * item.unit, 0).toFixed(2));
    const number = pad(1000 + Math.floor(random() * 89999), 6);
    const accessKey = `35${issuedAt.slice(2, 4)}${issuedAt.slice(5, 7)}${company[1]}${docType === "NFCe" ? "65" : "55"}001${number}${pad(Math.floor(random() * 99999999), 8)}${Math.floor(random() * 10)}`.slice(0, 44);

    const base = {
      access_key: accessKey,
      number,
      series: "001",
      doc_type: docType,
      direction: isInbound ? "entrada" : "saida",
      issuer_name: isInbound ? company[0] : options.ownerName,
      issuer_cnpj: isInbound ? company[1] : options.ownerCnpj,
      recipient_name: isInbound ? options.ownerName : company[0],
      recipient_cnpj: isInbound ? options.ownerCnpj : company[1],
      issued_at: issuedAt,
      total_amount: total,
      status: random() < 0.08 ? "Cancelada" : "Autorizada",
    };

    invoices.push({ ...base, xml_content: buildXml(base, items) });
  }

  return invoices;
}

export function formatCnpjLabel(cnpj: string) {
  return cnpj.length === 14 ? formatCnpj(cnpj) : cnpj;
}

// ---- minimal store-only ZIP writer (no native deps) ----

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

export function buildZipBase64(files: Array<{ name: string; content: string }>): string {
  const encoder = new TextEncoder();
  const entries = files.map((file) => ({
    nameBytes: encoder.encode(file.name),
    data: encoder.encode(file.content),
  }));

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + entry.nameBytes.length);
    const localView = new DataView(local.buffer);
    writeU32(localView, 0, 0x04034b50);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    writeU32(localView, 14, crc);
    writeU32(localView, 18, entry.data.length);
    writeU32(localView, 22, entry.data.length);
    localView.setUint16(26, entry.nameBytes.length, true);
    local.set(entry.nameBytes, 30);
    localParts.push(local, entry.data);

    const central = new Uint8Array(46 + entry.nameBytes.length);
    const centralView = new DataView(central.buffer);
    writeU32(centralView, 0, 0x02014b50);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    writeU32(centralView, 16, crc);
    writeU32(centralView, 20, entry.data.length);
    writeU32(centralView, 24, entry.data.length);
    centralView.setUint16(28, entry.nameBytes.length, true);
    writeU32(centralView, 42, offset);
    central.set(entry.nameBytes, 46);
    centralParts.push(central);

    offset += local.length + entry.data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeU32(endView, 0, 0x06054b50);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  writeU32(endView, 12, centralSize);
  writeU32(endView, 16, offset);

  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    out.set(part, cursor);
    cursor += part.length;
  }

  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < out.length; i += chunk) {
    binary += String.fromCharCode(...out.subarray(i, i + chunk));
  }
  return btoa(binary);
}
