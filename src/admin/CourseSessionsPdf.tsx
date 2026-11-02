import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import { getDeliverySessions, getDeliverySessionDetail, type AuthSession, type DeliverySessionDetail } from "../api";

const labels: Record<string, string> = { TEACHING: "Bài dạy", REVIEW: "Ôn tập", EXAM: "Kiểm tra", ACTIVITY: "Thực hành" };

export function CourseSessionsPdf({ session, khoaId, khoaName }: { session: AuthSession; khoaId: number; khoaName: string }) {
  const [opened, setOpened] = useState(false);
  const [selected, setSelected] = useState("");
  const [printError, setPrintError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const query = useQuery({
    queryKey: ["course-sessions-pdf", session.accessToken, khoaId],
    enabled: opened,
    staleTime: 0,
    queryFn: async () => {
      const result = await getDeliverySessions(session, khoaId);
      const ordered = [...result.sessions].sort((a, b) => a.seq - b.seq);
      const rows: DeliverySessionDetail[] = [];
      // Bound concurrency for large courses; never export a partially loaded course.
      for (let i = 0; i < ordered.length; i += 5) {
        rows.push(...await Promise.all(ordered.slice(i, i + 5).map(row => getDeliverySessionDetail(session, khoaId, row.id))));
      }
      return rows;
    },
  });
  const rows = (query.data ?? []).filter(row => !selected || String(row.id) === selected);
  const print = useReactToPrint({
    contentRef: ref,
    documentTitle: `${khoaName} - ${selected ? `Buoi ${rows[0]?.seq ?? ""}` : "Noi dung buoi hoc"}`,
    onPrintError: () => setPrintError("Không mở được hộp thoại in. Vui lòng thử lại trên trình duyệt máy tính."),
    pageStyle: "@page { size: A4 portrait; margin: 22mm 20mm 22mm 30mm; } @media print { html, body { margin: 0 !important; padding: 0 !important; } .course-pdf { padding: 0 !important; max-width: none !important; width: 100% !important; } }",
  });
  return <section>
    <button type="button" className="cw-btn-outline" aria-expanded={opened} onClick={() => setOpened(!opened)}>Xuất PDF</button>
    {opened && <div className="border border-outline-variant rounded-xl p-4 mt-3 bg-surface text-on-surface text-sm">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label>Phạm vi <select className="border rounded-lg p-2 ml-2" value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">Tất cả buổi học</option>
          {(query.data ?? []).map(row => <option key={row.id} value={row.id}>Buổi {row.seq} · {row.title || labels[row.sessionType]}</option>)}
        </select></label>
        <button type="button" className="cw-btn-primary" disabled={query.isFetching || query.isError || !rows.length} onClick={() => { setPrintError(""); print(); }}>In / Lưu PDF</button>
        <button type="button" className="cw-btn-outline" onClick={() => setOpened(false)}>Đóng</button>
      </div>
      <p className="mb-3 text-on-surface-variant">Chọn “Lưu dưới dạng PDF”, khổ A4, tỷ lệ 100% và tắt đầu trang/chân trang của trình duyệt. Giữ lề mặc định của bản in.</p>
      {query.isFetching && <p role="status">Đang tải nội dung buổi học…</p>}
      {query.isError && <p role="alert">{query.error.message} <button type="button" onClick={() => void query.refetch()}>Thử lại</button></p>}
      {printError && <p role="alert">{printError}</p>}
      {!query.isFetching && !query.isError && !rows.length && <p>Chưa có buổi học để xuất.</p>}
      {!query.isFetching && !query.isError && rows.length > 0 && <div className="max-h-96 overflow-auto border rounded-lg p-4">
        <div ref={ref} className="course-pdf">
          <style>{`
            .course-pdf{box-sizing:border-box;max-width:210mm;margin:0 auto;padding:22mm 20mm 22mm 30mm;font:13pt/1.5 "Times New Roman",Times,serif;color:#111;background:white;text-align:left}
            .course-pdf *{box-sizing:border-box}
            .course-pdf header{text-align:center;margin-bottom:9mm;break-inside:avoid;break-after:avoid}
            .course-pdf h1{font:700 16pt/1.4 "Times New Roman",Times,serif;margin:0 0 3mm;text-align:center}
            .course-pdf .course-pdf-subtitle{font-weight:700;text-align:center;margin:0}
            .course-pdf h2{font:700 13pt/1.5 "Times New Roman",Times,serif;margin:7mm 0 3mm;break-after:avoid}
            .course-pdf p{margin:2mm 0 3mm;white-space:pre-wrap;overflow-wrap:anywhere;orphans:3;widows:3}
            .course-pdf .course-pdf-intro{text-indent:10mm;text-align:justify;margin-bottom:5mm}
            .course-pdf table{width:100%;table-layout:fixed;border-collapse:collapse;margin:3mm 0 6mm;font:inherit}
            .course-pdf th,.course-pdf td{border:0.5pt solid #777;padding:3mm;text-align:left;vertical-align:top;overflow-wrap:anywhere;white-space:normal}
            .course-pdf th:first-child,.course-pdf td:first-child{width:14%;text-align:center}
            .course-pdf th:nth-child(2){width:26%}
            .course-pdf thead{display:table-header-group}
            .course-pdf tr{break-inside:avoid}
            .course-pdf th{font-weight:700;background:#f5f5f5}
            @media screen and (max-width:640px){.course-pdf{padding:20px;font-size:14px}}
          `}</style>
          <header>
            <h1>THÔNG BÁO</h1>
            <p className="course-pdf-subtitle">Nội dung buổi học khóa {khoaName}</p>
          </header>
          <p className="course-pdf-intro">Thông tin nội dung {selected ? "buổi học được chọn" : "các buổi học"} của khóa {khoaName} như sau:</p>
          <p><strong>Phạm vi:</strong> {rows.length} buổi · {rows.reduce((total, row) => total + row.units.length, 0)} tiết</p>
          {rows.map(row => <section key={row.id}>
            <h2>Buổi {row.seq} · {row.title || labels[row.sessionType]}</h2>
            <p>{labels[row.sessionType]}{row.continuation ? " · Tiếp từ buổi trước" : ""}</p>
            {row.note && <p>Ghi chú: {row.note}</p>}
            {row.units.length ? <table><thead><tr><th>Tiết</th><th>Mạch</th><th>Nội dung</th></tr></thead><tbody>
              {[...row.units].sort((a, b) => a.orderInSession - b.orderInSession).map(unit => <tr key={unit.id ?? unit.programPeriodId}><td>{unit.periodNo}</td><td>{unit.strandName || "—"}</td><td>{unit.title || "Chưa có tiêu đề"}</td></tr>)}
            </tbody></table> : <p>Chưa có nội dung tiết học.</p>}
          </section>)}
        </div>
      </div>}
    </div>}
  </section>;
}
