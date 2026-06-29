# digital-text-explorer-data
[![IIIF Monitor](https://github.com/ticha-zapotec/digital-text-explorer-data/actions/workflows/iiif-monitor.yml/badge.svg)](https://github.com/ticha-zapotec/digital-text-explorer-data/actions/workflows/iiif-monitor.yml)
[![GitHub Pages Metadata](https://github.com/ticha-zapotec/digital-text-explorer-data/actions/workflows/publish.yml/badge.svg?branch=main)](https://github.com/ticha-zapotec/digital-text-explorer-data/actions/workflows/publish.yml)

This repository contains, processes, and publishes metadata for the Ticha Document Explorer. It does not contain image files.

## Contents

- `csv/` 
  + Contains `documents.csv` and `towns.csv`. These CSVs are downloaded from Google Sheets using UTF and stored here for processing. Changes should always be made in Google Sheets and CSVsredownloaded; changes should not be made directly to these files.
- `html/` 
  + contains HTML linguistic analysis files exported from FLEX and organized by document and page for digital editions
- `json/`
  + Contains derivative JSON files and an `index.html` file that links to them. These JSON files are parsed from the CSVs for use in the Ticha Digital Text Explorer. Like the CSVs, they should never be updated directly–changes should be made in Google Sheets -> Downloaded as CSV -> reprocessed to JSON.
- `scripts/`
  + Contains utility JS scripts for managing the data

## Management

> NOTE: Scripts can be run locally via CLI and/or via GitHub actions. For local development, this repo needs to be cloned to a machine with node and npm available.

### Adding Data
1. Upload/replace `csv/documents.csv` and/or `csv/towns.csv` files as needed with updated versions.
2. Run `npm run ingest`. This will process the CSVs to create updated JSON files and an updated `index.html` file that links to the JSON files.
3. When the data is updated/pushed to the repository, it will trigger a [GitHub Action](https://github.com/ticha-zapotec/digital-text-explorer-data/actions/workflows/publish.yml) that will publish the results to [GitHub Pages](https://ticha-zapotec.github.io/digital-text-explorer-data/).

> NOTE: The Ticha Digital Text Explorer ingests JSON data by downloading JSON URLs directly from the GitHub pages site! It is serving as a temporary API source.

### IIIF Monitoring

There is another [GitHub Action](https://github.com/ticha-zapotec/digital-text-explorer-data/actions/workflows/iiif-monitor.yml) that is configured to run automatically every Tuesday at 9am. It checks that all IIIF manifests and expected JPGs are available by running `npm run iiif-monitor` and producing a report ([example](https://github.com/ticha-zapotec/digital-text-explorer-data/actions/runs/28400234855/attempts/1#summary-84149309845)).

You can also run `npm run iiif-monitor` locally as needed. It runs though every document ID and checks the HTTP status code for the expected manifest URL. Then it runs through evey document ID again and, using the `page_count` metadata, checks that there are the correct number of jpgs available again via HTTP status code.
