import archiver from 'archiver';
import ExcelJS from 'exceljs';
import { passportFileName } from './students.js';

const HEADERS = ['Matric Number', 'Title', 'Full Name', 'Passport File', 'Date Submitted', 'Last Updated'];

function rowValues(student) {
  return [
    student.matric_number,
    student.title,
    student.full_name,
    student.has_passport ? passportFileName(student.matric_number, student.passport_mime) : 'Not uploaded',
    student.created_at,
    student.updated_at,
  ];
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(students) {
  const lines = [HEADERS.join(',')];
  for (const student of students) {
    lines.push(rowValues(student).map(csvCell).join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

export async function buildXlsx(students) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ajayi Crowther University PhD Portal';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('PhD Students', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: HEADERS[0], key: 'matric', width: 20 },
    { header: HEADERS[1], key: 'title', width: 8 },
    { header: HEADERS[2], key: 'name', width: 38 },
    { header: HEADERS[3], key: 'file', width: 24 },
    { header: HEADERS[4], key: 'created', width: 26 },
    { header: HEADERS[5], key: 'updated', width: 26 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3B5F' } };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.height = 22;

  for (const student of students) {
    sheet.addRow(rowValues(student));
  }

  sheet.autoFilter = { from: 'A1', to: 'F1' };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function buildPassportArchive(students, getPassport) {
  const archive = archiver('zip', { store: true });
  const used = new Set();

  (async () => {
    for (const student of students) {
      const record = await getPassport(student.id);
      if (!record?.passport_data) continue;

      const base = passportFileName(record.matric_number, record.passport_mime);
      let name = base;
      let counter = 1;
      while (used.has(name.toLowerCase())) {
        name = base.replace(/(\.[a-z0-9]+)$/i, `-${counter}$1`);
        counter += 1;
      }
      used.add(name.toLowerCase());
      archive.append(Buffer.from(record.passport_data), { name });
    }
    archive.finalize();
  })().catch((error) => archive.destroy(error));

  return archive;
}
