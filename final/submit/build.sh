#!/bin/bash
# WACMR Report Build Script

PDFLATEX=/Library/TeX/texbin/pdflatex
TLMGR=/Library/TeX/texbin/tlmgr

# 1. Initialize usermode tlmgr if not already done
if [ ! -d "$HOME/Library/texmf" ]; then
    echo "Initializing tlmgr usermode tree..."
    $TLMGR --usermode init-usertree
fi

# 2. Check and install missing packages
PACKAGES=(multirow longtable enumitem tcolorbox fancyhdr titlesec wrapfig environ trimspaces psnfss caption subcaption tikzfill pdfcol listingsutf8)
echo "Ensuring required packages are installed..."
$TLMGR --usermode install "${PACKAGES[@]}"

# 3. Compile main.tex (3 passes for references)
echo "Compiling main.tex (Pass 1/3)..."
$PDFLATEX -interaction=nonstopmode main.tex > /dev/null
echo "Compiling main.tex (Pass 2/3)..."
$PDFLATEX -interaction=nonstopmode main.tex > /dev/null
echo "Compiling main.tex (Pass 3/3)..."
$PDFLATEX -interaction=nonstopmode main.tex

if [ $? -eq 0 ]; then
    echo "========================================"
    echo "SUCCESS: main.pdf generated successfully."
    echo "========================================"
else
    echo "========================================"
    echo "ERROR: Compilation failed. Check main.log."
    echo "========================================"
fi
