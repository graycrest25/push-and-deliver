# International tariff PDF parser update guide

Status: instructions and proposed code only. The backend changes made during this investigation have been reverted. This file is stored in the admin repository; it does not apply any backend change or deploy anything.

## Problem and evidence

Uploading `PND APP RATE(1).pdf` for international tariff preview returned HTTP 400 with `error.code: invalid_request`, `details.fields.file: invalid`, and request reference `c86e0e36b599701215541c388fc9867b`.

In the adjacent backend source, `internal/dashboard/pricing_pdf.go` maps `dhlratecard.ErrFormat` to that generic file error. `internal/dhlratecard/pdf.go` requires a header with the exact extracted words:

```text
KG ZONE 1 ZONE 2 ZONE 3 ZONE 4 ZONE 5 ZONE 6 ZONE 7 ZONE 8
```

The supplied PDFs extract the first zone label as separate fragments:

```text
KG Z O NE 1 ZONE 2 ZONE 3 ZONE 4 ZONE 5 ZONE 6 ZONE 7 ZONE 8
```

This is selectable text, not a scanned PDF. Matching an exact space-separated string fails, and `l[1+2*z]` cannot locate the correct zone boundaries when fragment counts change.

The user reported that the second PDF previews successfully in their environment. The local backend revision inspected here rejected both supplied exports: the second also uses an October-specific title and blank higher-weight rows. The local reproduction does not establish which backend revision is deployed or prove the deployed failure has only this cause.

## Source files and expected results

Keep the uploaded PDFs unchanged. Copy them into backend test fixtures only when implementing this guide.

| Supplied file | SHA-256 | Expected prices | Maximum priced weight | Country mappings |
| --- | --- | ---: | ---: | ---: |
| `PND APP RATE(1).pdf` | `75cabebc89aab38366318c84d4589d5ad8813db20c3708a462b19e4eb90cf7b4` | 312 | 70 kg | 52 |
| `PND_App_Export_Rate_October_2026.pdf` | `b070a961da15ed25da70eb1b53508e6cb929e77094af1e02173c8e616345c271` | 240 | 25 kg | 52 |

All prices and country mappings extracted from the first file matched `testdata/app-2026-11.expected.json`. Those from the second matched `testdata/october-2026.expected.json`.

The first card contains 39 priced bands: 0.5 kg increments through 5 kg, whole kilograms from 6 through 30 kg, then 40, 50, 60 and 70 kg. The second supplies 30 priced bands through 25 kg and nine empty placeholder rows for 26, 27, 28, 29, 30, 40, 50, 60 and 70 kg. Empty rows do not represent zero prices.

## Intended API behavior

Keep the existing endpoint and multipart contract:

```http
POST /v1/admin/shipping/tariffs/{id}/import-pdf
```

- Send exactly `file` (`application/pdf`, at most 2 MiB) and `metadata` (JSON text, at most 4 KiB).
- Obtain the current active DHL export/non-document tariff snapshot and its version before previewing. Do not hard-code the tariff ID or version.
- Metadata uses the existing `name`, `reason`, `expectedVersion` and explicit `preview` fields.
- `preview: true` returns the full validated rate review and performs no publication.
- Publication remains a separate user action using the reviewed PDF and metadata with `preview: false`, a new publication idempotency key, and the existing stale-version and authorization checks. Retry an uncertain publication with the identical request/key.
- Keep the existing response fields, audit behavior, immutable tariff publication and preservation of unlisted countries and prices above the imported maximum.

No endpoint, response schema, database migration or automatic rate publication is needed for this parser update.

## Parser implementation

Apply this in `pnd-backend/internal/dhlratecard/pdf.go` after checking the backend's own instructions and current source. The diff below was prepared against the source inspected during this investigation; reconcile it manually if that source has changed.

1. Recognize each ordered label (`ZONE1` through `ZONE8`) by joining only the fragments belonging to that label on the header line. Require exactly one `KG` prefix, all eight labels in order, and no trailing tokens.
2. Record the first fragment's actual X coordinate for each zone. Retain increasing-column checks and use these coordinates for the existing rate and country checks. Do not replace the table with unpositioned text matching.
3. Retain the original one-page October format and two-page 70 kg APP format. Also recognize the exact two-page title `PND APP EXPORT RATE OCTOBER 2026-AFRICA` for the supplied October export.
4. For that October APP layout only, validate the nine empty high-weight placeholders in order after the completed 25 kg row. Reject missing, duplicate, reordered or partially priced placeholders. Never synthesize prices for them.
5. Keep existing exact integer-kobo conversion, positive/nondecreasing prices, eight prices per priced row, required bands, column checks, country aliases and continuation-page validation.

