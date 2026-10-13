import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

// Define types for our accessibility issues and scan results
interface AccessibilityIssue {
  type: 'error' | 'warning';
  message: string;
  element?: string;
  fix?: string;
  selector?: string;
}

interface ScanResult {
  type: 'general' | 'tabOrder' | 'form' | 'link';
  url: string;
  timestamp: string;
  issues: AccessibilityIssue[];
}

// Add interface for executeScript result
interface ExecuteScriptResult {
  result: ScanResult;
}

type ScriptInjectionResult = chrome.scripting.InjectionResult<ScanResult>[];

interface TabOrderIssue {
  element: Element;
  expectedIndex: number;
  actualIndex: number;
  selector: string;
}

const Popup = () => {
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResult | null>(null);

  const addLog = (message: string) => {
    setDebugLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleScan = async () => {
    try {
      setScanning(true);
      setResults(null);
      setDebugLog([]);
      addLog('Starting scan...');

      // Get the current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error('No active tab found');
      }

      addLog('Found active tab: ' + tab.url);

      // Inject and execute the scanner
      const results = await chrome.scripting.executeScript<[], ScanResult>({
        target: { tabId: tab.id },
        func: (): ScanResult => {
          // Add styles for highlights
          const style = document.createElement('style');
          if (style) {
            style.textContent = `
              .a11y-error-highlight {
                outline: 2px solid red !important;
                position: relative;
              }
              .a11y-warning-highlight {
                outline: 2px solid orange !important;
                position: relative;
              }
              .a11y-issue-label {
                position: absolute;
                top: -20px;
                left: 0;
                background: #333;
                color: white;
                padding: 2px 6px;
                font-size: 12px;
                border-radius: 3px;
                z-index: 10000;
                pointer-events: none;
              }
            `;
            document.head.appendChild(style);
          }

          function generateUniqueSelector(element: Element): string {
            if (element.id) {
              return `#${element.id}`;
            }
            
            let path = [];
            let current = element;
            
            while (current) {
              let selector = current.tagName.toLowerCase();
              if (current.className) {
                selector += `.${current.className.split(' ').join('.')}`;
              }
              path.unshift(selector);
              
              if (current.id) {
                path.unshift(`#${current.id}`);
                break;
              }
              current = current.parentElement as Element;
            }
            
            return path.join(' > ');
          }

          function highlightElement(element: Element, type: 'error' | 'warning', message: string) {
            element.classList.add(type === 'error' ? 'a11y-error-highlight' : 'a11y-warning-highlight');
            
            // Add label
            const label = document.createElement('div');
            label.className = 'a11y-issue-label';
            label.textContent = message;
            element.appendChild(label);
          }

          // Basic accessibility checks
          const issues: AccessibilityIssue[] = [];
          
          try {
            // Check images for alt text
            const images = document.querySelectorAll('img');
            images.forEach(img => {
              if (!img.alt) {
                highlightElement(img, 'error', 'Missing alt text');
                issues.push({
                  type: 'error',
                  message: 'Image missing alt text',
                  element: img.outerHTML.slice(0, 100) + '...',
                  fix: 'Add alt attribute to image',
                  selector: generateUniqueSelector(img)
                });
              }
            });

            // Check heading hierarchy
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            let lastHeadingLevel = 0;
            headings.forEach(heading => {
              const level = parseInt(heading.tagName[1]);
              if (level - lastHeadingLevel > 1) {
                highlightElement(heading, 'warning', `Heading skip h${lastHeadingLevel} → h${level}`);
                issues.push({
                  type: 'warning',
                  message: `Heading skip from h${lastHeadingLevel} to h${level}`,
                  element: heading.outerHTML,
                  fix: 'Ensure heading levels are sequential',
                  selector: generateUniqueSelector(heading)
                });
              }
              lastHeadingLevel = level;
            });

            // Check for buttons without labels
            const buttons = document.querySelectorAll('button');
            buttons.forEach(button => {
              if (!button.textContent && !button.getAttribute('aria-label')) {
                highlightElement(button, 'error', 'Missing label');
                issues.push({
                  type: 'error',
                  message: 'Button has no label',
                  element: button.outerHTML,
                  fix: 'Add text content or aria-label to button',
                  selector: generateUniqueSelector(button)
                });
              }
            });

          } catch (error) {
            console.error('Error during scanning:', error);
          }

          return {
            type: 'general' as const,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            issues: issues.map(issue => ({
              type: issue.type,
              message: issue.message,
              element: issue.element,
              fix: issue.fix,
              selector: issue.selector
            }))
          };
        }
      });

      if (results?.[0]?.result) {
        const scanResults = results[0].result;
        setResults(scanResults);
        
        addLog(`Scan complete! Found ${scanResults.issues.length} issues`);
        scanResults.issues.forEach((issue: AccessibilityIssue) => {
          addLog(`${issue.type.toUpperCase()}: ${issue.message}`);
        });
      } else {
        throw new Error('Scan results are invalid');
      }

    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error(error);
    } finally {
      setScanning(false);
    }
  };

  const handleTabOrderCheck = async () => {
    try {
      setScanning(true);
      setDebugLog([]);
      setResults(null);
      addLog('Checking tab order...');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error('No active tab found');
      }

      const results: ScriptInjectionResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Add styles for tab order highlights
          const style = document.createElement('style');
          if (style) {
            style.textContent = `
              .tab-order-correct {
                outline: 1px dashed #4CAF50 !important;
                outline-offset: 2px !important;
                transition: outline-offset 0.2s ease-in-out;
              }
              .tab-order-incorrect {
                outline: 1px dashed #f44336 !important;
                outline-offset: 2px !important;
                transition: outline-offset 0.2s ease-in-out;
              }
              .tab-order-correct:focus, .tab-order-incorrect:focus {
                outline-offset: 4px !important;
              }
            `;
            document.head.appendChild(style);
          }

          // Remove previous highlights
          document.querySelectorAll('.tab-order-correct, .tab-order-incorrect').forEach(el => {
            el.classList.remove('tab-order-correct', 'tab-order-incorrect');
          });

          // Get all focusable elements
          const focusableElements = Array.from(document.querySelectorAll(
            'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
          )).filter(el => {
            const style = window.getComputedStyle(el as Element);
            return style.display !== 'none' && style.visibility !== 'hidden';
          });

          // Sort elements by tabindex
          const sortedElements = focusableElements.sort((a, b) => {
            const aIndex = a.getAttribute('tabindex');
            const bIndex = b.getAttribute('tabindex');
            
            if (aIndex === null && bIndex === null) return 0;
            if (aIndex === null) return 1;
            if (bIndex === null) return -1;
            return parseInt(aIndex) - parseInt(bIndex);
          });

          let issuesFound = 0;

          // Highlight elements based on tab order
          sortedElements.forEach((element, index) => {
            const tabindex = element.getAttribute('tabindex');
            
            if (tabindex !== null && parseInt(tabindex) !== index) {
              element.classList.add('tab-order-incorrect');
              issuesFound++;
            } else {
              element.classList.add('tab-order-correct');
            }

            // Add title attribute to show tab order info
            const currentTitle = element.getAttribute('title') || '';
            element.setAttribute('title', 
              `${currentTitle ? currentTitle + ' | ' : ''}Tab order: ${index + 1}${
                tabindex !== null ? ` (tabindex=${tabindex})` : ''
              }`
            );
          });

          const issues: AccessibilityIssue[] = sortedElements.map((element, index) => {
            const tabindex = element.getAttribute('tabindex');
            const hasIssue = tabindex !== null && parseInt(tabindex) !== index;
            
            return {
              type: hasIssue ? 'error' : 'warning',
              message: hasIssue ? 
                `Incorrect tab order (expected: ${index}, actual: ${tabindex})` : 
                `Tab order position: ${index + 1}`,
              element: element.outerHTML,
              selector: element.tagName.toLowerCase() + (element.id ? `#${element.id}` : '')
            };
          });

          return {
            type: 'tabOrder' as const,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            issues
          };
        }
      });

      if (results?.[0]?.result) {
        const scanResults = results[0].result;
        setResults(scanResults);
        addLog(`Tab order check complete! Found ${
          scanResults.issues.filter((issue: AccessibilityIssue) => issue.type === 'error').length
        } issues`);
      }
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error(error);
    } finally {
      setScanning(false);
    }
  };

  const highlightElement = async (selector: string) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) return;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selector) => {
        // Remove any existing highlights
        const existing = document.getElementById('a11y-scanner-highlight');
        if (existing) existing.remove();

        // Find and highlight the new element
        const element = document.querySelector(selector);
        if (element) {
          // Create overlay
          const rect = element.getBoundingClientRect();
          const highlight = document.createElement('div');
          highlight.id = 'a11y-scanner-highlight';
          highlight.style.position = 'fixed';
          highlight.style.zIndex = '10000';
          highlight.style.border = '2px solid red';
          highlight.style.borderRadius = '2px';
          highlight.style.top = rect.top + window.scrollY + 'px';
          highlight.style.left = rect.left + window.scrollX + 'px';
          highlight.style.width = rect.width + 'px';
          highlight.style.height = rect.height + 'px';
          highlight.style.pointerEvents = 'none';
          highlight.style.transition = 'all 0.2s ease-in-out';
          highlight.style.boxShadow = '0 0 0 4px rgba(255, 0, 0, 0.3)';
          
          document.body.appendChild(highlight);

          // Scroll element into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Remove highlight after 2 seconds
          setTimeout(() => highlight.remove(), 2000);
        }
      },
      args: [selector]
    });
  };

  useEffect(() => {
    return () => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]?.id) {
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
              // Remove styles
              const styles = document.querySelectorAll('style');
              styles.forEach(style => {
                if (style?.textContent?.includes('tab-order-correct') || 
                    style?.textContent?.includes('a11y-error-highlight') ||
                    style?.textContent?.includes('form-issue') ||
                    style?.textContent?.includes('link-issue')) {
                  style.remove();
                }
              });
              
              // Remove all highlights
              document.querySelectorAll(
                '.a11y-error-highlight, .a11y-warning-highlight, .tab-order-correct, .tab-order-incorrect, .form-issue, .link-issue'
              ).forEach(el => {
                el.classList.remove(
                  'a11y-error-highlight',
                  'a11y-warning-highlight',
                  'tab-order-correct',
                  'tab-order-incorrect',
                  'form-issue',
                  'link-issue'
                );
                el.removeAttribute('data-issue');
              });
              
              // Remove labels
              document.querySelectorAll('.a11y-issue-label').forEach(el => el.remove());
            }
          });
        }
      });
    };
  }, []);

  // Add this new handler for form accessibility checking
  const handleFormCheck = async () => {
    try {
      setScanning(true);
      setDebugLog([]);
      setResults(null);
      addLog('Checking form accessibility...');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error('No active tab found');
      }

      const results: ScriptInjectionResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Add styles for form issues
          const style = document.createElement('style');
          if (style) {
            style.textContent = `
              .form-issue {
                outline: 1px dashed #ff6b6b !important;
                position: relative;
              }
              .form-issue::after {
                content: attr(data-issue);
                position: absolute;
                top: -20px;
                left: 0;
                background: #333;
                color: white;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 12px;
                z-index: 10000;
                white-space: nowrap;
              }
            `;
            document.head.appendChild(style);
          }

          // Remove previous highlights
          document.querySelectorAll('.form-issue').forEach(el => {
            el.classList.remove('form-issue');
            el.removeAttribute('data-issue');
          });

          const formElements = Array.from(document.querySelectorAll('input, select, textarea'));
          const issues: AccessibilityIssue[] = [];

          formElements.forEach(element => {
            if (element instanceof HTMLElement) {
              const elementIssues: string[] = [];
              
              // Check for labels
              const id = element.id;
              const label = id ? document.querySelector(`label[for="${id}"]`) : null;
              const parentLabel = element.closest('label');
              
              if (!label && !parentLabel) {
                elementIssues.push('Missing label');
              }

              // Check for ARIA labels if no visible label
              if (!label && !parentLabel && !element.getAttribute('aria-label') && 
                  !element.getAttribute('aria-labelledby')) {
                elementIssues.push('No ARIA label');
              }

              // Check required fields
              if (element.hasAttribute('required') && !element.hasAttribute('aria-required')) {
                elementIssues.push('Missing aria-required');
              }

              // Check for placeholder as label
              if (element.hasAttribute('placeholder') && !label && !parentLabel) {
                elementIssues.push('Placeholder used as label');
              }

              // Check input types
              if (element instanceof HTMLInputElement) {
                // Check date inputs
                if (element.type === 'date' && !element.hasAttribute('aria-label')) {
                  elementIssues.push('Date input needs aria-label');
                }

                // Check file inputs
                if (element.type === 'file' && !element.hasAttribute('accept')) {
                  elementIssues.push('File input missing accept attribute');
                }
              }

              // Check select elements
              if (element instanceof HTMLSelectElement) {
                if (!element.options.length) {
                  elementIssues.push('Empty select element');
                }
              }

              // If there are issues, add them to the main issues array
              if (elementIssues.length > 0) {
                element.classList.add('form-issue');
                element.setAttribute('data-issue', elementIssues.join(', '));
                issues.push({
                  type: 'error',
                  message: elementIssues.join(', '),
                  element: element.outerHTML,
                  selector: element.tagName.toLowerCase() + (element.id ? `#${element.id}` : '')
                });
              }
            }
          });

          // Check fieldsets and legends
          const fieldsets = document.querySelectorAll('fieldset');
          fieldsets.forEach(fieldset => {
            if (!fieldset.querySelector('legend')) {
              fieldset.classList.add('form-issue');
              fieldset.setAttribute('data-issue', 'Missing legend');
              issues.push({
                type: 'error',
                message: 'Missing legend',
                element: fieldset.outerHTML,
                selector: fieldset.tagName.toLowerCase() + (fieldset.id ? `#${fieldset.id}` : '')
              });
            }
          });

          return {
            type: 'form' as const,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            issues
          };
        }
      });

      if (results?.[0]?.result) {
        setResults(results[0].result);
        addLog(`Form check complete! Found ${results[0].result.issues.length} issues`);
      }
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error(error);
    } finally {
      setScanning(false);
    }
  };

  // Add this new handler for link accessibility checking
  const handleLinkCheck = async () => {
    try {
      setScanning(true);
      setDebugLog([]);
      setResults(null);
      addLog('Checking link accessibility...');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error('No active tab found');
      }

      const results: ScriptInjectionResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Add styles for link issues
          const style = document.createElement('style');
          if (style) {
            style.textContent = `
              .link-issue {
                outline: 1px dashed #ff9800 !important;
                position: relative;
              }
              .link-issue::after {
                content: attr(data-issue);
                position: absolute;
                bottom: -20px;
                left: 0;
                background: #333;
                color: white;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 12px;
                z-index: 10000;
                white-space: nowrap;
              }
            `;
            document.head.appendChild(style);
          }

          // Remove previous highlights
          document.querySelectorAll('.link-issue').forEach(el => {
            el.classList.remove('link-issue');
            el.removeAttribute('data-issue');
          });

          let issuesFound = 0;

          // Common non-descriptive link texts
          const poorLinkTexts = [
            'click here',
            'click',
            'here',
            'more',
            'read more',
            'learn more',
            'link',
            'this link',
            'download',
            'this',
            'page',
            'this page',
            'view',
            'view more'
          ];

          // Check all links
          const links = Array.from(document.querySelectorAll('a'));
          const issues: AccessibilityIssue[] = [];
          links.forEach(link => {
            const linkIssues: string[] = [];

            // Check for empty links
            if (!link.textContent?.trim() && !link.querySelector('img')) {
              linkIssues.push('Empty link');
            }

            // Check for non-descriptive text
            const linkText = link.textContent?.toLowerCase().trim() || '';
            if (poorLinkTexts.includes(linkText)) {
              linkIssues.push('Non-descriptive link text');
            }

            // Check for missing href
            if (!link.hasAttribute('href')) {
              linkIssues.push('Missing href');
            }

            // Check for empty href
            if (link.getAttribute('href') === '#' || link.getAttribute('href') === '') {
              linkIssues.push('Empty href');
            }

            // Check for JavaScript links
            if (link.getAttribute('href')?.startsWith('javascript:')) {
              linkIssues.push('JavaScript in href');
            }

            // Check for image links without alt text
            const imgInLink = link.querySelector('img');
            if (imgInLink && !imgInLink.hasAttribute('alt')) {
              linkIssues.push('Image link missing alt text');
            }

            // Check for duplicate links next to each other
            const nextLink = link.nextElementSibling;
            if (nextLink && 
                nextLink.tagName === 'A' && 
                nextLink.getAttribute('href') === link.getAttribute('href')) {
              linkIssues.push('Duplicate adjacent link');
            }

            // Check for title attribute matching link text
            const title = link.getAttribute('title');
            if (title && title === linkText) {
              linkIssues.push('Redundant title attribute');
            }

            // Check for links that open in new window
            if (link.getAttribute('target') === '_blank' && 
                !link.getAttribute('aria-label')?.includes('new window')) {
              linkIssues.push('New window not announced');
            }

            // If there are issues, add them to the main issues array
            if (linkIssues.length > 0) {
              link.classList.add('link-issue');
              link.setAttribute('data-issue', linkIssues.join(', '));
              issues.push({
                type: 'error',
                message: linkIssues.join(', '),
                element: link.outerHTML,
                selector: link.tagName.toLowerCase() + (link.id ? `#${link.id}` : '')
              });
            }
          });

          return {
            type: 'link' as const,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            issues
          };
        }
      });

      if (results?.[0]?.result) {
        const scanResults = results[0].result;
        setResults(scanResults);
        addLog(`Link check complete! Found ${scanResults.issues.length} issues`);
      }
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error(error);
    } finally {
      setScanning(false);
    }
  };

  // Update the clearStyles function
  const clearStyles = async () => {
    // Clear UI state
    setDebugLog([]);
    setResults(null);

    // Clear styles from the page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) return;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Remove styles
        const styles = document.querySelectorAll('style');
        styles.forEach(style => {
          if (style?.textContent?.includes('tab-order-correct') || 
              style?.textContent?.includes('a11y-error-highlight') ||
              style?.textContent?.includes('form-issue') ||
              style?.textContent?.includes('link-issue')) {
            style.remove();
          }
        });
        
        // Remove all highlights
        document.querySelectorAll(
          '.a11y-error-highlight, .a11y-warning-highlight, .tab-order-correct, .tab-order-incorrect, .form-issue, .link-issue'
        ).forEach(el => {
          el.classList.remove(
            'a11y-error-highlight',
            'a11y-warning-highlight',
            'tab-order-correct',
            'tab-order-incorrect',
            'form-issue',
            'link-issue'
          );
          el.removeAttribute('data-issue');
        });
        
        // Remove labels
        document.querySelectorAll('.a11y-issue-label').forEach(el => el.remove());
      }
    });
  };

  // Update the feature button style (the main buttons)
  const featureButtonStyle = {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: scanning ? '#E0E0E0' : '#5B7CF8', // Changed from green to a pleasant blue
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: scanning ? 'not-allowed' : 'pointer',
    flex: 1,
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    ':hover': {
      backgroundColor: scanning ? '#E0E0E0' : '#4563D2' // Darker shade for hover
    }
  };

  // Update the clear button style (X buttons)
  const clearButtonStyle = {
    padding: '8px 12px',
    fontSize: '14px',
    backgroundColor: '#FF7676', // Changed from red to a softer red
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    height: '100%',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    ':hover': {
      backgroundColor: '#FF5252' // Darker shade for hover
    }
  };

  return (
    <div style={{ padding: '16px', width: '400px' }}>
      <h1 style={{ marginTop: 0 }}>Web Accessibility Scanner</h1>
      
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        flexDirection: 'column',
        width: '100%'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
          <button 
            onClick={handleScan}
            disabled={scanning}
            style={featureButtonStyle}
            onMouseEnter={e => {
              if (!scanning) e.currentTarget.style.backgroundColor = '#4563D2';
            }}
            onMouseLeave={e => {
              if (!scanning) e.currentTarget.style.backgroundColor = '#5B7CF8';
            }}
          >
            {scanning ? 'Scanning...' : 'Scan Page'}
          </button>
          <button
            onClick={clearStyles}
            style={clearButtonStyle}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FF5252'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#FF7676'}
            title="Clear highlights"
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
          <button 
            onClick={handleTabOrderCheck}
            disabled={scanning}
            style={featureButtonStyle}
            onMouseEnter={e => {
              if (!scanning) e.currentTarget.style.backgroundColor = '#4563D2';
            }}
            onMouseLeave={e => {
              if (!scanning) e.currentTarget.style.backgroundColor = '#5B7CF8';
            }}
          >
            Check Tab Order
          </button>
          <button
            onClick={clearStyles}
            style={clearButtonStyle}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FF5252'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#FF7676'}
            title="Clear highlights"
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
          <button 
            onClick={handleFormCheck}
            disabled={scanning}
            style={featureButtonStyle}
            onMouseEnter={e => {
              if (!scanning) e.currentTarget.style.backgroundColor = '#4563D2';
            }}
            onMouseLeave={e => {
              if (!scanning) e.currentTarget.style.backgroundColor = '#5B7CF8';
            }}
          >
            Check Forms
          </button>
          <button
            onClick={clearStyles}
            style={clearButtonStyle}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FF5252'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#FF7676'}
            title="Clear highlights"
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
          <button 
            onClick={handleLinkCheck}
            disabled={scanning}
            style={featureButtonStyle}
            onMouseEnter={e => {
              if (!scanning) e.currentTarget.style.backgroundColor = '#4563D2';
            }}
            onMouseLeave={e => {
              if (!scanning) e.currentTarget.style.backgroundColor = '#5B7CF8';
            }}
          >
            Check Links
          </button>
          <button
            onClick={clearStyles}
            style={clearButtonStyle}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FF5252'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#FF7676'}
            title="Clear highlights"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Results Section */}
      {results && (
        <div style={{ 
          marginTop: '16px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '8px'
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
            {results.type === 'general' && 'General Scan Results:'}
            {results.type === 'tabOrder' && 'Tab Order Results:'}
            {results.type === 'form' && 'Form Accessibility Results:'}
            {results.type === 'link' && 'Link Accessibility Results:'}
          </h3>
          <div style={{ fontSize: '12px' }}>
            {results.issues.map((issue, index) => (
              <div 
                key={index} 
                onClick={() => issue.selector && highlightElement(issue.selector)}
                style={{
                  marginBottom: '8px',
                  padding: '8px',
                  backgroundColor: issue.type === 'error' ? '#ffebee' : '#fff3e0',
                  borderRadius: '4px',
                  cursor: issue.selector ? 'pointer' : 'default',
                  transition: 'all 0.2s ease-in-out',
                }}
                onMouseEnter={(e) => {
                  if (issue.selector) {
                    const target = e.currentTarget;
                    target.style.transform = 'scale(1.01)';
                    target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (issue.selector) {
                    const target = e.currentTarget;
                    target.style.transform = 'scale(1)';
                    target.style.boxShadow = 'none';
                  }
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{issue.message}</div>
                {issue.fix && (
                  <div style={{ color: '#666', marginTop: '4px' }}>Fix: {issue.fix}</div>
                )}
                {issue.element && (
                  <div style={{ 
                    color: '#888',
                    fontSize: '11px',
                    marginTop: '4px',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all'
                  }}>{issue.element}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debug Log Section */}
      <div style={{ 
        marginTop: '16px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '8px',
        maxHeight: '200px',
        overflowY: 'auto',
        backgroundColor: '#f5f5f5'
      }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Debug Log:</h3>
        {debugLog.length === 0 ? (
          <div style={{ color: '#666', fontSize: '12px' }}>No logs yet...</div>
        ) : (
          <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
            {debugLog.map((log, index) => (
              <div key={index} style={{ marginBottom: '4px' }}>{log}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>
  );
} 