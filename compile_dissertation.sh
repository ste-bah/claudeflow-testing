#!/bin/bash
# Compile dissertation_enhanced.tex to PDF
# Requires: texlive-latex-base texlive-latex-extra texlive-bibtex-extra biber

cd "$(dirname "$0")"

echo "Compiling dissertation_enhanced.tex..."

# First pass
pdflatex -interaction=nonstopmode dissertation_enhanced.tex

# Run biber for bibliography
biber dissertation_enhanced

# Second and third pass for references
pdflatex -interaction=nonstopmode dissertation_enhanced.tex
pdflatex -interaction=nonstopmode dissertation_enhanced.tex

# Move PDF to main directory if it exists
if [ -f dissertation_enhanced.pdf ]; then
    echo "Success! PDF created: dissertation_enhanced.pdf"
else
    echo "Error: PDF was not created. Check for LaTeX errors above."
fi
