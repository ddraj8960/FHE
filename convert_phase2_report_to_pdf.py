"""
Convert Phase 2 Report Markdown to a clean, professional PDF.
Each major chapter starts on a new page. Improved typography and spacing.
"""
import re
import os
from fpdf import FPDF


def sanitize(text):
    """Replace all non-latin-1 characters for PDF font compatibility."""
    reps = {
        '\u2192': '->', '\u2190': '<-', '\u2194': '<->',
        '\u2265': '>=', '\u2264': '<=', '\u00d7': 'x',
        '\u2014': ' -- ', '\u2013': '-', '\u200b': '',
        '\u2713': '[OK]', '\u2705': '[DONE]', '\u2611': '[DONE]',
        '\u26d3\ufe0f': '', '\u26d3': '',
        '\u2623\ufe0f': '[!]', '\u2623': '[!]',
        '\u26a0\ufe0f': '[!]', '\u26a0': '[!]',
        '\u270d\ufe0f': '', '\u270d': '',
        '\U0001f517': '', '\U0001f4cb': '', '\U0001f50d': '',
        '\U0001f4ca': '', '\U0001f4b0': '', '\U0001f510': '',
        '\U0001f4e1': '', '\U0001f9e0': '', '\U0001f4e9': '',
        '\U0001f513': '', '\U0001f6ab': '', '\U0001f50d': '',
        '\U0001f527': '', '\U0001f4dd': '', '\U0001f525': '',
        '\U0001f512': '', '\U0001f4e6': '',
        '\u2502': '|', '\u2514': '+--', '\u251c': '|--',
        '\u2500': '-', '\u2518': '/', '\u2510': '\\',
        '\u250c': '/', '\u2524': '|', '\u252c': '+',
        '\u2534': '+', '\u253c': '+', '\u2560': '|',
        '\u2550': '=', '\u255a': '\\', '\u2554': '/',
        '\u2551': '|', '\u2557': '\\', '\u255d': '/',
        '\u2563': '|', '\u2594': '-', '\u25b6': '>',
        '\u00a0': ' ', '\u00b7': '.', '\u2022': '-',
    }
    for old, new in reps.items():
        text = text.replace(old, new)
    text = re.sub(r'[\U00010000-\U0010ffff]', '', text)
    text = re.sub(r'[\ufe00-\ufe0f\u200d]', '', text)
    try:
        text.encode('latin-1')
    except UnicodeEncodeError:
        text = text.encode('latin-1', errors='replace').decode('latin-1')
    return text


def strip_md(text):
    """Remove markdown inline formatting."""
    text = re.sub(r'\*\*\*(.*?)\*\*\*', r'\1', text)
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'`(.*?)`', r'\1', text)
    text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)
    return text


class ReportPDF(FPDF):
    def __init__(self):
        super().__init__(orientation='P', unit='mm', format='A4')
        self.set_auto_page_break(auto=True, margin=22)
        self.set_left_margin(20)
        self.set_right_margin(20)

    def header(self):
        if self.page_no() > 1:
            self.set_font('Helvetica', 'I', 7.5)
            self.set_text_color(140, 140, 140)
            self.cell(85, 6, 'WalletShield  |  Samsung PRISM Phase 2 Report', align='L')
            self.cell(85, 6, f'Page {self.page_no()}', align='R', new_x="LMARGIN", new_y="NEXT")
            self.set_draw_color(200, 200, 200)
            self.set_line_width(0.3)
            self.line(20, self.get_y(), 190, self.get_y())
            self.ln(5)

    def footer(self):
        self.set_y(-14)
        self.set_font('Helvetica', 'I', 6.5)
        self.set_text_color(160, 160, 160)
        self.cell(0, 8, '25SPF25SRM  |  SRM Institute of Science and Technology, Kattankulathur', align='C')


