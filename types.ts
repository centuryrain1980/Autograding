
export enum FileStatus {
  PENDING = 'Pending',
  PROCESSING = 'Processing',
  COMPLETED = 'Graded',
  ERROR = 'Error'
}

export enum ModelProvider {
  GEMINI = 'Gemini',
  CUSTOM = 'Custom / OpenAI Compatible'
}

export interface GradingDetailItem {
  name: string;      // e.g., "Chapter 1", "Logic", "Grammar"
  score?: string;    // e.g., "10/10", "A", "Good"
  feedback?: string; // Specific feedback for this item
}

export interface GradingResult {
  score: string;     // Changed from number to string to support "A", "95", "Pass"
  maxScore: string;  // Changed from number to string
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string;
  details?: GradingDetailItem[]; // New field for chapter/criteria breakdown
}

export interface HomeworkFile {
  id: string;
  name: string;
  type: string;
  size: number;
  base64Data?: string;
  textContent?: string;
  status: FileStatus;
  result?: GradingResult;
  errorMessage?: string;
}

export interface AppSettings {
  apiKey: string;
  modelProvider: ModelProvider;
  customBaseUrl?: string;
  modelName: string;
}

export interface GradingContextType {
  files: HomeworkFile[];
  addFiles: (newFiles: File[]) => Promise<void>;
  removeFile: (id: string) => void;
  updateFileStatus: (id: string, status: FileStatus, result?: GradingResult, error?: string) => void;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  rubric: string;
  setRubric: (rubric: string) => void;
  startBatchGrading: () => Promise<void>;
  reGradeFile: (id: string) => Promise<void>;
  isGrading: boolean;
}
