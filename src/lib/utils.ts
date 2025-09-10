import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseCsv<T>(csvText: string): T[] {
  const lines = csvText.trim().split(/\r\n|\n/); // Handles both windows and unix line endings
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map(h => h.trim());
  
  const keyMap: Record<string, string> = {
      '학교': 'school',
      '학년': 'grade',
      '반': 'classNum',
      '번호': 'studentNum',
      '이름': 'name'
  };

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return header.reduce((obj, key, index) => {
      const newKey = keyMap[key] || key;
      (obj as any)[newKey] = values[index];
      return obj;
    }, {} as T);
  }).filter(obj => (obj as any).name); // Ensure there's at least a name
}

export function exportToCsv(filename: string, rows: object[]) {
  if (!rows || rows.length === 0) {
    return;
  }
  const header = Object.keys(rows[0]);
  const csv = [
    header.join(','),
    ...rows.map(row => header.map(fieldName => {
        const value = (row as any)[fieldName];
        if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
        }
        return value;
    }).join(','))
  ].join('\r\n');

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
