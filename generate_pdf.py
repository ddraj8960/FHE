import re
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# Regex to strip emojis/non-standard unicode characters that Helvetica cannot render
EMOJI_RE = re.compile(r'[\U00010000-\U0010ffff\u2600-\u27ff\u2b50\u2b06\u2190-\u21ff\u200d\u2640-\u2642\u26a0\u2623\u2714\u2611\u2705]', flags=re.UNICODE)

def clean_text(text: str) -> str:
    # Remove emojis
    text = EMOJI_RE.sub('', text)
    # Replace common symbols that might fail in Helvetica
    replacements = {
        '🛡️': '',
        '📌': '',
        '🚶‍♂️': '',
        '🚶': '',
        '🛠️': '',
        '🛠': '',
        '❓': '',
        '🌟': '',
        '🔍': '',
        '🔓': '',
        '⚠': 'WARNING: ',
        '☣': 'DANGER: ',
        '✓': '[YES]',
        '✔': '[YES]',
        '—': '-',
        '’': "'",
        '‘': "'",
        '”': '"',
        '“': '"',
        '…': '...',
        '–': '-',
        '≈': '~',
        '•': '*',
        '²': '^2',
        '³': '^3'
    }
    for orig, rep in replacements.items():
        text = text.replace(orig, rep)
    
    # Replace markdown bold **text** with Reportlab bold <b>text</b>
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    # Replace markdown italic *text* with Reportlab italic <i>text</i>
    text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
    # Replace inline code `code` with a subtle styling
    text = re.sub(r'`(.*?)`', r'<font face="Courier" color="#FF5A00"><b>\1</b></font>', text)
    # Replace markdown links [text](url) with just text and url in bold
    text = re.sub(r'\[(.*?)\]\(file:///.*?\)', r'<b>\1</b>', text)
    text = re.sub(r'\[(.*?)\]\((.*?)\)', r'<b>\1</b> (<i>\2</i>)', text)
    
    return text.strip()

