import os
import glob

# Find the PDF file
folder = r'c:\Users\davib\Documents\Uniandes\Crea\GeoSound'
pdfs = glob.glob(os.path.join(folder, '*.pdf'))
print("PDFs found:", pdfs)

if pdfs:
    pdf_path = pdfs[0]
    print(f"Reading: {pdf_path}")
    try:
        import fitz
        doc = fitz.open(pdf_path)
        full_text = ''
        for i, page in enumerate(doc):
            full_text += f'\n\n--- PAGE {i+1} ---\n'
            full_text += page.get_text()
        
        out_path = os.path.join(folder, 'thesis_text.txt')
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(full_text)
        print(f"Saved to {out_path}")
        print(f"Total characters: {len(full_text)}")
        print("\n--- FIRST 3000 CHARS ---")
        print(full_text[:3000])
    except ImportError:
        print("PyMuPDF not found, trying pdfplumber...")
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            full_text = ''
            for i, page in enumerate(pdf.pages):
                full_text += f'\n\n--- PAGE {i+1} ---\n'
                text = page.extract_text()
                if text:
                    full_text += text
        out_path = os.path.join(folder, 'thesis_text.txt')
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(full_text)
        print(f"Saved to {out_path}")
        print(f"Total characters: {len(full_text)}")
        print("\n--- FIRST 3000 CHARS ---")
        print(full_text[:3000])
else:
    print("No PDF found in folder!")
