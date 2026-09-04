from pathlib import Path
from app.services.persona_pipeline.main import run_pipeline_from_pdf


def process_pdf_pipeline(pdf_path: Path) -> dict:
    """
    Adapter between FastAPI routes and persona pipeline.
    """
    return run_pipeline_from_pdf(pdf_path)