### Proposed parser diff

```diff
diff --git a/internal/dhlratecard/pdf.go b/internal/dhlratecard/pdf.go
index 3a62755..c655f23 100644
--- a/internal/dhlratecard/pdf.go
+++ b/internal/dhlratecard/pdf.go
@@ -213,13 +213,45 @@ func parseLayout(raw []byte) ([][]word, []word, int, error) {
 	return lines, words, pages, nil
 }
 
+// rateColumns accepts PDF text fragments such as "Z", "O", "NE", "1"
+// while requiring exactly KG followed by all eight ordered zone labels. Column
+// boundaries still come from the first fragment of each label, not word indexes.
+func rateColumns(line []word) ([8]float64, bool) {
+	var columns [8]float64
+	if len(line) == 0 || line[0].Text != "KG" {
+		return columns, false
+	}
+	i := 1
+	for z := range 8 {
+		if i >= len(line) {
+			return columns, false
+		}
+		columns[z] = line[i].X
+		if columns[z] <= line[0].X || (z > 0 && columns[z] <= columns[z-1]) {
+			return columns, false
+		}
+		expected, label := "ZONE"+strconv.Itoa(z+1), ""
+		for i < len(line) && label != expected {
+			label += line[i].Text
+			i++
+			if !strings.HasPrefix(expected, label) {
+				return columns, false
+			}
+		}
+		if label != expected {
+			return columns, false
+		}
+	}
+	return columns, i == len(line)
+}
+
 func Parse(raw []byte) (Card, error) {
 	card := Card{Rates: []Rate{}, Countries: []Country{}}
 	lines, words, pages, err := parseLayout(raw)
 	if err != nil {
 		return card, err
 	}
-	titleOK, appLayout := false, false
+	titleOK, appLayout, octoberAppLayout := false, false, false
 	for _, l := range lines {
 		var parts []string
 		for _, w := range l {
@@ -232,26 +264,24 @@ func Parse(raw []byte) (Card, error) {
 		if l[0].Page == 1 && title == "PND APP EXPORT RATE 2026-AFRICA" {
 			titleOK, appLayout = true, true
 		}
+		if l[0].Page == 1 && title == "PND APP EXPORT RATE OCTOBER 2026-AFRICA" {
+			titleOK, octoberAppLayout = true, true
+		}
 	}
-	if !titleOK || (!appLayout && pages != 1) || (appLayout && pages != 2) {
+	twoPages := appLayout || octoberAppLayout
+	if !titleOK || (!twoPages && pages != 1) || (twoPages && pages != 2) {
 		return card, ErrFormat
 	}
 	header := -1
 	var columns [8]float64
 	countryY := float64(0)
 	for i, l := range lines {
-		s := []string{}
-		for _, w := range l {
-			s = append(s, w.Text)
-		}
-		if l[0].Page == 1 && strings.Join(s, " ") == "KG ZONE 1 ZONE 2 ZONE 3 ZONE 4 ZONE 5 ZONE 6 ZONE 7 ZONE 8" {
+		if candidate, ok := rateColumns(l); ok && l[0].Page == 1 {
 			if header != -1 {
 				return card, ErrFormat
 			}
 			header = i
-			for z := range 8 {
-				columns[z] = l[1+2*z].X
-			}
+			columns = candidate
 		}
 		if l[0].Page == 1 && l[0].Text == "COU" {
 			if countryY != 0 {
@@ -267,6 +297,10 @@ func Parse(raw []byte) (Card, error) {
 	ended := false
 	lastWeight := int64(0)
 	var previous [8]int64
+	// The October APP export leaves these higher-weight rows entirely blank.
+	// They are placeholders, not zero prices or permission to ignore partial rows.
+	blankBands := []int64{26000, 27000, 28000, 29000, 30000, 40000, 50000, 60000, 70000}
+	blankCount := 0
 	for _, l := range lines[header+1:] {
 		if l[0].Y >= countryY {
 			break
@@ -277,13 +311,21 @@ func Parse(raw []byte) (Card, error) {
 			}
 			continue
 		}
-		if ended || len(l) != 9 {
-			return card, ErrFormat
-		}
 		g, e := number(l[0].Text, 1000)
 		if e != nil {
 			return card, ErrFormat
 		}
+		if octoberAppLayout && lastWeight == 25000 && len(l) == 1 {
+			if blankCount >= len(blankBands) || g != blankBands[blankCount] {
+				return card, ErrFormat
+			}
+			blankCount++
+			ended = true
+			continue
+		}
+		if ended || len(l) != 9 || (octoberAppLayout && g > 25000) {
+			return card, ErrFormat
+		}
 		expected := lastWeight + 500
 		if lastWeight >= 5000 {
 			expected = lastWeight + 1000
@@ -315,7 +357,7 @@ func Parse(raw []byte) (Card, error) {
 		started = true
 		lastWeight = g
 	}
-	if lastWeight < 25000 || (appLayout && lastWeight != 70000) {
+	if lastWeight < 25000 || (appLayout && lastWeight != 70000) || (octoberAppLayout && blankCount != len(blankBands)) {
 		return card, ErrFormat
 	}
 	card.MaxWeightGrams = lastWeight
```

