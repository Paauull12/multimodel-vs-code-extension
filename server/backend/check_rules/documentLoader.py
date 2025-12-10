from pathlib import Path
import PyPDF2
import docx

class DocumentLoader:
    """Load documents from various formats"""
    
    @staticmethod
    def load_txt(file_path: str) -> str:
        """Load text file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    @staticmethod
    def load_pdf(file_path: str) -> str:
        """Load PDF file"""
        text = ""
        with open(file_path, 'rb') as f:
            pdf_reader = PyPDF2.PdfReader(f)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        return text
    
    @staticmethod
    def load_docx(file_path: str) -> str:
        """Load DOCX file"""
        doc = docx.Document(file_path)
        return "\n".join([paragraph.text for paragraph in doc.paragraphs])
    
    @classmethod
    def load(cls, file_path: str) -> str:
        """Auto-detect and load document"""
        ext = Path(file_path).suffix.lower()
        
        if ext == '.txt':
            return cls.load_txt(file_path)
        elif ext == '.pdf':
            return cls.load_pdf(file_path)
        elif ext == '.docx':
            return cls.load_docx(file_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

# Test the loader
print("DocumentLoader ready")