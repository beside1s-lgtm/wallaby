import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import JSZip from 'jszip';

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
    'accessCode': 'accessCode',
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
      (obj as any)[newKey] = values[index];
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

export async function exportToZip(filename: string, files: { name: string, data: object[] }[]) {
  const zip = new JSZip();
  
  files.forEach(file => {
      const csvData = convertToCsv(file.data);
      if (csvData) {
          zip.file(file.name, `\uFEFF${csvData}`);
      }
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