## Regression fixtures

The commands below are instructions for the backend implementer, not actions performed by this guide. Run them from the `pnd-backend` repository. They require Poppler's native `pdftotext` on PATH. Adjust source paths if the uploads have moved.

```bash
cp '/Users/macbook/Downloads/PND APP RATE(1).pdf' \
  internal/dhlratecard/testdata/app-2026-11-reexport.pdf
cp '/Users/macbook/Downloads/PND_App_Export_Rate_October_2026.pdf' \
  internal/dhlratecard/testdata/october-2026-app.pdf

pdftotext -bbox -enc UTF-8 \
  internal/dhlratecard/testdata/app-2026-11-reexport.pdf \
  internal/dhlratecard/testdata/app-2026-11-reexport.xml
pdftotext -bbox -enc UTF-8 \
  internal/dhlratecard/testdata/october-2026-app.pdf \
  internal/dhlratecard/testdata/october-2026-app.xml

shasum -a 256 \
  internal/dhlratecard/testdata/app-2026-11-reexport.pdf \
  internal/dhlratecard/testdata/october-2026-app.pdf
```

Confirm the hashes against the table above. Reuse the existing independently reviewed expected JSON files; do not generate expected prices from the parser under test.

### Proposed parser regression test

Create `internal/dhlratecard/reexport_pdf_test.go` with the following test when implementing. It checks every price and mapping from both supplied exports, both PDF source hashes, and rejection of corrupted headers, unknown countries, missing continuation pages and invalid October placeholders.

```go
package dhlratecard

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"reflect"
	"regexp"
	"strings"
	"testing"
)

// These are the actual operator uploads, whose edited header extracts as
// KG Z O NE 1 ZONE 2 ... rather than the original KG ZONE 1 ZONE 2 ... .
func TestOperatorReexportedPDFs(t *testing.T) {
	for _, tc := range []struct{ name, expected, sha string }{
		{"app-2026-11-reexport", "app-2026-11", "75cabebc89aab38366318c84d4589d5ad8813db20c3708a462b19e4eb90cf7b4"},
		{"october-2026-app", "october-2026", "b070a961da15ed25da70eb1b53508e6cb929e77094af1e02173c8e616345c271"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			raw, err := os.ReadFile("testdata/" + tc.name + ".xml")
			if err != nil {
				t.Fatal(err)
			}
			wantJSON, err := os.ReadFile("testdata/" + tc.expected + ".expected.json")
			if err != nil {
				t.Fatal(err)
			}
			var want Card
			if err := json.Unmarshal(wantJSON, &want); err != nil {
				t.Fatal(err)
			}
			got, err := Parse(raw)
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, want) {
				t.Fatal("exported prices or countries differ from the independently reviewed card")
			}
			t.Run("actual PDF", func(t *testing.T) {
				if _, err := exec.LookPath("pdftotext"); err != nil {
					t.Skip("Poppler required for actual PDF extraction")
				}
				pdf, err := os.ReadFile("testdata/" + tc.name + ".pdf")
				if err != nil {
					t.Fatal(err)
				}
				got, err := Read(context.Background(), pdf)
				if err != nil {
					t.Fatal(err)
				}
				want.SourceSHA256 = tc.sha
				if !reflect.DeepEqual(got, want) {
					t.Fatal("actual uploaded PDF differs from reviewed prices, countries or source hash")
				}
			})
		})
	}
}

func TestReexportStillRejectsIncompleteOrAmbiguousTables(t *testing.T) {
	for _, name := range []string{"app-2026-11-reexport", "october-2026-app"} {
		raw, err := os.ReadFile("testdata/" + name + ".xml")
		if err != nil {
			t.Fatal(err)
		}
		original := string(raw)
		cases := map[string]string{
			"wrong header fragment": strings.Replace(original, ">NE<", ">NX<", 1),
			"duplicate zone":        strings.Replace(original, ">2<", ">1<", 1),
			"unknown country":       strings.Replace(original, "SCOTLAND", "UNKNOWNLAND", 1),
			"missing continuation":  original[:strings.Index(original, "</page>")+len("</page>")] + "</doc></body></html>",
		}
		if name == "october-2026-app" {
			band := regexp.MustCompile(`<word[^>]*>26</word>`).FindString(original)
			if band == "" {
				t.Fatal("missing placeholder fixture")
			}
			cases["missing blank band"] = strings.Replace(original, band, "", 1)
			cases["priced placeholder"] = strings.Replace(original, band, band+strings.Replace(band, ">26<", ">100.00<", 1), 1)
		}
		for label, bad := range cases {
			t.Run(name+"/"+label, func(t *testing.T) {
				if bad == original {
					t.Fatal("ineffective mutation")
				}
				if _, err := Parse([]byte(bad)); !errors.Is(err, ErrFormat) {
					t.Fatal("unsafe upload accepted", err)
				}
			})
		}
	}
}
```

