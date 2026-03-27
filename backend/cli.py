#!/usr/bin/env python3
"""
Command-line interface for Medieval French Corpus Tool
For testing and batch operations
"""
import argparse
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import SessionLocal, init_db
from app.core.corpus_manager import CorpusManager
from app.queries import QueryEngine, FrequencyAnalyzer, DatasetManager
from app.models import Text
import json


def init_database():
    """Initialize the database"""
    print("Initializing database...")
    init_db()
    print("✓ Database initialized")


def load_text(args):
    """Load a text file"""
    db = SessionLocal()
    try:
        manager = CorpusManager(db)
        text_id = manager.load_text(
            filepath=args.file,
            title=args.title,
            domain=args.domain,
            genre=args.genre,
            period_start=args.period_start,
            period_end=args.period_end
        )
        print(f"✓ Text loaded successfully (ID: {text_id})")
    except Exception as e:
        print(f"✗ Error: {e}")
    finally:
        db.close()


def load_directory_cmd(args):
    """Load all files from a directory"""
    db = SessionLocal()
    try:
        manager = CorpusManager(db)
        text_ids = manager.load_directory(
            directory=args.directory,
            pattern=args.pattern or "*.xml"
        )
        print(f"✓ Loaded {len(text_ids)} texts")
    except Exception as e:
        print(f"✗ Error: {e}")
    finally:
        db.close()


def set_metadata(args):
    """Set metadata for a text"""
    db = SessionLocal()
    try:
        manager = CorpusManager(db)
        success = manager.update_text_metadata_by_filename(
            filename=args.filename,
            title=args.title,
            domain=args.domain,
            genre=args.genre,
            period_start=args.period_start,
            period_end=args.period_end
        )
        if success:
            print(f"✓ Metadata updated for {args.filename}")
        else:
            print(f"✗ Text not found: {args.filename}")
    except Exception as e:
        print(f"✗ Error: {e}")
    finally:
        db.close()


def list_texts_cmd(args):
    """List all texts"""
    db = SessionLocal()
    try:
        manager = CorpusManager(db)
        texts = manager.list_texts()

        if not texts:
            print("No texts loaded")
            return

        print(f"\n{'ID':<5} {'Filename':<30} {'Domain':<15} {'Genre':<15} {'Tokens':<10}")
        print("-" * 80)

        for text in texts:
            print(f"{text.text_id:<5} {text.filename:<30} {text.domain or '':<15} {text.genre or '':<15} {text.token_count:<10}")

        print(f"\nTotal: {len(texts)} texts")

    finally:
        db.close()


def query_lemma_cmd(args):
    """Query by lemma"""
    db = SessionLocal()
    try:
        engine = QueryEngine(db)
        results = engine.query(
            lemma=args.lemma,
            pos=args.pos,
            not_lemma=args.not_lemma,
            not_pos=args.not_pos,
            domain=args.domain,
            genre=args.genre,
            context_before=args.context_before or 0,
            context_after=args.context_after or 0,
            limit=args.limit or 100
        )

        print(f"\nFound {len(results)} results")
        print("-" * 80)

        for i, result in enumerate(results[:args.limit or 100], 1):
            # Print context before
            if result.context_before:
                print(' '.join([t['token'] for t in result.context_before]), end=' ')

            # Print match (highlighted)
            print(f"[{result.token}]", end=' ')

            # Print context after
            if result.context_after:
                print(' '.join([t['token'] for t in result.context_after]), end='')

            # Display citation (line number or manuscript ref) instead of position
            citation_str = f"(line {result.citation})" if result.citation else f"(pos {result.position})"
            print(f"\n  → {result.text_filename} {citation_str} - {result.lemma}/{result.pos}")

            if i < len(results) and i % 5 == 0:
                print()

    finally:
        db.close()


def query_sequence_cmd(args):
    """Query sequences"""
    db = SessionLocal()
    try:
        # Parse pattern from JSON
        pattern = json.loads(args.pattern)

        engine = QueryEngine(db)
        results = engine.query_sequence(
            pattern=pattern,
            domain=args.domain,
            genre=args.genre,
            context_before=args.context_before or 0,
            context_after=args.context_after or 0,
            limit=args.limit or 50
        )

        print(f"\nFound {len(results)} sequences")
        print("-" * 80)

        for i, sequence in enumerate(results[:args.limit or 50], 1):
            tokens = ' '.join([r.token for r in sequence])
            print(f"{i}. [{tokens}]")
            # Display citation for first token in sequence
            citation_str = f"(line {sequence[0].citation})" if sequence[0].citation else f"(pos {sequence[0].position})"
            print(f"   → {sequence[0].text_filename} {citation_str}")

    except json.JSONDecodeError:
        print("✗ Invalid pattern format. Use JSON, e.g.: '[{\"pos\":\"DET\"},{\"lemma\":\"roi\"}]'")
    finally:
        db.close()


