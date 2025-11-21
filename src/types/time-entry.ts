export type TimeEntry = {
  id: number;
  projectName: string;
  startTime: number;
  endTime: number;
  duration: number;
  hourlyRate: number;
  amount: number;
};

export type Invoice = {
  id: number;
  createdAt: number;
  businessInfo: string;
  billToInfo: string;
  totalHours: number;
  totalAmount: number;
  filePath: string;
  entryCount: number;
};
