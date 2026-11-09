import { Donation } from '../summary';

// Made-up data for the "Try sample data" button; impact figures come from the built-in EA preset.
export const SAMPLE_CONFIG = `pledge:
  percent: 10
income:
  2021: { gross: 82000, status: final }
  2022: { gross: 88000, status: final }
  2023: { gross: 95000, status: final }
  2024: { gross: 101000, status: final }
  2025: { gross: 108000, status: final }
  2026: { gross: 112000, status: estimate }
presets: ea
default_category: Other
`;

export function sampleDonations(today: string): Donation[] {
  const rows: [string, number, string, boolean?][] = [
    ['2021-12-10', 4000, 'GiveWell'],
    ['2021-12-10', 1500, 'Against Malaria Foundation'],
    ['2021-06-02', 150, 'Local food bank', false],
    ['2022-12-05', 5000, 'GiveWell'],
    ['2022-12-05', 2000, 'Animal Charity Evaluators'],
    ['2023-03-14', 1000, 'GiveDirectly'],
    ['2023-12-01', 6000, 'GiveWell'],
    ['2023-12-01', 2500, 'Animal Charity Evaluators'],
    ['2023-09-20', 100, 'Public radio', false],
    ['2024-12-03', 7000, 'GiveWell'],
    ['2024-12-03', 2000, 'Animal Charity Evaluators'],
    ['2024-05-11', 500, 'Shrimp Welfare Project'],
    ['2025-11-28', 6500, 'GiveWell'],
    ['2025-11-28', 3000, 'Against Malaria Foundation'],
    ['2025-04-02', 1500, 'GiveDirectly'],
  ];
  // A few monthly gifts this year, up to today.
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  for (let m = 1; m <= month; m++) rows.push([`${year}-${String(m).padStart(2, '0')}-15`, 400, 'GiveWell']);
  return rows.map(([date, amount, recipient, ea]) => ({
    date,
    year: Number(date.slice(0, 4)),
    amount,
    recipient,
    source: 'csv',
    ea: ea !== false,
  }));
}
