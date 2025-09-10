import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseCsv<T>(csvText: string): T[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return header.reduce((obj, key, index) => {
      // Simple transform from Korean to expected keys
      let newKey = key;
      if (key === '학년') newKey = 'grade';
      if (key === '반') newKey = 'classNum';
      if (key === '번호') newKey = 'studentNum';
      if (key === '이름') newKey = 'name';

      obj[newKey as keyof T] = values[index] as any;
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
    ...rows.map(row => header.map(fieldName => JSON.stringify(row[fieldName])).join(','))
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
