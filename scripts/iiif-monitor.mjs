import fs from 'node:fs/promises';
import path from 'node:path';
import csv from 'csvtojson';

const CSV_PATH = path.join(process.cwd(), 'csv', 'documents.csv');
const IIIF_PRESENTATION_BASE = 'https://ticha-iiif.s3.us-east-1.amazonaws.com/ticha';
const IIIF_IMAGE_BASE = 'https://awy5mcn5cgxb3cxtpcyf7cp6pu0lgvmp.lambda-url.us-east-1.on.aws/iiif/3/ticha';

const isCi = ['true', '1'].includes(String(process.env.CI || process.env.GITHUB_ACTIONS).toLowerCase());
const retries = Number.parseInt(process.env.MONITOR_RETRIES || '2', 10);
const retryDelayMs = Number.parseInt(process.env.MONITOR_RETRY_DELAY_MS || '300', 10);
const jpgFailThreshold = Number.parseInt(process.env.MONITOR_MAX_JPG_FAILURES || '0', 10);
const failOnManifestErrors = String(process.env.MONITOR_FAIL_ON_MANIFEST_ERRORS || 'true').toLowerCase() !== 'false';
const outputPath = process.env.MONITOR_OUTPUT_PATH || path.join(process.cwd(), 'artifacts', 'iiif-monitor-result.json');
const ciLogEvery = Number.parseInt(process.env.MONITOR_CI_LOG_EVERY || '50', 10);

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pagesFor = (count) => {
  const pageCount = Number.parseInt(count, 10);
  return Number.isNaN(pageCount) || pageCount <= 0
    ? []
    : Array.from({ length: pageCount }, (_, i) => String(i).padStart(3, '0'));
};

const toDocs = (rows) => rows.map((doc) => ({
  slug: doc.slug,
  page_count: doc.page_count,
  page_range: pagesFor(doc.page_count),
  manifest_status: 'pending',
  jpg_status: 'pending',
  iiif_status: 'pending',
}));

function progress(label, total) {
  let done = 0;
  const width = 24;

  const render = () => {
    if (isCi) return;
    const safeTotal = Math.max(total, 1);
    const ratio = Math.min(done / safeTotal, 1);
    const filled = Math.round(ratio * width);
    const bar = `${'='.repeat(filled)}${'-'.repeat(width - filled)}`;
    process.stdout.write(`${label} [${bar}] ${Math.round(ratio * 100)}% (${done}/${total})\r`);
  };

  if (isCi) console.log(`${label}: started (${total})`);
  else render();

  return {
    tick() {
      done += 1;
      if (isCi) {
        if (done === total || done % Math.max(ciLogEvery, 1) === 0) {
          console.log(`${label}: ${done}/${total}`);
        }
        return;
      }
      render();
    },
    end() {
      if (!isCi) process.stdout.write('\n');
      else console.log(`${label}: done (${done}/${total})`);
    },
  };
}

function ghEscape(value) {
  return String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function addFailure(failures, details) {
  failures.push(details);
  const title = `IIIF ${details.type} failure`;
  const body = `${details.slug}${details.page ? ` page ${details.page}` : ''} | status=${details.status ?? 'n/a'} | ${details.url} | ${details.error || 'request failed'}`;
  console.log(`::error title=${ghEscape(title)}::${ghEscape(body)}`);
}

async function requestWithRetry(url) {
  let last = { ok: false, status: null, error: null, attempts: 0 };
  for (let attempt = 0; attempt <= Math.max(retries, 0); attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return { ok: true, status: response.status, error: null, attempts: attempt + 1 };

      last = { ok: false, status: response.status, error: `HTTP ${response.status}`, attempts: attempt + 1 };
      if (response.status < 500 || attempt === retries) return last;
    } catch (error) {
      last = { ok: false, status: null, error: error?.message || String(error), attempts: attempt + 1 };
      if (attempt === retries) return last;
    }

    await pause(retryDelayMs * (attempt + 1));
  }
  return last;
}

