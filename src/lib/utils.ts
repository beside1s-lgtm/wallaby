import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const universalKeyMap: Record<string, string> = {
    // Student
    '학교': 'school',
    '학년': 'grade',
    '반': 'classNum',
    '번호': 'studentNum',
    '이름': 'name',
    '성별': 'gender',
    '접속코드': 'accessCode',
    // Promotion
    '새 학년': 'newGrade',
    '새 반': 'newClassNum',
    '새 번호': 'newStudentNum',
    // Record
    '측정종목': 'item',
    '기록': 'value',
    '측정일': 'date'
};

export function parseCsv<T>(csvText: string): T[] {
  const lines = csvText.trim().split(/\r\n|\n/);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return header.reduce((obj, key, index) => {
      const newKey = universalKeyMap[key] || key;
      if (newKey !== 'accessCode') { // accessCode is now auto-generated, so we ignore it from CSV
        (obj as any)[newKey] = values[index];
      }
      return obj;
    }, {} as T);
  }).filter(obj => Object.values(obj as any).some(val => val !== '' && val !== null && val !== undefined));
}

function convertToCsv(rows: object[]): string {
    if (!rows || rows.length === 0) {
        return "";
    }
    const header = Object.keys(rows[0]);
    return [
        header.join(','),
        ...rows.map(row => header.map(fieldName => {
            const value = (row as any)[fieldName];
            if (typeof value === 'string' && value.includes(',')) {
                return `"${value}"`;
            }
            return value;
        }).join(','))
    ].join('\r\n');
}

export function exportToCsv(filename: string, rows: object[]) {
  const csv = convertToCsv(rows);
  if (!csv) return;

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function exportToExcel(filename: string, rows: object[]) {
  if (!rows || rows.length === 0) return;
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export async function parseExcel<T>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
      
      const parsed = jsonData.map(row => {
        return Object.entries(row).reduce((obj, [key, value]) => {
          const newKey = universalKeyMap[key.trim()] || key.trim();
          if (newKey !== 'accessCode') {
            (obj as any)[newKey] = String(value).trim();
          }
          return obj;
        }, {} as T);
      });
      resolve(parsed);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export async function exportToZip(filename: string, files: { name: string, data: object[] }[]) {
  const zip = new JSZip();
  
  files.forEach(file => {
      // Use CSV for inside Zip if necessary, or just use XLSX for everything.
      // But for templates, let's just make them separate XLSX files if they are multiple?
      // Actually, let's keep CSV inside ZIP for now OR change it to multiple XLSX if needed.
      // The user wants XLSX for templates. Let's make them separate XLSX if requested?
      // Let's just update exportToZip to pack XLSX files instead.
      const worksheet = XLSX.utils.json_to_sheet(file.data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      zip.file(file.name.replace('.csv', '.xlsx'), excelBuffer);
  });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
      const url = URL.createObjectURL(zipBlob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }
}
