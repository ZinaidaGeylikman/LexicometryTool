"""
Corpus manager - handles loading texts into database
"""
from typing import Optional
from pathlib import Path
from sqlalchemy.orm import Session
from ..models import Text, Token
from ..parsers import XMLParser
from ..parsers.tei_metadata import TEIMetadataExtractor


class CorpusManager:
    """Manages corpus loading and text metadata"""

    def __init__(self, db: Session):
        self.db = db

    def load_text(
        self,
        filepath: str,
        title: Optional[str] = None,
        author: Optional[str] = None,
        source_db: Optional[str] = None,
        source_db_url: Optional[str] = None,
        domain: Optional[str] = None,
        genre: Optional[str] = None,
        period_start: Optional[int] = None,
        period_end: Optional[int] = None,
        ms_date_start: Optional[int] = None,
        ms_date_end: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> int:
        """
        Load an XML-TEI text into the database

        Args:
            filepath: Path to XML file
            title: Text title (optional, uses filename if not provided)
            domain: Domain classification (e.g., "fiction", "law", "religious")
            genre: Genre classification (e.g., "romance", "epic", "hagiography")
            period_start: Start of text's time period (year)
            period_end: End of text's time period (year)
            user_id: User who added the text

        Returns:
            text_id of the loaded text
        """
        filepath = Path(filepath)

        if not filepath.exists():
            raise FileNotFoundError(f"File not found: {filepath}")

        filename = filepath.name

        # Check if already loaded
        existing = self.db.query(Text).filter(Text.filename == filename).first()
        if existing:
            raise ValueError(f"Text '{filename}' already loaded (text_id={existing.text_id})")

        # Extract metadata from TEI header (always, to capture header_meta)
        print(f"Extracting metadata from TEI header...")
        tei_metadata = TEIMetadataExtractor.extract_metadata(str(filepath))

        if title is None and tei_metadata.title:
            title = tei_metadata.title
            print(f"  Found title: {title}")

        if author is None and tei_metadata.author:
            author = tei_metadata.author
            print(f"  Found author: {author}")

        if period_start is None and tei_metadata.period_start:
            period_start = tei_metadata.period_start
            print(f"  Found period start: {period_start}")

        if period_end is None and tei_metadata.period_end:
            period_end = tei_metadata.period_end
            print(f"  Found period end: {period_end}")

        if ms_date_start is None and tei_metadata.ms_date_start:
            ms_date_start = tei_metadata.ms_date_start
            print(f"  Found ms date start: {ms_date_start}")

        if ms_date_end is None and tei_metadata.ms_date_end:
            ms_date_end = tei_metadata.ms_date_end
            print(f"  Found ms date end: {ms_date_end}")

        tei_header_meta = tei_metadata.header_meta or None

        # Parse XML
        print(f"Parsing {filename}...")
        format_type, parsed_tokens = XMLParser.parse_file(str(filepath))

        if not parsed_tokens:
            raise ValueError(f"No tokens found in {filename}")

        # Create text record
        text = Text(
            filename=filename,
            title=title or filename,
            author=author,
            source_db=source_db,
            source_db_url=source_db_url,
            tei_header_meta=tei_header_meta,
            domain=domain,
            genre=genre,
            period_start=period_start,
            period_end=period_end,
            ms_date_start=ms_date_start,
            ms_date_end=ms_date_end,
            added_by_user_id=user_id,
            format_type=format_type,
            token_count=len(parsed_tokens)
        )

        self.db.add(text)
        self.db.flush()  # Get text_id

        # Add tokens
        print(f"Loading {len(parsed_tokens)} tokens...")

        for parsed_token in parsed_tokens:
            token = Token(
                text_id=text.text_id,
                position=parsed_token.position,
                token=parsed_token.token,
                lemma=parsed_token.lemma,
                lemma_dmf=parsed_token.lemma_dmf,
                pos=parsed_token.pos,
                citation=parsed_token.citation
            )
            self.db.add(token)

        self.db.commit()

        print(f"✓ Loaded {filename} (text_id={text.text_id}, {len(parsed_tokens)} tokens)")

        return text.text_id

    def update_text_metadata(
        self,
        text_id: int,
        title: Optional[str] = None,
        author: Optional[str] = None,
        source_db: Optional[str] = None,
        source_db_url: Optional[str] = None,
        domain: Optional[str] = None,
        genre: Optional[str] = None,
        period_start: Optional[int] = None,
        period_end: Optional[int] = None,
        ms_date_start: Optional[int] = None,
        ms_date_end: Optional[int] = None,
        force_update_fields: Optional[set] = None,
    ) -> bool:
        """Update metadata for an existing text.
        force_update_fields: field names to update even when value is None (clears the field).
        """
        text = self.db.query(Text).filter(Text.text_id == text_id).first()

        if not text:
            return False

        force = force_update_fields or set()

        def s(v):
            return v.strip() if isinstance(v, str) and v else (None if isinstance(v, str) else v)

        if title is not None or 'title' in force:
            text.title = s(title)
        if author is not None or 'author' in force:
            text.author = s(author)
        if source_db is not None or 'source_db' in force:
            text.source_db = s(source_db)
        if source_db_url is not None or 'source_db_url' in force:
            text.source_db_url = s(source_db_url)
        if domain is not None or 'domain' in force:
            text.domain = s(domain)
        if genre is not None or 'genre' in force:
            text.genre = s(genre)
        if period_start is not None or 'period_start' in force:
            text.period_start = period_start
        if period_end is not None or 'period_end' in force:
            text.period_end = period_end
        if ms_date_start is not None or 'ms_date_start' in force:
            text.ms_date_start = ms_date_start
        if ms_date_end is not None or 'ms_date_end' in force:
            text.ms_date_end = ms_date_end

        self.db.commit()
        return True

    def update_text_metadata_by_filename(
        self,
        filename: str,
        title: Optional[str] = None,
        author: Optional[str] = None,
        source_db: Optional[str] = None,
        source_db_url: Optional[str] = None,
        domain: Optional[str] = None,
        genre: Optional[str] = None,
        period_start: Optional[int] = None,
        period_end: Optional[int] = None,
        ms_date_start: Optional[int] = None,
        ms_date_end: Optional[int] = None,
    ) -> bool:
        """Update metadata for a text by filename"""
        text = self.db.query(Text).filter(Text.filename == filename).first()

        if not text:
            return False

        return self.update_text_metadata(
            text.text_id,
            title=title,
            author=author,
            source_db=source_db,
            source_db_url=source_db_url,
            domain=domain,
            genre=genre,
            period_start=period_start,
            period_end=period_end,
            ms_date_start=ms_date_start,
            ms_date_end=ms_date_end,
        )

    def get_text(self, text_id: int) -> Optional[Text]:
        """Get text by ID"""
        return self.db.query(Text).filter(Text.text_id == text_id).first()

    def get_text_by_filename(self, filename: str) -> Optional[Text]:
        """Get text by filename"""
        return self.db.query(Text).filter(Text.filename == filename).first()

    def list_texts(self) -> list[Text]:
        """List all texts"""
        from sqlalchemy import nulls_last
        return self.db.query(Text).order_by(nulls_last(Text.period_start.asc())).all()

    def delete_text(self, text_id: int) -> bool:
        """Delete a text and all its tokens"""
        text = self.get_text(text_id)

        if not text:
            return False

        self.db.delete(text)  # Cascade will delete tokens
        self.db.commit()
        return True

    def load_directory(
        self,
        directory: str,
        pattern: str = "*.xml",
        user_id: Optional[int] = None,
    ) -> list[int]:
        """
        Load all XML files from a directory

        Args:
            directory: Directory path
            pattern: File pattern (default: "*.xml")
            user_id: User ID

        Returns:
            List of text_ids for loaded texts
        """
        directory = Path(directory)

        if not directory.exists():
            raise FileNotFoundError(f"Directory not found: {directory}")

        xml_files = list(directory.glob(pattern))

        if not xml_files:
            print(f"No files matching '{pattern}' found in {directory}")
            return []

        print(f"Found {len(xml_files)} files")

        text_ids = []

        for xml_file in xml_files:
            try:
                text_id = self.load_text(
                    str(xml_file),
                    user_id=user_id
                )
                text_ids.append(text_id)
            except Exception as e:
                print(f"✗ Error loading {xml_file.name}: {e}")
                continue

        return text_ids