async function checkManifests(docs, failures) {
  const p = progress('Checking Manifests', docs.length);
  for (const doc of docs) {
    const url = `${IIIF_PRESENTATION_BASE}/${doc.slug}/manifest.json`;
    const result = await requestWithRetry(url);
    doc.manifest_status = result.ok ? 'ok' : 'error';
    if (!result.ok) {
      addFailure(failures, {
        type: 'manifest',
        slug: doc.slug,
        page: null,
        url,
        status: result.status,
        error: result.error,
        attempts: result.attempts,
      });
    }
    p.tick();
  }
  p.end();
}

async function checkJpgs(docs, failures) {
  for (const doc of docs) {
    const p = progress(`Checking JPGs for ${doc.slug}`, doc.page_range.length);
    let hasError = false;
    for (const page of doc.page_range) {
      const url = `${IIIF_IMAGE_BASE}/${doc.slug}/${page}/square/50,/0/default.jpg`;
      const result = await requestWithRetry(url);
      if (!result.ok) {
        hasError = true;
        addFailure(failures, {
          type: 'jpg',
          slug: doc.slug,
          page,
          url,
          status: result.status,
          error: result.error,
          attempts: result.attempts,
        });
      }
      p.tick();
    }
    doc.jpg_status = hasError ? 'error' : 'ok';
    p.end();
  }
}

function summarize(docs, failures, startedAt) {
  const manifestFailures = failures.filter((f) => f.type === 'manifest').length;
  const jpgFailures = failures.filter((f) => f.type === 'jpg').length;
  docs.forEach((doc) => {
    doc.iiif_status = doc.manifest_status === 'ok' && doc.jpg_status === 'ok' ? 'ok' : 'error';
  });

  return {
    started_at: new Date(startedAt).toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt,
    docs_checked: docs.length,
    docs_failed: docs.filter((d) => d.iiif_status === 'error').length,
    manifests_failed: manifestFailures,
    jpgs_failed: jpgFailures,
    retries,
    retry_delay_ms: retryDelayMs,
    is_ci: isCi,
  };
}

function toStepSummary(summary, failures) {
  const header = [
    '## IIIF Monitor',
    '',
    `- docs checked: ${summary.docs_checked}`,
    `- docs failed: ${summary.docs_failed}`,
    `- manifests failed: ${summary.manifests_failed}`,
    `- jpgs failed: ${summary.jpgs_failed}`,
    `- duration: ${summary.duration_ms} ms`,
    '',
  ];

  if (!failures.length) return `${header.join('\n')}No failures detected.\n`;

  const rows = failures.slice(0, 50).map(
    (f) => `| ${f.type} | ${f.slug} | ${f.page || '-'} | ${f.status || '-'} | ${f.error || '-'} |`,
  );

  return [
    ...header,
    `Showing first ${rows.length} failure(s).`,
    '',
    '| type | slug | page | status | error |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

async function writeOutputs(result) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`Wrote monitor result: ${outputPath}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, toStepSummary(result.summary, result.failures));
  }
}

function shouldFail(summary) {
  if (failOnManifestErrors && summary.manifests_failed > 0) return true;
  return summary.jpgs_failed > Math.max(jpgFailThreshold, 0);
}

async function main() {
  const startedAt = Date.now();
  const rows = await csv().fromFile(CSV_PATH);
  const docs = toDocs(rows);
  const failures = [];

  await checkManifests(docs, failures);
  await checkJpgs(docs, failures);

  const summary = summarize(docs, failures, startedAt);
  const result = {
    metadata: {
      run_id: process.env.GITHUB_RUN_ID || null,
      run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
      repository: process.env.GITHUB_REPOSITORY || null,
      sha: process.env.GITHUB_SHA || null,
    },
    summary,
    failures,
    documents: docs.map((d) => ({
      slug: d.slug,
      page_count: d.page_count,
      manifest_status: d.manifest_status,
      jpg_status: d.jpg_status,
      iiif_status: d.iiif_status,
    })),
  };

  await writeOutputs(result);

  console.log(
    `Summary: docs=${summary.docs_checked}, docs_failed=${summary.docs_failed}, manifests_failed=${summary.manifests_failed}, jpgs_failed=${summary.jpgs_failed}`,
  );

  if (shouldFail(summary)) {
    process.exitCode = 1;
    console.error('IIIF monitor failed policy thresholds.');
  }
}

main().catch((error) => {
  console.error('IIIF monitor crashed:', error);
  process.exit(1);
});