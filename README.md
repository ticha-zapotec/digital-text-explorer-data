# digital-text-explorer-data
[![IIIF Monitor](https://github.com/ticha-zapotec/digital-text-explorer-data/actions/workflows/iiif-monitor.yml/badge.svg)](https://github.com/ticha-zapotec/digital-text-explorer-data/actions/workflows/iiif-monitor.yml)
[![GitHub Pages Metadata](https://github.com/ticha-zapotec/digital-text-explorer-data/actions/workflows/publish.yml/badge.svg?branch=main)](https://github.com/ticha-zapotec/digital-text-explorer-data/actions/workflows/publish.yml)

This repository contains, processes, and publishes metadata for the Ticha Document Explorer. It does not contain image files.

![screenshot ui](https://i.imgur.com/dv5BkGx.png)

## Contents

- `csv/` 
  + Contains `documents.csv` and `towns.csv`. These CSVs are downloaded from Google Sheets using UTF and stored here for version control and additional processing. 
    > NOTE: Changes should ***always*** be made in Google Sheets and then CSVs redownloaded; changes should not be made directly to these files.
- `html/` 
  + contains HTML linguistic analysis files exported from FLEX and organized by document for digital editions
- `json/`
  + this folder should be empty; it is where derivative JSON files will be generated
- `scripts/`
  + contains utility JS scripts for managing the data

## Management

> NOTE: Scripts can be run locally via CLI and/or via GitHub Actions. For local development, this repo needs to be cloned to a machine with node and npm available.

### Adding Data
1. Upload/replace `csv/documents.csv` and/or `csv/towns.csv` files as needed with updated versions.
2. When the updated data is uploaded or pushed to the repository, it will trigger a [GitHub Action](https://github.com/ticha-zapotec/digital-text-explorer-data/actions/workflows/publish.yml) that will:  
    - process the CSVs to create a series of JSON files and an `index.html` file that links to the JSON files
    - publish the resulting JSON and index.html files to [GitHub Pages](https://ticha-zapotec.github.io/digital-text-explorer-data/)

> NOTE: The Ticha Digital Text Explorer ingests JSON data by downloading JSON directly from this GitHub Pages site! It is essentially serving as a temporary API source.

### IIIF Monitoring

There is another [GitHub Action](https://github.com/ticha-zapotec/digital-text-explorer-data/actions/workflows/iiif-monitor.yml) that is configured to run automatically every Tuesday at 9am. It checks that all IIIF manifests and expected JPGs are available by running `npm run iiif-monitor` and producing a report ([example](https://github.com/ticha-zapotec/digital-text-explorer-data/actions/runs/28400234855/attempts/1#summary-84149309845)).

You can also run `npm run iiif-monitor` locally as needed. This script runs though every document ID and checks the HTTP status code for the expected manifest URL. Then it runs through every document ID again and, using the `page_count` metadata, checks that there are the correct number of jpgs available again via HTTP status code. The process will look something like this:

![screenshot cli](https://i.imgur.com/P5iLBP2.png)
