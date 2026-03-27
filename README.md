# Medieval French Corpus Tool

A comprehensive tool for exploring and analyzing Medieval French texts encoded in XML-TEI format.

## Features

- **Multi-format support**: Parses CATTEX, TXM, and PRESTO annotated texts
- **Advanced queries**: Search by lemma, POS, with exclusions and variations
- **Context windows**: Get N words before/after matches
- **Sequence queries**: Find multi-word patterns
- **Datasets**: Create sub-corpora from query results
- **Frequency analysis**: Analyze distribution by genre, domain, and time period
- **Metadata system**: Two-level classification (domain → genre)

## Quick Start

### 1. Build and Run with Docker

```bash
# Build containers
docker-compose build

# Start backend
docker-compose up backend

# Access API at http://localhost:8000
```

### 2. Initialize Database

```bash
# Enter container
docker exec -it medieval-corpus-backend bash

# Initialize database
python cli.py init
```

### 3. Load Your First Text

```bash
# Load a single file
python cli.py load textes/charrette.xml \
  --title "Le Chevalier de la Charrette" \
  --domain fiction \
  --genre romance \
  --period-start 1170 \
  --period-end 1190

# Or load entire directory
python cli.py load-dir textes/
```

### 4. Set Metadata (if not set during loading)

```bash
python cli.py metadata charrette.xml \
  --domain fiction \
  --genre romance \
  --period-start 1170 \
  --period-end 1190
```

### 5. Query the Corpus

```bash
# Simple lemma query
python cli.py query --lemma roi --limit 10

# Query with variations (OR logic)
python cli.py query --lemma "roi/comte/baron" --limit 10

# Query with exclusions
python cli.py query --pos DET --not-lemma "le/la/les" --limit 10

# Combined query with context
python cli.py query \
  --lemma roi \
  --pos NOUN \
  --genre romance \
  --context-before 5 \
  --context-after 5 \
  --limit 20

# Sequence query
python cli.py sequence '[{"pos":"DET"},{"lemma":"roi"},{"pos":"VERB"}]' --limit 10
```

### 6. Get Frequency Statistics

```bash
# Total frequency of a lemma
python cli.py frequency --lemma roi

# Frequency by genre
python cli.py frequency --lemma roi --by-genre

# Frequency over time (50-year bins)
python cli.py frequency --lemma roi --by-period --bin-size 50

# Top 20 most frequent lemmas
python cli.py frequency
```

### 7. Create Datasets (Sub-corpora)

```bash
# Create dataset from query results
python cli.py create-dataset roi_contexts \
  --lemma roi \
  --genre romance \
  --context-before 10 \
  --context-after 10 \
  --description "All occurrences of 'roi' in romances"
```

### 8. View Corpus Statistics

```bash
python cli.py stats
```

### 9. List All Texts

```bash
python cli.py list
```

## CLI Command Reference

### Database

```bash
# Initialize database
cli.py init
```

### Loading Texts

```bash
# Load single file
cli.py load <file> [--title TITLE] [--domain DOMAIN] [--genre GENRE]
             [--period-start YEAR] [--period-end YEAR]

# Load directory
cli.py load-dir <directory> [--pattern PATTERN]
```

### Metadata

```bash
# Set/update metadata
cli.py metadata <filename> [--title TITLE] [--domain DOMAIN] [--genre GENRE]
                [--period-start YEAR] [--period-end YEAR]
```

### Queries

```bash
# Query by lemma/POS
cli.py query [--lemma LEMMA] [--pos POS] [--not-lemma LEMMA] [--not-pos POS]
             [--domain DOMAIN] [--genre GENRE]
             [--context-before N] [--context-after N]
             [--limit N]

# Sequence query
cli.py sequence '<pattern-json>' [--domain DOMAIN] [--genre GENRE]
                [--context-before N] [--context-after N] [--limit N]
```

### Frequency Analysis

```bash
# Lemma frequency
cli.py frequency [--lemma LEMMA] [--domain DOMAIN] [--genre GENRE]
                 [--by-genre] [--by-period] [--bin-size YEARS]
```

### Datasets

```bash
# Create dataset
cli.py create-dataset <name> [--lemma LEMMA] [--pos POS]
                      [--domain DOMAIN] [--genre GENRE]
                      [--context-before N] [--context-after N]
                      [--description DESC]
```

### Statistics

```bash
# Corpus statistics
cli.py stats

# List texts
cli.py list
```

## Query Syntax

### Variations (OR logic)

Use `/` to specify alternatives:

```bash
# Multiple lemmas: find "roi" OR "comte" OR "baron"
--lemma "roi/comte/baron"

# Multiple POS: find NOUN OR DET
--pos "NOUN/DET"
```

### Exclusions

Use `--not-*` parameters:

```bash
# Find all DET except "le", "la", "les"
--pos DET --not-lemma "le/la/les"

# Find "roi" but not as proper noun
--lemma roi --not-pos PROPN
```

### Sequence Patterns

JSON format with optional exclusions:

```json
[
  {"pos": "DET", "not_lemma": "le/la/les"},
  {"lemma": "roi/comte"},
  {"pos": "VERB", "not_lemma": "être/avoir"}
]
```

## Supported XML-TEI Formats

### Format 1: CATTEX

```xml
<w type="NOMcom" lemma="roi" ana="#...">roi</w>
```

### Format 2: TXM

```xml
<w id="w_123">
  <txm:form>roi</txm:form>
  <txm:ana type="#lemma">|roi|</txm:ana>
  <txm:ana type="#ud-pos">NOUN</txm:ana>
</w>
```

### Format 3: PRESTO

```xml
<w lemma="ROI" pos="Nc" n="123">roi</w>
```

All formats are automatically converted to Universal Dependencies POS tags.

## Metadata Classification

Two-level hierarchy:

**Domain** (high-level category):
- fiction
- religious
- law
- scientific
- administrative
- etc.

**Genre** (specific category):
- romance
- epic
- hagiography
- coutumier
- medical
- etc.

## Development Roadmap

- [x] **Phase 1**: Core Database & Query Engine ← **YOU ARE HERE**
- [ ] **Phase 4**: Web Interface (React)
- [ ] **Phase 5**: Visualization
- [ ] **Phase 2**: REST API
- [ ] **Phase 3**: Authentication & RBAC
- [ ] **Phase 6**: MCP Integration
- [ ] **Phase 7**: Polish & Optimization

## Architecture

```
backend/
├── app/
│   ├── core/           # Configuration, database
│   ├── models/         # SQLAlchemy models
│   ├── parsers/        # XML parsers (CATTEX, TXM, PRESTO)
│   ├── queries/        # Query engine, frequency analysis
│   └── main.py         # FastAPI application
├── cli.py              # Command-line interface
└── Dockerfile

data/
└── corpus.db           # SQLite database
```

## License

MIT License

## Support

For issues and questions, please check the documentation or open an issue.
