#!/bin/bash
# Quick setup script for loading your three texts

echo "=== Medieval French Corpus - Initial Setup ==="
echo ""

# Initialize database
echo "1. Initializing database..."
python cli.py init
echo ""

# Load CharretteKu.xml
echo "2. Loading CharretteKu.xml..."
python cli.py load textes/CharretteKu.xml \
  --domain fiction \
  --genre romance
echo ""

# Load roland.xml
echo "3. Loading roland.xml..."
python cli.py load textes/roland.xml \
  --domain fiction \
  --genre epic
echo ""

# Load tac_base.xml
echo "4. Loading tac_base.xml..."
python cli.py load textes/tac_base.xml \
  --domain law \
  --genre coutumier
echo ""

# Show statistics
echo "5. Corpus statistics:"
python cli.py stats
echo ""

# List loaded texts
echo "6. Loaded texts:"
python cli.py list
echo ""

echo "✓ Setup complete!"
echo ""
echo "Try some queries:"
echo "  python cli.py query --lemma roi --limit 10"
echo "  python cli.py frequency --lemma roi --by-genre"
