#!/bin/bash
# Watch ~/Downloads for new Brisnet PDFs and pre-extract text for ingestion.
# Usage: scripts/watch_for_pdf.sh
# Triggers on any new PDF whose name matches: Churchill | horse | brisnet | racecard | bris

DL="$HOME/Downloads"
PATTERN='[Cc]hurchill|[Hh]orse|[Bb]risnet|[Rr]acecard|productdownload'
SEEN_FILE="/tmp/.previewcharge_seen_pdfs"
LOG="/tmp/previewcharge_pdf_watch.log"

touch "$SEEN_FILE"
echo "[$(date '+%H:%M:%S')] watcher started, scanning $DL" >> "$LOG"

while true; do
  # Only PDFs modified within the last 60 minutes — avoids re-flagging older Brisnet downloads
  for f in $(find "$DL" -maxdepth 1 -type f -name "*.pdf" -mmin -60 2>/dev/null); do
    [ -e "$f" ] || continue
    base=$(basename "$f")
    # match the pattern
    if echo "$base" | grep -qE "$PATTERN"; then
      # already processed?
      if grep -qF "$base" "$SEEN_FILE"; then
        continue
      fi
      # extract text
      out="/tmp/ingest-$(date +%Y%m%d-%H%M%S).txt"
      pdftotext -layout "$f" "$out" 2>/dev/null
      pages=$(pdfinfo "$f" 2>/dev/null | awk '/Pages/ {print $2}')
      echo "[$(date '+%H:%M:%S')] NEW PDF: $base ($pages pages) → $out" >> "$LOG"
      echo "$base" >> "$SEEN_FILE"
      # iMessage Jason via osascript
      osascript -e 'tell application "Messages" to send "[ClaudeRight] PDF detected: '"$base"' ('"$pages"' pages). Pre-extracted to '"$out"'. Ready for ingestion." to buddy "+15024080064" of (service 1 whose service type is iMessage)' 2>/dev/null
    fi
  done
  sleep 5
done
