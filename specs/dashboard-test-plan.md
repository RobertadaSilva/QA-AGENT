# Dashboard QA Test Plan

## Application Overview

Focused Playwright coverage for the QA dashboard at http://localhost:3000. The plan targets the real workflow of loading Asana data, surfacing API errors, recalculating KPIs after filters, and validating the project chart, monthly trend, cycle-time table, and top bug table specific to this launch-features dashboard.

## Test Scenarios

### 1. Loading and API failures

**Seed:** `tests/e2e/seed.spec.ts`

#### 1.1. Loading spinner is visible while data is pending

**File:** `tests/e2e/dashboard-loading.spec.ts`

**Steps:**
  1. Open http://localhost:3000 before the page has completed the /api/data request.
    - expect: The page shows the loader with the text 'Carregando dados do Asana...'.
    - expect: The main dashboard app is hidden while the loader is active.
    - expect: The error block is hidden at this stage.

#### 1.2. Dashboard renders the full UI after successful Asana load

**File:** `tests/e2e/dashboard-load-success.spec.ts`

**Steps:**
  1. Load the dashboard and allow /api/data to return successfully.
    - expect: The loader disappears.
    - expect: The app container becomes visible.
    - expect: The header displays 'Dashboard QA' with a timestamp.
    - expect: The KPI row is populated with four cards: Total Cards, Finalizados, Taxa de Bugs, and Total de Relatos.
    - expect: The project and date filters populate with the valid Asana project set.

#### 1.3. Asana API failure shows a clear error state

**File:** `tests/e2e/dashboard-api-failure.spec.ts`

**Steps:**
  1. Force /api/data to fail or return 500 with an Asana-related message.
    - expect: The loading spinner disappears.
    - expect: The error box appears with 'Erro ao carregar'.
    - expect: The text includes the backend error details, such as the Asana API message or token issue.
    - expect: The dashboard app remains hidden so users do not see partial data.

### 2. Filter behavior and KPI correctness

**Seed:** `tests/e2e/seed.spec.ts`

#### 2.1. Project + status filter recalculates KPI totals

**File:** `tests/e2e/dashboard-filters.spec.ts`

**Steps:**
  1. Select a single project from the Project dropdown, set Status to 'Finalizado', and click Filtrar.
    - expect: The filterInfo counter updates to the number of cards in the subset.
    - expect: The Total Cards KPI matches the filtered task count.
    - expect: The Finalizados KPI matches the number of completed tasks in that subset.
    - expect: The Taxa de Bugs and Total de Relatos reflect the filtered dataset, not the global totals.

#### 2.2. Date-range filter limits results to the selected period

**File:** `tests/e2e/dashboard-date-filter.spec.ts`

**Steps:**
  1. Choose a narrow start and end date in the From/To inputs and click Filtrar.
    - expect: Only cards whose created date is inside the selected range remain in scope.
    - expect: The filterInfo text decreases or becomes zero when the range excludes most tasks.
    - expect: The monthly and KPI values update to the date-limited totals.
    - expect: The dashboard does not show cards created outside the selected range.

#### 2.3. Reset filters restores the default dataset

**File:** `tests/e2e/dashboard-reset-filters.spec.ts`

**Steps:**
  1. Apply a restrictive project/status/date filter and then click Limpar.
    - expect: The Project field returns to 'Todos'.
    - expect: The Status field returns to 'Todos'.
    - expect: The date pickers reset to Jan 2026 and today.
    - expect: The filterInfo text clears back to the full dataset count.
    - expect: The KPI cards and downstream tables return to the unfiltered values.

### 3. Charts and table validation

**Seed:** `tests/e2e/seed.spec.ts`

#### 3.1. Bugs per project chart shows the correct totals and tooltip details

**File:** `tests/e2e/dashboard-project-chart.spec.ts`

**Steps:**
  1. Open the default dashboard and hover a project bar in the Bugs por Projeto chart.
    - expect: Each visible bar represents a project present in the filtered dataset.
    - expect: The tooltip shows the project name, total gaps/relatos, bug rate, and density.
    - expect: The project labels are normalized to the UI names such as API, App Campo, App Social, Gov, Portal, and WhatsApp.
    - expect: The total bug values match the aggregated task records after filter selection.

#### 3.2. Monthly evolution chart is consistent with created/finished/bug counts

**File:** `tests/e2e/dashboard-monthly-chart.spec.ts`

**Steps:**
  1. Inspect the monthly line chart on the default dataset, then apply a date filter.
    - expect: The chart contains the month buckets in the selected date range and uses the same month labels as the source data.
    - expect: The series names are 'Criados', 'Finalizados (por mês de criação)', and 'Relatos'.
    - expect: Each point matches the monthly totals derived from the filtered dataset.
    - expect: When the range is narrowed, the chart series shrink to the matching months without breaking or duplicating values.

#### 3.3. Cycle-time table shows average hours by size and empty-state handling

**File:** `tests/e2e/dashboard-cycle-time.spec.ts`

**Steps:**
  1. Review the table rendered in the cycle-time section for the current filter selection.
    - expect: The table includes rows for micro, p, m, g, and gg.
    - expect: For sizes with cards, the Cards count is positive and the Tempo médio is a numeric value ending in 'h'.
    - expect: For sizes with no data in the filtered set, the table shows a placeholder such as '—' instead of NaN or a broken value.
    - expect: The average values align with the actual cycleHours computed for the selection.

#### 3.4. Top bug table ranks the most problematic cards and respects the top 20 limit

**File:** `tests/e2e/dashboard-top-bugs.spec.ts`

**Steps:**
  1. Inspect the Top 20 table on the default loaded dashboard and then re-run it after a project filter.
    - expect: The table is ordered by bug count descending, with rank #1 at the highest value.
    - expect: Each row contains the card name, bug count, project, and status.
    - expect: The list is limited to 20 rows, even when more cards have bug reports.
    - expect: The table updates to the filtered subset without retaining stale records from the broader dataset.
