export interface AccessibilityIssue {
  type: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  element: string;
  location: {
    path: string;
    selector: string;
  };
  recommendation: string;
}

export interface ScanResult {
  timestamp: number;
  url: string;
  issues: AccessibilityIssue[];
  summary: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

export interface ScanOptions {
  rules?: string[];
  exclude?: string[];
  maxIssues?: number;
} 