def draw_title_page(pdf):
    pdf.add_page()
    pdf.ln(45)

    # Title
    pdf.set_font('Helvetica', 'B', 34)
    pdf.set_text_color(26, 35, 126)
    pdf.cell(0, 16, 'WalletShield', align='C', new_x="LMARGIN", new_y="NEXT")

    # Subtitle
    pdf.set_font('Helvetica', '', 14)
    pdf.set_text_color(90, 90, 90)
    pdf.cell(0, 8, 'Privacy-Preserving DeFi Risk Verification', align='C', new_x="LMARGIN", new_y="NEXT")

    pdf.ln(8)
    pdf.set_draw_color(26, 35, 126)
    pdf.set_line_width(0.6)
    pdf.line(65, pdf.get_y(), 145, pdf.get_y())
    pdf.ln(12)

    pdf.set_font('Helvetica', 'B', 14)
    pdf.set_text_color(40, 53, 147)
    pdf.cell(0, 10, 'Samsung PRISM Phase 2 Report', align='C', new_x="LMARGIN", new_y="NEXT")

    pdf.ln(25)

    # Details box
    pdf.set_fill_color(245, 246, 252)
    pdf.set_draw_color(200, 200, 220)
    box_y = pdf.get_y()
    pdf.rect(45, box_y, 120, 42, style='DF')

    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(50, 50, 50)
    pdf.ln(6)
    details = [
        ('Worklet ID', '25SPF25SRM'),
        ('College', 'SRM Institute of Science and Technology'),
        ('Students', 'Praful, Utkarsh, Dhanush, Karthikeya'),
    ]
    for label, value in details:
        pdf.set_x(50)
        pdf.set_font('Helvetica', 'B', 9.5)
        pdf.set_text_color(26, 35, 126)
        pdf.cell(30, 10, f'{label}:', align='L')
        pdf.set_font('Helvetica', '', 9.5)
        pdf.set_text_color(60, 60, 60)
        pdf.cell(80, 10, value, align='L', new_x="LMARGIN", new_y="NEXT")