def frequency_cmd(args):
    """Get frequency statistics"""
    db = SessionLocal()
    try:
        analyzer = FrequencyAnalyzer(db)

        if args.by_genre:
            freq = analyzer.lemma_frequency_by_genre(
                lemma=args.lemma,
                domain=args.domain,
                normalize=args.normalize,
                per_n_words=args.per_n_words or 10000
            )
            unit = f"per {args.per_n_words or 10000} words" if args.normalize else "occurrences"
            print(f"\nFrequency of '{args.lemma}' by genre ({unit}):")
            for genre, count in sorted(freq.items(), key=lambda x: x[1], reverse=True):
                if args.normalize:
                    print(f"  {genre:<20} {count:>8.2f}")
                else:
                    print(f"  {genre:<20} {count:>8}")

        elif args.by_domain:
            freq = analyzer.lemma_frequency_by_domain(
                lemma=args.lemma,
                normalize=args.normalize,
                per_n_words=args.per_n_words or 10000
            )
            unit = f"per {args.per_n_words or 10000} words" if args.normalize else "occurrences"
            print(f"\nFrequency of '{args.lemma}' by domain ({unit}):")
            for domain, count in sorted(freq.items(), key=lambda x: x[1], reverse=True):
                if args.normalize:
                    print(f"  {domain:<20} {count:>8.2f}")
                else:
                    print(f"  {domain:<20} {count:>8}")

        elif args.by_period:
            freq = analyzer.lemma_frequency_by_period(
                lemma=args.lemma,
                bin_size=args.bin_size or 50,
                domain=args.domain,
                genre=args.genre
            )
            print(f"\nFrequency of '{args.lemma}' over time:")
            for period, count in sorted(freq.items()):
                print(f"  {period}-{period+args.bin_size or 50:<10} {count:>6}")

        else:
            freq = analyzer.lemma_frequency(
                lemma=args.lemma,
                domain=args.domain,
                genre=args.genre
            )
            if args.lemma:
                total = sum(freq.values())
                print(f"\nTotal occurrences of '{args.lemma}': {total}")
            else:
                print(f"\nTop 20 lemmas:")
                for lemma, count in sorted(freq.items(), key=lambda x: x[1], reverse=True)[:20]:
                    print(f"  {lemma:<20} {count:>6}")

    finally:
        db.close()


def stats_cmd(args):
    """Show corpus statistics"""
    db = SessionLocal()
    try:
        analyzer = FrequencyAnalyzer(db)
        stats = analyzer.corpus_statistics()

        print("\n=== Corpus Statistics ===")
        print(f"Total texts:  {stats['total_texts']:,}")
        print(f"Total tokens: {stats['total_tokens']:,}")
        print(f"Unique lemmas: {stats['unique_lemmas']:,}")

        print("\nTokens by domain:")
        for domain, count in sorted(stats['tokens_by_domain'].items(), key=lambda x: x[1], reverse=True):
            print(f"  {domain:<20} {count:>10,}")

        print("\nTokens by genre:")
        for genre, count in sorted(stats['tokens_by_genre'].items(), key=lambda x: x[1], reverse=True):
            print(f"  {genre:<20} {count:>10,}")

    finally:
        db.close()


