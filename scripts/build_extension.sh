#!/bin/bash
# Build Chrome extension

cd extension
npm install
npm run build

echo "Extension built in extension/dist"
echo "Load into Chrome via chrome://extensions/"