def build_pdf():
    input_file = "mentor_demo_guide.md"
    output_file = "mentor_demo_guide.pdf"
    
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return
        
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    # Setup document template
    margin = 54 # 0.75 inch
    doc = SimpleDocTemplate(
        output_file,
        pagesize=letter,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=margin,
        bottomMargin=margin
    )
    
    # Setup styles
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=28,
        textColor=colors.HexColor('#1E293B'), # Dark slate
        alignment=TA_LEFT,
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#64748B'), # Slate gray
        spaceAfter=15
    )
    
    h1_style = ParagraphStyle(
        'DocH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#1E3A8A'), # Deep blue
        spaceBefore=12,
        spaceAfter=8,
        keepWithNext=True
    )
    
    h2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#0F172A'), # Slate
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor('#334155'), # Slate 700
        spaceBefore=3,
        spaceAfter=6
    )
    
    bullet_style = ParagraphStyle(
        'DocBullet',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceBefore=2,
        spaceAfter=2
    )
    
    quote_style = ParagraphStyle(
        'DocQuote',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor('#1E293B'),
        backColor=colors.HexColor('#F8FAFC'),
        borderColor=colors.HexColor('#FF5A00'),
        borderWidth=1,
        borderPadding=8,
        spaceBefore=6,
        spaceAfter=8,
        leftIndent=10,
        rightIndent=10
    )
    
    qa_q_style = ParagraphStyle(
        'DocQAQ',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#1E3A8A'),
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )
    
    qa_a_style = ParagraphStyle(
        'DocQAA',
        parent=body_style,
        leftIndent=12,
        spaceBefore=2,
        spaceAfter=10
    )
    
    story = []
    
    # Simple state machine to parse markdown lines
    in_table = False
    table_data = []
    
    # Title & Subtitle logic (lines 1-2)
    # Line 1: # 🛡️ WalletShield — Mentor Demo Guide & Presentation Script
    # Line 2: *A Quick Reference Sheet for Demonstrating the Privacy-Preserving DeFi Risk Oracle*
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Check if table row
        if line.strip().startswith('|'):
            in_table = True
            # Parse table row
            cells = [clean_text(c.strip()) for c in line.split('|')[1:-1]]
            # If it's a separator line (e.g. |---|---|), ignore it
            if all(re.match(r'^:?-+:?$', c) for c in cells if c):
                i += 1
                continue
            table_data.append(cells)
            i += 1
            continue
        elif in_table:
            # End of table, process table_data
            in_table = False
            if table_data:
                # Build reportlab table
                formatted_data = []
                for row_idx, row in enumerate(table_data):
                    formatted_row = []
                    for cell in row:
                        cell_style = ParagraphStyle(
                            f'Cell_{row_idx}',
                            parent=body_style,
                            fontName='Helvetica-Bold' if row_idx == 0 else 'Helvetica',
                            fontSize=8.5,
                            leading=11,
                            textColor=colors.HexColor('#1E293B') if row_idx == 0 else colors.HexColor('#334155')
                        )
                        formatted_row.append(Paragraph(cell, cell_style))
                    formatted_data.append(formatted_row)
                
                # Determine column widths
                col_count = len(table_data[0])
                available_width = letter[0] - (2 * margin)
                # Hardcoded heuristics for the specific tables in the doc
                if col_count == 3: # selected ethernaut levels
                    col_widths = [120, 200, available_width - 320]
                elif col_count == 4: # core technologies
                    col_widths = [100, 50, 150, available_width - 300]
                else:
                    col_widths = [available_width / col_count] * col_count
                
                t = Table(formatted_data, colWidths=col_widths)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F1F5F9')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
                    ('TOPPADDING', (0, 0), (-1, 0), 6),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
                    ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                    ('TOPPADDING', (0, 1), (-1, -1), 6),
                ]))
                story.append(t)
                story.append(Spacer(1, 10))
                table_data = []
            
        # Parse regular lines
        stripped = line.strip()
        if not stripped:
            i += 1
            continue
            
        # Horizontal rule
        if stripped == '---':
            story.append(Spacer(1, 10))
            story.append(Table([[Paragraph('', body_style)]], colWidths=[letter[0]-2*margin], rowHeights=[1], style=[('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0'))]))
            story.append(Spacer(1, 10))
            i += 1
            continue
            
        # Title
        if stripped.startswith('# '):
            title_text = clean_text(stripped[2:])
            story.append(Paragraph(title_text, title_style))
            i += 1
            continue
            
        # Title alternate / Subtitle
        if (stripped.startswith('*') and stripped.endswith('*')) or (stripped.startswith('_') and stripped.endswith('_')):
            sub_text = clean_text(stripped[1:-1])
            # If next line is subtitle, combine or keep it
            story.append(Paragraph(sub_text, subtitle_style))
            i += 1
            continue
            
        # Heading 1
        if stripped.startswith('## '):
            h1_text = clean_text(stripped[3:])
            story.append(Paragraph(h1_text, h1_style))
            i += 1
            continue
            
        # Heading 2 / Step Heading / QA Heading
        if stripped.startswith('### '):
            h2_text = clean_text(stripped[4:])
            # If it's a Q&A question
            if h2_text.startswith('Q'):
                story.append(Paragraph(h2_text, qa_q_style))
            else:
                story.append(Paragraph(h2_text, h2_style))
            i += 1
            continue
            
        # Blockquote
        if stripped.startswith('> '):
            # Read contiguous blockquote lines
            quote_lines = []
            while i < len(lines) and lines[i].strip().startswith('> '):
                quote_lines.append(clean_text(lines[i].strip()[2:]))
                i += 1
            quote_text = ' '.join(quote_lines)
            story.append(Paragraph(quote_text, quote_style))
            continue
            
        # Bullet list
        if stripped.startswith('* ') or stripped.startswith('- ') or (stripped[0].isdigit() and stripped[1:].startswith('. ')):
            # Determine bullet symbol
            prefix = '• '
            content = stripped[2:]
            if stripped[0].isdigit():
                dot_idx = stripped.find('. ')
                prefix = stripped[:dot_idx+2]
                content = stripped[dot_idx+2:]
            
            cleaned_content = clean_text(content)
            story.append(Paragraph(f"{prefix}{cleaned_content}", bullet_style))
            i += 1
            continue
            
        # Nested list item
        if line.startswith('    * ') or line.startswith('    - ') or line.startswith('\t* ') or line.startswith('\t- '):
            cleaned_content = clean_text(stripped[2:])
            nested_style = ParagraphStyle(
                'DocNestedBullet',
                parent=bullet_style,
                leftIndent=30
            )
            story.append(Paragraph(f"• {cleaned_content}", nested_style))
            i += 1
            continue
            
        # Normal paragraph
        cleaned_content = clean_text(stripped)
        if cleaned_content:
            # Check if this paragraph is part of a Q&A answer block
            # If the last element in story was a QAQ or we are inside QA
            # Let's format it as QAA if it starts with "> Answer:"
            if cleaned_content.startswith('<b>Answer:</b>') or cleaned_content.startswith('<i>Answer:</i>') or cleaned_content.startswith('Answer:'):
                story.append(Paragraph(cleaned_content, qa_a_style))
            else:
                story.append(Paragraph(cleaned_content, body_style))
                
        i += 1
        
    # Build Document
    def add_page_number(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.HexColor('#64748B'))
        
        # Header
        canvas.drawString(margin, letter[1] - margin + 20, "WalletShield - Mentor Demo Guide & Presentation Script")
        canvas.setStrokeColor(colors.HexColor('#E2E8F0'))
        canvas.setLineWidth(0.5)
        canvas.line(margin, letter[1] - margin + 12, letter[0] - margin, letter[1] - margin + 12)
        
        # Footer
        page_num = canvas.getPageNumber()
        canvas.drawRightString(letter[0] - margin, margin - 20, f"Page {page_num}")
        canvas.drawString(margin, margin - 20, "CONFIDENTIAL - FOR PRESENTATION PURPOSES ONLY")
        canvas.line(margin, margin - 12, letter[0] - margin, margin - 12)
        
        canvas.restoreState()
        
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f"Successfully generated {output_file}")

if __name__ == "__main__":
    build_pdf()
