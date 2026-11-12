const XLSX = require(process.cwd() + '/node_modules/xlsx');
for (const f of process.argv.slice(2)) {
  const wb = XLSX.readFile(f, { sheetRows: 8 });
  console.log('\n## ' + f);
  for (const n of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, blankrows: false }).slice(0, 4)
      .map(r => r.filter(c => c !== null && c !== '').slice(0, 10).join(' | ').slice(0, 160));
    console.log('- ' + n + ': ' + rows.join(' // '));
  }
}