def create_dataset_cmd(args):
    """Create a dataset from query results"""
    db = SessionLocal()
    try:
        manager = DatasetManager(db)

        query_params = {
            'lemma': args.lemma,
            'pos': args.pos,
            'domain': args.domain,
            'genre': args.genre,
            'context_before': args.context_before or 5,
            'context_after': args.context_after or 5,
        }

        # Remove None values
        query_params = {k: v for k, v in query_params.items() if v is not None}

        dataset_id = manager.create_dataset(
            name=args.name,
            query_params=query_params,
            description=args.description
        )

        print(f"✓ Dataset '{args.name}' created (ID: {dataset_id})")

    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Medieval French Corpus Tool CLI")
    subparsers = parser.add_subparsers(dest='command', help='Command')

    # Init database
    parser_init = subparsers.add_parser('init', help='Initialize database')

    # Load text
    parser_load = subparsers.add_parser('load', help='Load a text file')
    parser_load.add_argument('file', help='XML file to load')
    parser_load.add_argument('--title', help='Text title')
    parser_load.add_argument('--domain', help='Domain (e.g., fiction, law, religious)')
    parser_load.add_argument('--genre', help='Genre (e.g., romance, epic, hagiography)')
    parser_load.add_argument('--period-start', type=int, help='Period start year')
    parser_load.add_argument('--period-end', type=int, help='Period end year')

    # Load directory
    parser_load_dir = subparsers.add_parser('load-dir', help='Load all files from directory')
    parser_load_dir.add_argument('directory', help='Directory path')
    parser_load_dir.add_argument('--pattern', default='*.xml', help='File pattern (default: *.xml)')

    # Set metadata
    parser_meta = subparsers.add_parser('metadata', help='Set metadata for a text')
    parser_meta.add_argument('filename', help='Filename')
    parser_meta.add_argument('--title', help='Text title')
    parser_meta.add_argument('--domain', help='Domain')
    parser_meta.add_argument('--genre', help='Genre')
    parser_meta.add_argument('--period-start', type=int, help='Period start year')
    parser_meta.add_argument('--period-end', type=int, help='Period end year')

    # List texts
    parser_list = subparsers.add_parser('list', help='List all texts')

    # Query lemma
    parser_query = subparsers.add_parser('query', help='Query by lemma/POS')
    parser_query.add_argument('--lemma', help='Lemma to search (supports roi/conte/baron)')
    parser_query.add_argument('--pos', help='POS tag (supports NOUN/DET)')
    parser_query.add_argument('--not-lemma', help='Lemmas to exclude')
    parser_query.add_argument('--not-pos', help='POS tags to exclude')
    parser_query.add_argument('--domain', help='Filter by domain')
    parser_query.add_argument('--genre', help='Filter by genre')
    parser_query.add_argument('--context-before', type=int, help='Context words before')
    parser_query.add_argument('--context-after', type=int, help='Context words after')
    parser_query.add_argument('--limit', type=int, default=100, help='Max results')

    # Query sequence
    parser_seq = subparsers.add_parser('sequence', help='Query sequences')
    parser_seq.add_argument('pattern', help='Pattern as JSON, e.g. \'[{"pos":"DET"},{"lemma":"roi"}]\'')
    parser_seq.add_argument('--domain', help='Filter by domain')
    parser_seq.add_argument('--genre', help='Filter by genre')
    parser_seq.add_argument('--context-before', type=int, help='Context words before')
    parser_seq.add_argument('--context-after', type=int, help='Context words after')
    parser_seq.add_argument('--limit', type=int, default=50, help='Max results')

    # Frequency
    parser_freq = subparsers.add_parser('frequency', help='Get frequency statistics')
    parser_freq.add_argument('--lemma', help='Lemma to analyze')
    parser_freq.add_argument('--domain', help='Filter by domain')
    parser_freq.add_argument('--genre', help='Filter by genre')
    parser_freq.add_argument('--by-genre', action='store_true', help='Break down by genre')
    parser_freq.add_argument('--by-domain', action='store_true', help='Break down by domain')
    parser_freq.add_argument('--by-period', action='store_true', help='Break down by period')
    parser_freq.add_argument('--bin-size', type=int, default=50, help='Period bin size in years')
    parser_freq.add_argument('--normalize', action='store_true', help='Show relative frequency (per N words)')
    parser_freq.add_argument('--per-n-words', type=int, default=10000, help='Normalization base (default: 10000)')

    # Statistics
    parser_stats = subparsers.add_parser('stats', help='Show corpus statistics')

    # Create dataset
    parser_dataset = subparsers.add_parser('create-dataset', help='Create dataset from query')
    parser_dataset.add_argument('name', help='Dataset name')
    parser_dataset.add_argument('--lemma', help='Lemma to search')
    parser_dataset.add_argument('--pos', help='POS tag')
    parser_dataset.add_argument('--domain', help='Domain filter')
    parser_dataset.add_argument('--genre', help='Genre filter')
    parser_dataset.add_argument('--context-before', type=int, default=5, help='Context before')
    parser_dataset.add_argument('--context-after', type=int, default=5, help='Context after')
    parser_dataset.add_argument('--description', help='Dataset description')

    args = parser.parse_args()

    if args.command == 'init':
        init_database()
    elif args.command == 'load':
        load_text(args)
    elif args.command == 'load-dir':
        load_directory_cmd(args)
    elif args.command == 'metadata':
        set_metadata(args)
    elif args.command == 'list':
        list_texts_cmd(args)
    elif args.command == 'query':
        query_lemma_cmd(args)
    elif args.command == 'sequence':
        query_sequence_cmd(args)
    elif args.command == 'frequency':
        frequency_cmd(args)
    elif args.command == 'stats':
        stats_cmd(args)
    elif args.command == 'create-dataset':
        create_dataset_cmd(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
