"""Generate the demo learning material served by the QualiQ application."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "educacao" / "guia-planos-acao-qualiq.pdf"
FONT_DIR = Path("C:/Windows/Fonts")

pdfmetrics.registerFont(TTFont("Arial", str(FONT_DIR / "arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", str(FONT_DIR / "arialbd.ttf")))

BLUE = colors.HexColor("#174D89")
NAVY = colors.HexColor("#19334F")
TEAL = colors.HexColor("#0C8B82")
PALE = colors.HexColor("#EEF5FC")
INK = colors.HexColor("#26384C")
MUTED = colors.HexColor("#60748A")
LINE = colors.HexColor("#D7E2ED")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="GuideTitle", fontName="Arial-Bold", fontSize=21, leading=26,
    textColor=NAVY, spaceAfter=9,
))
styles.add(ParagraphStyle(
    name="GuideLead", fontName="Arial", fontSize=10.3, leading=15,
    textColor=INK, spaceAfter=13,
))
styles.add(ParagraphStyle(
    name="GuideHeading", fontName="Arial-Bold", fontSize=12.3, leading=16,
    textColor=BLUE, spaceBefore=13, spaceAfter=7,
))
styles.add(ParagraphStyle(
    name="GuideBody", fontName="Arial", fontSize=9.3, leading=14,
    textColor=INK, spaceAfter=6,
))
styles.add(ParagraphStyle(
    name="GuideSmall", fontName="Arial", fontSize=8.3, leading=11.5,
    textColor=INK,
))
styles.add(ParagraphStyle(
    name="GuideTableHead", fontName="Arial-Bold", fontSize=8.3, leading=11,
    textColor=colors.white,
))
styles.add(ParagraphStyle(
    name="GuideTableCell", fontName="Arial", fontSize=8.1, leading=11,
    textColor=INK,
))
styles.add(ParagraphStyle(
    name="GuideCallout", fontName="Arial-Bold", fontSize=9, leading=13,
    textColor=NAVY,
))


def p(text, style="GuideBody"):
    return Paragraph(text, styles[style])


def page_chrome(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 18 * mm, width, 18 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Arial-Bold", 14)
    canvas.drawString(18 * mm, height - 11.5 * mm, "QualiQ")
    canvas.setFont("Arial", 8)
    canvas.drawRightString(width - 18 * mm, height - 11 * mm, "EDUCAÇÃO CONTINUADA")
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 17 * mm, width - 18 * mm, 17 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Arial", 7.5)
    canvas.drawString(18 * mm, 12 * mm, "Material de demonstração · Ciclo de melhoria contínua")
    canvas.drawRightString(width - 18 * mm, 12 * mm, f"{doc.page}")
    canvas.restoreState()


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=24 * mm, bottomMargin=20 * mm,
        title="Guia de demonstração: plano de ação 5W2H no QualiQ",
        author="QualiQ",
    )

    story = [
        p("Plano de ação 5W2H no QualiQ", "GuideTitle"),
        p(
            "Este guia apresenta um exemplo simulado de como transformar um incidente em um "
            "plano de ação claro, com responsável, prazo e acompanhamento. Use-o junto à etapa "
            "<b>Melhoria &gt; Planos de Ação</b> do treinamento de demonstração.",
            "GuideLead",
        ),
        HRFlowable(width="100%", thickness=1, color=LINE, spaceAfter=6),
        p("Situação simulada", "GuideHeading"),
        p(
            "Uma equipe identificou atrasos recorrentes na atualização dos resultados de um "
            "indicador. O incidente foi registrado no QualiQ e precisa de uma ação que reduza "
            "novas ocorrências. O plano abaixo é um exercício de aprendizagem; adapte os "
            "campos à realidade e às regras do seu estabelecimento."
        ),
        p("As sete perguntas do 5W2H", "GuideHeading"),
    ]

    rows = [[p("Pergunta", "GuideTableHead"), p("Exemplo no QualiQ", "GuideTableHead")]]
    entries = [
        ("What · O quê?", "Criar uma rotina semanal de conferência dos dados do indicador."),
        ("Why · Por quê?", "Reduzir atrasos e melhorar a confiabilidade dos resultados."),
        ("Where · Onde?", "Na área responsável pela alimentação do indicador."),
        ("When · Quando?", "Toda sexta-feira, antes do fechamento da semana."),
        ("Who · Quem?", "Analista responsável; gestor como controlador da execução."),
        ("How · Como?", "Conferir fontes, registrar pendências e concluir as tarefas do plano."),
        ("How much · Quanto?", "Tempo da equipe e recursos já disponíveis, sem custo adicional."),
    ]
    rows.extend([[p(question, "GuideTableCell"), p(example, "GuideTableCell")] for question, example in entries])
    table = Table(rows, colWidths=[46 * mm, 126 * mm], hAlign="LEFT", repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, -1), (-1, -1), 0.7, LINE),
    ]))
    story.extend([table, Spacer(1, 7 * mm)])

    callout = Table([[p(
        "No QualiQ, preencha os campos do 5W2H e indique o responsável principal, o controlador "
        "e os participantes. Se usar tarefas, atribua prazos e acompanhe o avanço do plano.",
        "GuideCallout",
    )]], colWidths=[172 * mm])
    callout.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("LINEBEFORE", (0, 0), (0, -1), 3, TEAL),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 11),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
    ]))
    story.extend([
        callout,
        p("Sequência prática", "GuideHeading"),
        p("<b>1.</b> Em <b>Operação &gt; Incidentes</b>, consulte o registro e identifique o problema."),
        p("<b>2.</b> Em <b>Melhoria &gt; Planos de Ação</b>, crie o plano e vincule o incidente quando aplicável."),
        p("<b>3.</b> Preencha as sete perguntas, escolha responsáveis e defina tarefas e prazos verificáveis."),
        p("<b>4.</b> Acompanhe a evolução, registre evidências e solicite o avanço conforme o fluxo da equipe."),
        p("<b>5.</b> Consulte <b>Monitoramento &gt; Indicadores</b> para avaliar se a ação produziu resultado."),
        Spacer(1, 3 * mm),
        p("Critério de conclusão", "GuideHeading"),
        p(
            "O plano é útil quando outra pessoa consegue responder, sem adivinhação, o que será "
            "feito, por que, por quem, onde, quando, como e com quais recursos. Na avaliação "
            "do treinamento, relacione cada pergunta ao campo correspondente."
        ),
    ])

    doc.build(story, onFirstPage=page_chrome, onLaterPages=page_chrome)
    print(OUTPUT)


if __name__ == "__main__":
    main()
