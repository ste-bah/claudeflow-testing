import PyPDF2
import sys

def extract_text(pdf_path, output_path):
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        with open(output_path, 'w') as out:
            for i, page in enumerate(reader.pages):
                out.write(f"--- Page {i+1} ---\n")
                out.write((page.extract_text() or "") + "\n\n")

if __name__ == "__main__":
    extract_text(sys.argv[1], sys.argv[2])
