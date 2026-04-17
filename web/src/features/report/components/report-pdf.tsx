import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  formatPestTypeLabel,
  formatReportDate,
  periodStartLabel,
  type ReportData,
} from "@/features/report/lib/report-data";

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
    lineHeight: 1.4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  muted: {
    color: "#6b7280",
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
  },
  kpiBox: {
    flexGrow: 1,
    border: "1 solid #e5e7eb",
    borderRadius: 8,
    padding: 8,
  },
  kpiTitle: {
    fontSize: 9,
    color: "#6b7280",
  },
  kpiValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: 700,
  },
  card: {
    border: "1 solid #e5e7eb",
    borderRadius: 8,
    padding: 10,
  },
  recommendation: {
    fontSize: 10,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1 solid #e5e7eb",
    paddingBottom: 6,
    marginBottom: 6,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1 solid #f3f4f6",
    paddingVertical: 5,
  },
  colDate: { width: "19%" },
  colField: { width: "29%" },
  colSeverity: { width: "17%" },
  colPct: { width: "12%" },
  colPest: { width: "11%" },
  colPestAi: { width: "12%" },
  pestRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: "1 solid #f3f4f6",
    paddingVertical: 4,
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
  },
});

export function ReportPdfDocument({ data }: { data: ReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.headerTitle}>Relatório AgroSmart</Text>
        <Text style={styles.muted}>
          Período: {periodStartLabel(data.generatedAt)} até{" "}
          {formatReportDate(data.generatedAt)} ({data.periodLabel})
        </Text>
        <Text style={styles.muted}>
          Gerado em: {formatReportDate(data.generatedAt)}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Indicadores principais</Text>
          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiTitle}>Total de análises</Text>
              <Text style={styles.kpiValue}>{data.kpis.total}</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiTitle}>Média área afetada</Text>
              <Text style={styles.kpiValue}>
                {data.kpis.avgAffectedPct.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiTitle}>Saudáveis</Text>
              <Text style={styles.kpiValue}>
                {data.kpis.healthyPct.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiTitle}>Doentes</Text>
              <Text style={styles.kpiValue}>
                {data.kpis.diseasedPct.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Distribuição por praga</Text>
          <View style={styles.card}>
            {data.topPests.map((item) => (
              <View key={item.pestType} style={styles.pestRow}>
                <Text>{formatPestTypeLabel(item.pestType)}</Text>
                <Text>
                  {item.count} análises · média {item.avgAffectedPct.toFixed(1)}
                  %
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recomendação consolidada</Text>
          <View style={styles.card}>
            <Text style={styles.recommendation}>
              {data.recommendation.content}
            </Text>
            <Text style={[styles.muted, { marginTop: 6 }]}>
              Fonte: {data.recommendation.source} · Modelo:{" "}
              {data.recommendation.model}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Últimas análises</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colDate}>Data</Text>
            <Text style={styles.colField}>Fazenda/Talhão</Text>
            <Text style={styles.colSeverity}>Severidade</Text>
            <Text style={styles.colPct}>Área %</Text>
            <Text style={styles.colPest}>Praga</Text>
            <Text style={styles.colPestAi}>Praga IA</Text>
          </View>

          {data.recentAnalyses.slice(0, 8).map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colDate}>
                {formatReportDate(item.capturedAt)}
              </Text>
              <Text style={styles.colField}>
                {item.farmName} · {item.fieldName}
              </Text>
              <Text style={styles.colSeverity}>{item.severityLabelPt}</Text>
              <Text style={styles.colPct}>{item.affectedPct.toFixed(1)}%</Text>
              <Text style={styles.colPest}>
                {formatPestTypeLabel(item.pestType)}
              </Text>
              <Text style={styles.colPestAi}>
                {formatPestTypeLabel(item.pestTypeAi ?? "nao_identificado")}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          AgroSmart · Relatório automático · Este material é apoio à decisão e
          não substitui vistoria agronômica presencial.
        </Text>
      </Page>
    </Document>
  );
}
