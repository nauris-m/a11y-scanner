import axe, { AxeResults, Result, RunOptions } from 'axe-core';
import { AccessibilityIssue, ScanResult, ScanOptions } from '../types';

export class AccessibilityScanner {
  private static instance: AccessibilityScanner;

  private constructor() {}

  public static getInstance(): AccessibilityScanner {
    if (!AccessibilityScanner.instance) {
      AccessibilityScanner.instance = new AccessibilityScanner();
    }
    return AccessibilityScanner.instance;
  }

  public async scan(options?: ScanOptions): Promise<ScanResult> {
    try {
      const results: AxeResults = await axe.run(
        document as unknown as Element,
        {
          rules: options?.rules?.reduce((acc, rule) => {
            acc[rule] = { enabled: true };
            return acc;
          }, {} as Record<string, { enabled: boolean }>),
          disableRules: options?.exclude,
        } as RunOptions
      );

      const issues: AccessibilityIssue[] = results.violations.map((violation: Result) => ({
        type: violation.id,
        impact: (violation.impact as "minor" | "moderate" | "serious" | "critical") || "minor",
        description: violation.description,
        element: violation.nodes[0].html,
        location: {
          path: String(violation.nodes[0].target[0]),
          selector: violation.nodes[0].target.join(' '),
        },
        recommendation: violation.help,
      }));

      const summary = this.generateSummary(issues);

      return {
        timestamp: Date.now(),
        url: window.location.href,
        issues: issues.slice(0, options?.maxIssues || issues.length),
        summary,
      };
    } catch (error) {
      console.error('Scanning failed:', error);
      throw new Error('Failed to complete accessibility scan');
    }
  }

  private generateSummary(issues: AccessibilityIssue[]) {
    return issues.reduce(
      (acc, issue) => {
        acc.total++;
        acc[issue.impact]++;
        return acc;
      },
      { total: 0, critical: 0, serious: 0, moderate: 0, minor: 0 }
    );
  }
} 