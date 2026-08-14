export interface TrashBinData {
  id: string;
  lat: number;
  lng: number;
  name?: string | null;
  description?: string | null;
  binType: string;
  level: number;
  exp: number;
  usageExp: number;
  knowledgeExp: number;
  supportExp: number;
  useCount: number;
  riskScore: number;
  imageUrl?: string | null;
  status: string;
  source: string;
  osmId?: string | null;
  createdAt: string;
}

export interface ReportData {
  id: string;
  userId: string;
  trashBinId?: string | null;
  lat: number;
  lng: number;
  imageUrl?: string | null;
  reportType: string;
  aiResult?: string | null;
  aiPassed: boolean;
  pointsEarned: number;
  status: string;
  createdAt: string;
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  totalPoints: number;
  createdAt: string;
}

export interface RankingEntry {
  id: string;
  name: string;
  totalPoints: number;
  reportCount: number;
}

export interface AiJudgmentResult {
  hasTrashBin: boolean;
  binType: string;
  confidence: number;
  isValid: boolean;
  reason: string;
}
