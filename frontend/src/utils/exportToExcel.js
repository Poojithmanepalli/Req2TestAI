import * as XLSX from 'xlsx';

export function exportToExcel(data) {
  const { modules, stats, processingTime, coverageScore, missingRequirements } = data;

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Summary ──────────────────────────────────────
  const summaryRows = [
    ['Req2TestAI — Test Case Report'],
    [],
    ['Total Requirements Processed', stats.total],
    ['Functional Requirements',      stats.functional],
    ['Non-Functional Requirements',  stats.nonFunctional],
    ['Modules Covered',              modules.map(m => m.module).join(', ')],
    ['Requirement Coverage Score',   coverageScore ? `${coverageScore}%` : 'N/A'],
    ['AI Used',                      'Yes (GPT-4o-mini)'],
    ['Processing Time',              processingTime],
    ['Generated On',                 new Date().toLocaleString()],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1['!cols'] = [{ wch: 30 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

  // ── Sheet 3: Missing Requirements ─────────────────────────
  if (missingRequirements && missingRequirements.length > 0) {
    const missingHeaders = ['#', 'Suggested Missing Requirement'];
    const missingRows = missingRequirements.map((r, i) => [i + 1, r.text || r]);
    const ws3 = XLSX.utils.aoa_to_sheet([missingHeaders, ...missingRows]);
    ws3['!cols'] = [{ wch: 4 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Missing Requirements');
  }

  // ── Sheet 2: All Test Cases ────────────────────────────────
  const headers = [
    'Module', 'REQ ID', 'Priority', 'Type', 'Category',
    'Requirement', 'TC #', 'Test Case Title', 'Steps', 'Expected Result'
  ];

  const rows = [];
  modules.forEach(mod => {
    mod.items.forEach(item => {
      item.testCases.forEach((tc, i) => {
        const steps = Array.isArray(tc.steps)
          ? tc.steps.map((s, j) => `${j + 1}. ${s}`).join('\n')
          : tc.steps;

        rows.push([
          mod.module,
          item.id,
          item.priority,
          item.type,
          item.category || 'general',
          item.requirement,
          i + 1,
          tc.title,
          steps,
          tc.expected,
        ]);
      });
    });
  });

  const ws2 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws2['!cols'] = [
    { wch: 16 },  // Module
    { wch: 9 },   // REQ ID
    { wch: 10 },  // Priority
    { wch: 16 },  // Type
    { wch: 14 },  // Category
    { wch: 52 },  // Requirement
    { wch: 6 },   // TC #
    { wch: 26 },  // Title
    { wch: 52 },  // Steps
    { wch: 42 },  // Expected
  ];

  XLSX.utils.book_append_sheet(wb, ws2, 'Test Cases');

  XLSX.writeFile(wb, 'Req2TestAI_Report.xlsx');
}
