import fs from 'fs/promises';
import path from 'path';
import csv from 'csvtojson';

const root = path.resolve();
const documentsCsv = path.join(root, 'csv', 'documents.csv');
const townsCsv = path.join(root, 'csv', 'towns.csv');
const outputDir = path.join(root, 'json');
const docsFile = path.join(outputDir, 'documents.json');
const archivesFile = path.join(outputDir, 'archives.json');
const townsFile = path.join(outputDir, 'towns.json');
const typesFile = path.join(outputDir, 'document_types.json');

function randomHexColor() {
  return Math.floor(Math.random() * 256).toString(16).padStart(2, '0') + 
         Math.floor(Math.random() * 128).toString(16).padStart(2, '0') + 
         Math.floor(Math.random() * 64).toString(16).padStart(2, '0');
}

const isNonEmpty = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const cleanObject = (item) => {
  return Object.entries(item).reduce((acc, [key, value]) => {
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (isNonEmpty(normalized)) {
      acc[key] = normalized;
    }
    return acc;
  }, {});
};

const uniqueOrdered = (values) => [...new Set(values.filter(isNonEmpty))];

async function main() {
  const rawDocuments = await csv().fromFile(documentsCsv);
  const rawTowns = await csv().fromFile(townsCsv);
  const documents = rawDocuments.map((doc) => {
    const cleaned = cleanObject(doc);
    return {
      ...cleaned,
      color: randomHexColor(),
    };
  });
  const towns = rawTowns.map((town) => {
    return cleanObject(town);
  });

  const archives = uniqueOrdered(documents.map((doc) => doc.archive));
  const documentTypes = uniqueOrdered(documents.map((doc) => doc.document_type));

  await fs.mkdir(outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(docsFile, JSON.stringify(documents, null, 2) + '\n', 'utf8'),
    fs.writeFile(archivesFile, JSON.stringify(archives, null, 2) + '\n', 'utf8'),
    fs.writeFile(townsFile, JSON.stringify(towns, null, 2) + '\n', 'utf8'),
    fs.writeFile(typesFile, JSON.stringify(documentTypes, null, 2) + '\n', 'utf8'),
  ]);

  console.log('Ingest complete:');
  console.log(`  - ${docsFile}`);
  console.log(`  - ${archivesFile}`);
  console.log(`  - ${townsFile}`);
  console.log(`  - ${typesFile}`);
}

main().catch((error) => {
  console.error('Ingest failed:', error);
  process.exit(1);
});