## HTTP regression coverage

In `internal/dashboard/pricing_app_pdf_test.go`, run the existing `TestAppPDFHTTPPreviewPublicationAndRetries` scenario against both `app-2026-11.pdf` and `app-2026-11-reexport.pdf`:

- Move the existing test body into a helper that accepts a fixture filename.
- Make the top-level test loop over those two filenames using `t.Run`.
- In the helper, read `../dhlratecard/testdata/` plus the filename instead of calling `appPDF(t)`.
- Preserve the existing tests for invalid multipart input, incorrect MIME, size limits, malformed metadata, stale previews, publication, replay, competing updates, authorization, and unchanged prices on preview/rejection.
- Keep `appPDF(t)` available for other existing tests that still use the original fixture.

The re-export preview must return all 312 reviewed prices through 70 kg, 52 mapped countries, and its actual PDF SHA-256. Preview must leave tariff records, pricing audit and publication outbox counts unchanged. Successful publication must retain the current atomic/idempotent guarantees.

## Verification commands

Run from `pnd-backend`, using the Go toolchain required by its `go.mod` and native Poppler. Install the existing Python contract-test requirements into an isolated virtual environment and activate it so the tests' `python3` can import `jsonschema`:

```bash
python3 -m venv /tmp/pnd-pdf-contracts-venv
. /tmp/pnd-pdf-contracts-venv/bin/activate
python3 -m pip install -r scripts/requirements-contracts.txt

gofmt -w internal/dhlratecard/pdf.go \
  internal/dhlratecard/reexport_pdf_test.go \
  internal/dashboard/pricing_app_pdf_test.go

go vet ./internal/dhlratecard ./internal/dashboard
go test -race ./internal/dhlratecard
```

Set `TEST_DATABASE_URL` to a disposable local database whose name ends in `_test`, then run:

```bash
go test -race ./internal/dashboard \
  -run 'Test(AppPDF|PDFTariff)' -count=1 -v
```

The integration suite creates and removes isolated schemas. An unset `TEST_DATABASE_URL` skips the PostgreSQL tests; a skip is not API verification. If `pdftotext` is missing, actual-PDF extraction tests skip too. Require those tests to execute before accepting the update.

Verify that original October, original APP and domestic parser tests still pass; malformed headers, shifted price columns, fractional kobo, negative/decreasing prices, missing bands and missing country pages must remain rejected.

## Prior verification and rollout

A temporary implementation of this proposal passed parser race tests with every supplied price and country compared against the existing expected fixtures. It also passed the relevant dashboard API tests against a disposable PostgreSQL database with OpenAPI exchange validation, plus `go vet`. Extraction used a temporary Poppler `pdftotext` WebAssembly wrapper; rerun with the native Poppler version used by the deployment image. Those backend implementation and test changes have now been reverted at the user's request; these results describe the temporary implementation, not the current backend tree or deployed service.

The admin repository's six PDF browser tests and TypeScript checks passed during the investigation. Browser tests use a local API stand-in; they do not establish deployed parser support.

After a separately reviewed backend implementation is deployed, preview both original uploads against the currently selected active tariff. Confirm the returned counts and full reviewed values before any separately authorized publication. Deploying the parser must not automatically publish prices.