def draw_toc(pdf, chapters):
    pdf.add_page()
    pdf.set_font('Helvetica', 'B', 20)
    pdf.set_text_color(26, 35, 126)
    pdf.cell(0, 14, 'Table of Contents', new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(26, 35, 126)
    pdf.set_line_width(0.4)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(8)

    for idx, ch in enumerate(chapters, 1):
        pdf.set_font('Helvetica', 'B', 11)
        pdf.set_text_color(40, 53, 147)
        pdf.cell(12, 8, f'{idx}.')
        pdf.set_font('Helvetica', '', 11)
        pdf.set_text_color(50, 50, 50)
        pdf.cell(0, 8, ch, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)


def parse_table_rows(lines, start):
    rows = []
    i = start
    while i < len(lines):
        line = lines[i].strip()
        if not line.startswith('|'):
            break
        if re.match(r'^\|[\s\-:|]+\|$', line):
            i += 1
            continue
        cells = [c.strip() for c in line.split('|')[1:-1]]
        rows.append(cells)
        i += 1
    return rows, i


def render_table(pdf, rows):
    if not rows:
        return

    num_cols = max(len(r) for r in rows)
    avail = 170  # page width minus margins

    # Compute column widths based on content length
    col_lens = [0] * num_cols
    for row in rows:
        for j in range(min(len(row), num_cols)):
            col_lens[j] = max(col_lens[j], len(row[j]))
    total = sum(col_lens) or 1
    col_w = [max((l / total) * avail, 15) for l in col_lens]
    scale = avail / sum(col_w)
    col_w = [w * scale for w in col_w]

    line_h = 4.2
    pad = 1.5

    for ri, row in enumerate(rows):
        # Compute row height
        max_lines = 1
        for j in range(num_cols):
            txt = sanitize(strip_md(row[j])) if j < len(row) else ''
            chars_per_line = max(1, (col_w[j] - 2 * pad) / 1.85)
            needed = max(1, -(-len(txt) // int(chars_per_line)))  # ceiling div
            max_lines = max(max_lines, needed)
        rh = max(6, max_lines * line_h + 2 * pad)
        rh = min(rh, 30)

        # Page break check — reprint header if needed
        if pdf.get_y() + rh > 272:
            pdf.add_page()
            # Reprint header row
            if ri > 0 and rows:
                render_header_row(pdf, rows[0], col_w, num_cols, line_h, pad)

        y0 = pdf.get_y()
        for j in range(num_cols):
            txt = sanitize(strip_md(row[j])) if j < len(row) else ''
            x0 = pdf.get_x()

            # Styling
            if ri == 0:
                pdf.set_fill_color(232, 234, 246)
                pdf.set_font('Helvetica', 'B', 8)
                pdf.set_text_color(26, 35, 126)
            else:
                pdf.set_fill_color(252, 252, 255) if ri % 2 == 0 else pdf.set_fill_color(255, 255, 255)
                pdf.set_font('Helvetica', '', 8)
                pdf.set_text_color(40, 40, 40)

            pdf.set_draw_color(210, 215, 230)
            pdf.rect(x0, y0, col_w[j], rh, style='DF')
            pdf.set_xy(x0 + pad, y0 + pad)
            pdf.multi_cell(w=col_w[j] - 2 * pad, h=line_h, text=txt[:300], new_x="RIGHT", new_y="TOP")
            pdf.set_xy(x0 + col_w[j], y0)

        pdf.set_xy(20, y0 + rh)
    pdf.ln(4)


def render_header_row(pdf, row, col_w, num_cols, line_h, pad):
    y0 = pdf.get_y()
    rh = 6
    for j in range(num_cols):
        txt = sanitize(strip_md(row[j])) if j < len(row) else ''
        x0 = pdf.get_x()
        pdf.set_fill_color(232, 234, 246)
        pdf.set_font('Helvetica', 'B', 8)
        pdf.set_text_color(26, 35, 126)
        pdf.set_draw_color(210, 215, 230)
        pdf.rect(x0, y0, col_w[j], rh, style='DF')
        pdf.set_xy(x0 + pad, y0 + pad)
        pdf.multi_cell(w=col_w[j] - 2 * pad, h=line_h, text=txt, new_x="RIGHT", new_y="TOP")
        pdf.set_xy(x0 + col_w[j], y0)
    pdf.set_xy(20, y0 + rh)


def build_pdf(md_path, pdf_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    # Remove mermaid diagram blocks
    md_text = re.sub(
        r'```mermaid\n.*?```',
        '\n> [Diagram -- refer to the markdown source for the interactive Mermaid diagram]\n',
        md_text, flags=re.DOTALL
    )

    lines = md_text.split('\n')

    # Find chapter titles (# Heading) for TOC
    chapters = []
    for line in lines:
        s = line.strip()
        if s.startswith('# ') and not s.startswith('## '):
            title = sanitize(strip_md(s[2:].strip()))
            if title:
                chapters.append(title)

    pdf = ReportPDF()
    draw_title_page(pdf)
    draw_toc(pdf, chapters)

    # Start content
    pdf.add_page()

    i = 0
    in_code = False
    code_buf = []
    is_first_h1 = True

    while i < len(lines):
        line = lines[i]
        raw = line.strip()

        # ── Code blocks ──
        if raw.startswith('```'):
            if in_code:
                in_code = False
                code = sanitize('\n'.join(code_buf))
                if code.strip():
                    if pdf.get_y() > 245:
                        pdf.add_page()
                    y_start = pdf.get_y()
                    pdf.set_font('Courier', '', 7)
                    pdf.set_text_color(50, 50, 50)
                    pdf.set_fill_color(245, 245, 248)
                    pdf.set_draw_color(200, 200, 210)
                    # Calculate block height
                    n_lines = code.count('\n') + 1
                    bh = min(n_lines * 3.2 + 6, 200)
                    # Check page break
                    if pdf.get_y() + bh > 272:
                        pdf.add_page()
                        y_start = pdf.get_y()
                    pdf.rect(20, y_start, 170, bh, style='DF')
                    pdf.set_xy(22, y_start + 3)
                    pdf.multi_cell(w=166, h=3.2, text=code)
                    pdf.set_y(y_start + bh + 3)
                code_buf = []
            else:
                in_code = True
                code_buf = []
            i += 1
            continue

        if in_code:
            code_buf.append(line)
            i += 1
            continue

        # ── Empty line ──
        if not raw:
            i += 1
            continue

        # ── Horizontal rule ──
        if raw == '---':
            i += 1
            continue

        # ── H1 — new page for each chapter ──
        if raw.startswith('# ') and not raw.startswith('## '):
            text = sanitize(strip_md(raw[2:].strip()))
            if not is_first_h1:
                pdf.add_page()
            is_first_h1 = False

            pdf.set_font('Helvetica', 'B', 20)
            pdf.set_text_color(26, 35, 126)
            pdf.ln(2)
            pdf.cell(0, 12, text, new_x="LMARGIN", new_y="NEXT")
            pdf.set_draw_color(26, 35, 126)
            pdf.set_line_width(0.5)
            pdf.line(20, pdf.get_y() + 1, 190, pdf.get_y() + 1)
            pdf.set_line_width(0.2)
            pdf.ln(6)
            i += 1
            continue

        # ── H2 ──
        if raw.startswith('## '):
            text = sanitize(strip_md(raw[3:].strip()))
            if pdf.get_y() > 250:
                pdf.add_page()
            pdf.ln(4)
            pdf.set_font('Helvetica', 'B', 14)
            pdf.set_text_color(40, 53, 147)
            pdf.cell(0, 9, text, new_x="LMARGIN", new_y="NEXT")
            pdf.set_draw_color(197, 202, 233)
            pdf.set_line_width(0.3)
            pdf.line(20, pdf.get_y() + 1, 190, pdf.get_y() + 1)
            pdf.set_line_width(0.2)
            pdf.ln(4)
            i += 1
            continue

        # ── H3 ──
        if raw.startswith('### '):
            text = sanitize(strip_md(raw[4:].strip()))
            if pdf.get_y() > 255:
                pdf.add_page()
            pdf.ln(3)
            pdf.set_font('Helvetica', 'B', 11.5)
            pdf.set_text_color(48, 63, 159)
            pdf.cell(0, 8, text, new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)
            i += 1
            continue

        # ── H4 ──
        if raw.startswith('#### '):
            text = sanitize(strip_md(raw[5:].strip()))
            if pdf.get_y() > 260:
                pdf.add_page()
            pdf.ln(2)
            pdf.set_font('Helvetica', 'BI', 10)
            pdf.set_text_color(57, 73, 171)
            pdf.cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")
            pdf.ln(1)
            i += 1
            continue

        # ── Table ──
        if raw.startswith('|'):
            rows, end_idx = parse_table_rows(lines, i)
            if rows:
                render_table(pdf, rows)
            i = end_idx
            continue

        # ── Blockquote ──
        if raw.startswith('>'):
            text = sanitize(strip_md(raw.lstrip('> ').strip()))
            if pdf.get_y() > 260:
                pdf.add_page()
            y_start = pdf.get_y()
            pdf.set_fill_color(248, 249, 255)
            pdf.set_font('Helvetica', 'I', 9)
            pdf.set_text_color(70, 70, 70)
            pdf.set_x(24)
            pdf.multi_cell(w=160, h=5, text=text)
            y_end = pdf.get_y()
            # Left accent bar
            pdf.set_draw_color(26, 35, 126)
            pdf.set_line_width(0.8)
            pdf.line(21, y_start, 21, y_end)
            pdf.set_line_width(0.2)
            pdf.ln(3)
            i += 1
            continue

        # ── Bullet list ──
        if raw.startswith('- ') or raw.startswith('* '):
            text = sanitize(strip_md(raw[2:].strip()))
            if pdf.get_y() > 268:
                pdf.add_page()
            pdf.set_font('Helvetica', '', 9.5)
            pdf.set_text_color(40, 40, 40)
            x_bullet = 24
            pdf.set_x(x_bullet)
            # Draw a small filled circle as bullet
            pdf.set_fill_color(26, 35, 126)
            pdf.set_draw_color(26, 35, 126)
            bullet_y = pdf.get_y() + 2.2
            pdf.ellipse(x_bullet, bullet_y, 1.5, 1.5, style='F')
            pdf.set_x(x_bullet + 4)
            pdf.multi_cell(w=155, h=5, text=text)
            pdf.ln(0.5)
            i += 1
            continue

        # ── Numbered list ──
        m = re.match(r'^(\d+)\.\s+(.*)', raw)
        if m:
            num, text = m.group(1), sanitize(strip_md(m.group(2)))
            if pdf.get_y() > 268:
                pdf.add_page()
            pdf.set_font('Helvetica', 'B', 9.5)
            pdf.set_text_color(26, 35, 126)
            pdf.set_x(24)
            pdf.cell(6, 5, f'{num}.')
            pdf.set_font('Helvetica', '', 9.5)
            pdf.set_text_color(40, 40, 40)
            pdf.multi_cell(w=152, h=5, text=text)
            pdf.ln(0.5)
            i += 1
            continue

        # ── Regular paragraph ──
        text = sanitize(strip_md(raw))
        if pdf.get_y() > 268:
            pdf.add_page()
        pdf.set_font('Helvetica', '', 10)
        pdf.set_text_color(35, 35, 35)
        pdf.multi_cell(w=170, h=5.2, text=text)
        pdf.ln(2)
        i += 1

    pdf.output(pdf_path)
    print(f"PDF generated: {pdf_path}")
    print(f"Total pages: {pdf.page_no()}")


if __name__ == "__main__":
    md_file = r"c:\Users\ddraj\OneDrive\Desktop\fhe-5\WalletShield_Phase2_Report.md"
    pdf_file = r"c:\Users\ddraj\OneDrive\Desktop\fhe-5\WalletShield_Phase2_Report.pdf"
    build_pdf(md_file, pdf_file)
