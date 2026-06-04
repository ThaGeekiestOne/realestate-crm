export interface GoldenQuery {
  query: string;
  expectedKeywords: string[];
  expectedMaxResults: number;
}

export const goldenDataset: GoldenQuery[] = [
  { query: "3BHK apartment near Golf Course Road under 1.5 crore", expectedKeywords: ["Golf Course", "3"], expectedMaxResults: 10 },
  { query: "villa with garden Sohna Road", expectedKeywords: ["villa", "Sohna"], expectedMaxResults: 10 },
  { query: "affordable 2BHK flat New Gurgaon", expectedKeywords: ["2", "Gurgaon"], expectedMaxResults: 10 },
  { query: "plot for construction under 50 lakhs", expectedKeywords: ["plot"], expectedMaxResults: 10 },
  { query: "luxury penthouse with pool", expectedKeywords: ["penthouse", "pool"], expectedMaxResults: 10 },
  { query: "1BHK studio apartment under 30 lakhs", expectedKeywords: ["1"], expectedMaxResults: 10 },
  { query: "ready to move apartment sector 56", expectedKeywords: ["sector", "ready"], expectedMaxResults: 10 },
  { query: "row house with parking Golf Course Extension", expectedKeywords: ["Golf Course"], expectedMaxResults: 10 },
  { query: "4BHK independent house DLF", expectedKeywords: ["DLF", "4"], expectedMaxResults: 10 },
  { query: "furnished studio near cyber city", expectedKeywords: ["cyber"], expectedMaxResults: 10 },
];
