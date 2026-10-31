from io import BytesIO
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle


def invoice_pdf(invoice):
    stream = BytesIO()
    doc = SimpleDocTemplate(stream, rightMargin=36, leftMargin=36)
    styles = getSampleStyleSheet()
    text = lambda value: Paragraph(escape(str(value)), styles["Normal"])
    story = [Paragraph("Invoice", styles["Title"]), text(invoice.number),
             text(f"Status: {invoice.status} | Due: {invoice.due_date}"),
             text(f"Billing period: {invoice.billing_period} to {invoice.period_end}"), Spacer(1, 16),
             text(invoice.billing_name), text(invoice.billing_address), text(f"Tax number: {invoice.tax_number}"), Spacer(1, 16)]
    data = [["Description", "Qty", "Unit price", "Discount", "Tax", "Total"]]
    for line in invoice.lines:
        data.append([text(line.description), str(line.quantity), f"{line.unit_price:.2f}",
                     f"{line.discount_amount:.2f}", f"{line.tax_amount:.2f}", f"{line.line_total:.2f}"])
    table = Table(data, colWidths=[2.3 * inch, .4 * inch, .8 * inch, .8 * inch, .7 * inch, .9 * inch], repeatRows=1)
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e5e7eb")),
                              ("VALIGN", (0, 0), (-1, -1), "TOP"),
                              ("LINEBELOW", (0, 0), (-1, 0), 1, colors.grey),
                              ("FONTSIZE", (0, 0), (-1, -1), 9),
                              ("TOPPADDING", (0, 0), (-1, -1), 8),
                              ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story += [table, Spacer(1, 16)]
    for label, amount in [("Subtotal", invoice.subtotal), ("Discount", invoice.discount),
                          ("Tax", invoice.tax), ("Total", invoice.total), ("Paid", invoice.amount_paid),
                          ("Outstanding", invoice.total - invoice.amount_paid)]:
        story.append(text(f"{label}: {amount:.2f}"))
    doc.build(story)
    return stream.getvalue()
