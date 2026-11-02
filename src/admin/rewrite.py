import re

with open("c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/src/admin/DocumentManagement.tsx", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Imports
code = code.replace(
    'import { MarkdownViewer } from "../components/MarkdownViewer";',
    'import { MarkdownViewer } from "../components/MarkdownViewer";\nimport { AdminPage } from "./components/AdminPageLayout";\nimport { AdminModal } from "./components/AdminModal";\nimport { AdminEmptyState } from "./components/AdminEmptyState";\nimport { SearchInput } from "./components/AdminFilterBar";\nimport { Button } from "../components/ui/button";'
)
code = code.replace('import "./document-management.css";\n', '')

# 2. Main structure
# Replace <section className="docs-page"> with AdminPage and grid layout
code = code.replace(
    '<section className="docs-page">',
    '<AdminPage className="grid grid-cols-[260px_1fr] gap-0 min-h-[calc(100vh-58px)]">'
)

code = code.replace(
    '</section>;',
    '</AdminPage>;'
)

# 3. Sidebar
sidebar_old = '<aside className="docs-filter" ref={menuArea}>'
sidebar_new = '<aside className="border-r border-outline-variant bg-surface-container-lowest p-4 flex flex-col gap-4" ref={menuArea}>'
code = code.replace(sidebar_old, sidebar_new)

code = code.replace(
    '<div className="docs-filter-heading"><h3>LOẠI FILE</h3><button aria-label="Thêm phân loại" title="Thêm phân loại" onClick={() => setCategoryDialog({ mode: "create" })}><Plus size={17} /></button></div>',
    '<div className="flex items-center justify-between mb-2"><h3 className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">LOẠI FILE</h3><button className="text-primary hover:text-on-surface p-1 rounded" aria-label="Thêm phân loại" title="Thêm phân loại" onClick={() => setCategoryDialog({ mode: "create" })}><Plus size={17} /></button></div>'
)

code = code.replace(
    '<div className="docs-filter-heading docs-filter-heading-plain"><h3>NHÓM NỘI DUNG</h3></div>',
    '<div className="flex items-center justify-between mt-4 mb-2"><h3 className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">NHÓM NỘI DUNG</h3></div>'
)

code = code.replace(
    '<div className="docs-category-row">',
    '<div className="flex items-center justify-between group py-1">'
)

code = code.replace(
    '<label><input type="checkbox" ',
    '<label className="flex items-center gap-2 flex-1 text-sm cursor-pointer"><input className="rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" '
)

code = code.replace(
    '<b>',
    '<span className="ml-auto text-xs text-on-surface-variant bg-surface-variant/30 px-1.5 py-0.5 rounded-full">'
).replace(
    '</b></label>',
    '</span></label>'
)

code = code.replace(
    '<button className="docs-category-more"',
    '<button className="opacity-0 group-hover:opacity-100 p-1 text-on-surface-variant hover:text-on-surface rounded ml-1 transition-opacity"'
)

code = code.replace(
    '<div className="docs-category-menu" role="menu">',
    '<div className="absolute left-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-outline-variant py-1 z-10" role="menu">'
)

code = code.replace(
    '<button role="menuitem"',
    '<button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant" role="menuitem"'
)

code = code.replace(
    '<button className="danger" role="menuitem"',
    '<button className="w-full text-left px-3 py-1.5 text-sm text-error hover:bg-error/10" role="menuitem"'
)

# 4. Main content area
code = code.replace('<main>', '<main className="p-6 overflow-y-auto">')

code = code.replace(
    '<div className="docs-toolbar"><div><h1>Kho Tài Liệu</h1><input aria-label="Tìm kiếm tài liệu" placeholder="Tìm kiếm tài liệu…" value={search} onChange={event => setSearch(event.target.value)} /></div><div><button onClick={() => setBulkUpload(true)}>Tải nhiều file</button><button className="docs-primary" onClick={() => setUpload(true)}>Tải lên</button></div></div>',
    """<AdminPage.Header
        eyebrow="QUẢN TRỊ HỆ THỐNG"
        title="Kho Tài Liệu"
        description="Quản lý và phân loại tài liệu hệ thống."
      >
        <Button variant="outline" onClick={() => setBulkUpload(true)}>Tải nhiều file</Button>
        <Button onClick={() => setUpload(true)}>Tải lên</Button>
      </AdminPage.Header>
      <AdminPage.Filters>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm kiếm tài liệu…" debounceMs={300} className="w-64" />
      </AdminPage.Filters>"""
)

code = code.replace(
    '{(error || deleteError || groupError) && <div className="api-error">{error || deleteError || groupError}</div>}',
    '{(error || deleteError || groupError) && <div className="mb-4 p-3 rounded-lg bg-error-container text-on-error-container text-sm">{error || deleteError || groupError}</div>}'
)

code = code.replace(
    '{!visible.length && <div className="docs-empty">Không có tài liệu phù hợp.</div>}',
    '{!visible.length && <AdminEmptyState title="Không có tài liệu phù hợp" description="Thử thay đổi bộ lọc hoặc tìm kiếm khác." />}'
)

# Fix document collection
code = code.replace('<div className="docs-collection">', '<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">')

article_old = '<article key={row.id}>'
article_new = '<article key={row.id} className="bg-white border border-outline-variant rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">'
code = code.replace(article_old, article_new)

code = code.replace(
    '<button className={`doc-preview${thumbnail ? " doc-video-preview" : ""}`}',
    '<button className={`relative aspect-video bg-surface-variant flex items-center justify-center overflow-hidden w-full ${thumbnail ? " doc-video-preview" : ""}`}'
)

code = code.replace(
    '<span className="doc-video-play material-symbols-outlined">play_circle</span>',
    '<span className="absolute inset-0 flex items-center justify-center text-white bg-black/30"><svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>'
)

code = code.replace(
    '<span className={`doc-kind ${row.docType.toLowerCase()}`}',
    '<span className={`text-sm font-bold text-on-surface-variant`}'
)

code = code.replace(
    '<div className="doc-info">',
    '<div className="p-4 flex flex-col flex-1 gap-2">'
)

code = code.replace(
    '<h2>{row.title}</h2>',
    '<h2 className="text-base font-semibold text-on-surface line-clamp-2" title={row.title}>{row.title}</h2>'
)

code = code.replace(
    '<span className="doc-menu-wrap">',
    '<span className="absolute top-2 right-2">'
)
code = code.replace(
    '<div><h2 className="text-base font-semibold text-on-surface line-clamp-2" title={row.title}>{row.title}</h2><span className="absolute top-2 right-2">',
    '<div className="relative pr-6"><h2 className="text-base font-semibold text-on-surface line-clamp-2" title={row.title}>{row.title}</h2><span className="absolute top-0 right-0">'
)

code = code.replace(
    '<button className="doc-menu-trigger"',
    '<button className="p-1 text-on-surface-variant hover:bg-surface-variant rounded-full"'
)

code = code.replace(
    '<span className="doc-menu" role="menu">',
    '<span className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-outline-variant py-1 z-20" role="menu">'
)

code = code.replace(
    '<span className="doc-menu-label">',
    '<span className="px-3 py-1 text-xs font-bold text-on-surface-variant uppercase tracking-wider block">'
)

code = code.replace(
    '<hr/>',
    '<hr className="my-1 border-outline-variant"/>'
)

code = code.replace(
    '<p><span>{types.find(item => item.value === row.docType)?.label ?? row.docType}</span><span className={row.contentGroup ? "doc-group" : "doc-group doc-group-empty"}>{nhomLabel(row.contentGroup)}</span><time>{new Intl.DateTimeFormat("vi-VN").format(new Date(row.createdAt))}</time></p>',
    '<p className="flex flex-wrap gap-2 text-xs text-on-surface-variant items-center mt-auto"><span className="bg-surface px-2 py-1 rounded-md border border-outline-variant">{types.find(item => item.value === row.docType)?.label ?? row.docType}</span><span className={row.contentGroup ? "bg-primary-container text-on-primary-container px-2 py-1 rounded-md" : "bg-surface px-2 py-1 rounded-md border border-outline-variant border-dashed"}>{nhomLabel(row.contentGroup)}</span><time className="ml-auto">{new Intl.DateTimeFormat("vi-VN").format(new Date(row.createdAt))}</time></p>'
)

code = code.replace(
    '<p className="doc-markdown-row">',
    '<p className="mt-2 text-xs flex gap-2 items-center">'
)
code = code.replace(
    '<span className="doc-markdown-badge">',
    '<span className="bg-primary/10 text-primary px-2 py-1 rounded-md">'
)
code = code.replace(
    '<button className="doc-ocr-cancel"',
    '<button className="text-error hover:underline"'
)
code = code.replace(
    '<span className="doc-markdown-error">',
    '<span className="text-error">'
)

# 5. Modals
# CategoryEditor
code = re.sub(
    r'<div className="docs-overlay" onMouseDown={event => \{ if \(event.target === event.currentTarget\) onClose\(\); \}\}><form className="docs-modal docs-category-modal" onSubmit={event => \{ event.preventDefault\(\); onSave\(name\); \}\}><header><h2>\{title\}</h2><button type="button" aria-label="Đóng" onClick={onClose}><X size=\{18\} /></button></header><label>Tên phân loại mới<input autoFocus required maxLength=\{80\} value=\{name\} onChange={event => setName\(event.target.value\)} /></label><footer><button type="button" onClick={onClose}>Hủy</button><button className="docs-primary" disabled=\{!name.trim\(\)\}>Lưu</button></footer></form></div>',
    r'''<AdminModal open={true} onClose={onClose} title={title} size="sm" footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button disabled={!name.trim()} onClick={() => onSave(name)}>Lưu</Button></>}>
      <form onSubmit={event => { event.preventDefault(); onSave(name); }} className="space-y-4">
        <label className="block text-sm font-medium text-on-surface mb-1">Tên phân loại mới</label>
        <input autoFocus required maxLength={80} value={name} onChange={event => setName(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none" />
      </form>
    </AdminModal>''',
    code
)

# DeleteCategoryDialog
code = re.sub(
    r'<div className="docs-overlay" onMouseDown={event => \{ if \(event.target === event.currentTarget\) onClose\(\); \}\}><section className="docs-modal docs-category-modal" role="dialog" aria-modal="true" aria-labelledby="delete-category-title"><header><h2 id="delete-category-title">Xóa phân loại</h2><button type="button" aria-label="Đóng" onClick={onClose}><X size=\{18\} /></button></header><p>Bạn có chắc muốn xóa phân loại này không\?</p><strong>\{category.label\}</strong>\{count > 0 && <><label>Chuyển \{count\} tài liệu sang<select required value=\{destination\} onChange=\{event => setDestination\(event.target.value\)\}><option value="">Chưa phân loại</option>\{targets.map\(item => <option key=\{item.value\} value=\{item.value\}>\{item.label\}</option>\)\}</select></label><small>Phân loại sẽ được gỡ khỏi danh sách; tài liệu bên trong vẫn an toàn và có thể xem tại “Tất cả tài liệu”.</small></>\}<footer><button type="button" onClick=\{onClose\}>Hủy</button><button type="button" className="docs-danger" onClick=\{onDelete\}>Xóa phân loại</button></footer></section></div>',
    r'''<AdminModal open={true} onClose={onClose} title="Xóa phân loại" size="sm" footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button variant="destructive" onClick={onDelete}>Xóa phân loại</Button></>}>
      <div className="space-y-4">
        <p>Bạn có chắc muốn xóa phân loại này không?</p>
        <strong className="block text-lg">{category.label}</strong>
        {count > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-on-surface">Chuyển {count} tài liệu sang</label>
            <select required value={destination} onChange={event => setDestination(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
              <option value="">Chưa phân loại</option>
              {targets.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <small className="block text-xs text-on-surface-variant">Phân loại sẽ được gỡ khỏi danh sách; tài liệu bên trong vẫn an toàn và có thể xem tại “Tất cả tài liệu”.</small>
          </div>
        )}
      </div>
    </AdminModal>''',
    code
)

# DocumentUpload
upload_old = r'<div className="docs-overlay"><form className="docs-modal" onSubmit=\{submit\}><header><h2>\{isVideo \? "Thêm video YouTube" : "Tải tài liệu lên"\}</h2><button type="button" onClick=\{onClose\}>×</button></header><label>Tên tài liệu<input required value=\{title\} onChange=\{event => setTitle\(event.target.value\)\} /></label><label>Loại tài liệu<select required value=\{type\} onChange=\{event => setType\(event.target.value\)\}>\{types.map\(item => <option value=\{item.value\} key=\{item.value\}>\{item.label\}</option>\)\}</select></label><label>Phạm vi<select value=\{audience\} onChange=\{event => setAudience\(event.target.value\)\}><option value="TEACHER_RESTRICTED">Chỉ giáo viên</option><option value="STUDENT_ALLOWED">Cho phép học sinh</option></select></label>\{isVideo \? <label>Link video YouTube<input required type="url" placeholder="https://www.youtube.com/watch\?v=..." value=\{videoUrl\} onChange=\{event => setVideoUrl\(event.target.value\)\} />\{invalidVideo && <small className="docs-field-error">Link YouTube không hợp lệ.</small>\}<small>Video sẽ phát ngay trong website, học sinh không bị chuyển sang YouTube.</small></label> : <label>Chọn file<input required type="file" onChange=\{event => setFile\(event.target.files\?\.\[0\] \?\? null\)\} /></label>\}\{error && <div className="api-error">\{error\}</div>\}<footer><button type="button" onClick=\{onClose\}>Hủy</button><button className="docs-primary" disabled=\{busy \|\| \(isVideo \? !youtubeEmbedUrl\(videoUrl\) : !file\)\}>\{busy \? "Đang tải…" : isVideo \? "Thêm video" : "Tải lên"\}</button></footer></form></div>'
upload_new = r'''<AdminModal open={true} onClose={onClose} title={isVideo ? "Thêm video YouTube" : "Tải tài liệu lên"} size="md" footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button disabled={busy || (isVideo ? !youtubeEmbedUrl(videoUrl) : !file)} onClick={submit}>{busy ? "Đang tải…" : isVideo ? "Thêm video" : "Tải lên"}</Button></>}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Tên tài liệu</label>
          <input required value={title} onChange={event => setTitle(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Loại tài liệu</label>
          <select required value={type} onChange={event => setType(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
            {types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Phạm vi</label>
          <select value={audience} onChange={event => setAudience(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
            <option value="TEACHER_RESTRICTED">Chỉ giáo viên</option>
            <option value="STUDENT_ALLOWED">Cho phép học sinh</option>
          </select>
        </div>
        {isVideo ? (
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Link video YouTube</label>
            <input required type="url" placeholder="https://www.youtube.com/watch?v=..." value={videoUrl} onChange={event => setVideoUrl(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none" />
            {invalidVideo && <small className="text-error block mt-1">Link YouTube không hợp lệ.</small>}
            <small className="text-on-surface-variant block mt-1">Video sẽ phát ngay trong website, học sinh không bị chuyển sang YouTube.</small>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Chọn file</label>
            <input required type="file" onChange={event => setFile(event.target.files?.[0] ?? null)} className="w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-surface-variant file:text-on-surface hover:file:bg-outline-variant cursor-pointer" />
          </div>
        )}
        {error && <div className="p-3 rounded-lg bg-error-container text-on-error-container text-sm">{error}</div>}
      </form>
    </AdminModal>'''
code = re.sub(upload_old, upload_new, code)

# AdminBulkUpload
bulk_old = r'<div className="docs-overlay" onMouseDown=\{event => \{ if \(event.target === event.currentTarget && !busy\) onClose\(\); \}\}>\s*<div className="docs-modal docs-bulk-modal">\s*<header><h2>Tải nhiều tài liệu</h2><button type="button" onClick=\{onClose\} disabled=\{busy\}><X size=\{18\} /></button></header>\s*<label>Chọn file \(PDF, DOC, DOCX — chọn được nhiều file cùng lúc\)\s*<input type="file" multiple accept="\.pdf,\.doc,\.docx,application/pdf,application/msword,application/vnd\.openxmlformats-officedocument\.wordprocessingml\.document" onChange=\{event => \{ addFiles\(event.target.files\); event.target.value = ""; \}\} />\s*</label>\s*\{rows.length > 0 && <>\s*<div className="docs-bulk-defaults">\s*<label>Loại tài liệu mặc định<select value=\{defaultType\} onChange=\{event => setDefaultType\(event.target.value\)\}>\{types.map\(item => <option value=\{item.value\} key=\{item.value\}>\{item.label\}</option>\)\}</select></label>\s*<label>Phạm vi mặc định<select value=\{defaultAudience\} onChange=\{event => setDefaultAudience\(event.target.value\)\}><option value="TEACHER_RESTRICTED">Chỉ giáo viên</option><option value="STUDENT_ALLOWED">Cho phép học sinh</option></select></label>\s*<button type="button" onClick=\{applyDefaults\}>Áp dụng cho tất cả</button>\s*</div>\s*<div className="docs-bulk-rows">\s*\{rows.map\(row => <div key=\{row.id\} className="docs-bulk-row">\s*<input value=\{row.title\} onChange=\{event => updateRow\(row.id, \{ title: event.target.value \}\)\} disabled=\{row.status === "uploading" \|\| row.status === "done"\} />\s*<select value=\{row.typeValue\} onChange=\{event => updateRow\(row.id, \{ typeValue: event.target.value \}\)\} disabled=\{row.status === "uploading" \|\| row.status === "done"\}>\{types.map\(item => <option value=\{item.value\} key=\{item.value\}>\{item.label\}</option>\)\}</select>\s*<select value=\{row.audience\} onChange=\{event => updateRow\(row.id, \{ audience: event.target.value \}\)\} disabled=\{row.status === "uploading" \|\| row.status === "done"\}><option value="TEACHER_RESTRICTED">Chỉ giáo viên</option><option value="STUDENT_ALLOWED">Cho phép học sinh</option></select>\s*<span className="docs-bulk-status">\{row.status === "pending" \? "Chờ" : row.status === "uploading" \? "Đang tải…" : row.status === "done" \? "✓ Xong" : "✗ Lỗi"\}</span>\s*\{row.status === "uploading" \|\| row.status === "done" \? <span /> : <button type="button" title="Bỏ khỏi danh sách" aria-label=\{`Bỏ \$\{row.title\}`\} onClick=\{.*\}>\s*<X size=\{16\} />\s*</button>\}\s*\{row.status === "error" && <small className="docs-bulk-error">\{row.error\}</small>\}\s*</div>\)\}\s*</div>\s*</>\}\s*<footer>\s*<span>\{doneCount\} / \{rows.length\} đã tải lên</span>\s*<div><button type="button" onClick=\{onClose\} disabled=\{busy\}>Đóng</button><button type="button" className="docs-primary" onClick=\{.*\}>.*</button></div>\s*</footer>\s*</div>\s*</div>'

bulk_new = r'''<AdminModal open={true} onClose={() => { if (!busy) onClose(); }} title="Tải nhiều tài liệu" size="xl" footer={
      <div className="flex items-center justify-between w-full">
        <span className="text-sm text-on-surface-variant">{doneCount} / {rows.length} đã tải lên</span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Đóng</Button>
          <Button onClick={() => void uploadAll()} disabled={busy || !canUpload}>{busy ? "Đang tải…" : `Tải lên (${rows.filter(row => row.status === "pending" || row.status === "error").length})`}</Button>
        </div>
      </div>
    }>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Chọn file (PDF, DOC, DOCX — chọn được nhiều file cùng lúc)</label>
          <input type="file" multiple accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => { addFiles(event.target.files); event.target.value = ""; }} className="w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-surface-variant file:text-on-surface hover:file:bg-outline-variant cursor-pointer" />
        </div>
        {rows.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 p-4 bg-surface rounded-lg border border-outline-variant">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-on-surface mb-1">Loại tài liệu mặc định</label>
                <select value={defaultType} onChange={event => setDefaultType(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
                  {types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-on-surface mb-1">Phạm vi mặc định</label>
                <select value={defaultAudience} onChange={event => setDefaultAudience(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
                  <option value="TEACHER_RESTRICTED">Chỉ giáo viên</option>
                  <option value="STUDENT_ALLOWED">Cho phép học sinh</option>
                </select>
              </div>
              <Button variant="secondary" onClick={applyDefaults}>Áp dụng cho tất cả</Button>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
              {rows.map(row => (
                <div key={row.id} className="flex items-center gap-2 p-2 rounded-lg border border-outline-variant hover:bg-surface">
                  <input value={row.title} onChange={event => updateRow(row.id, { title: event.target.value })} disabled={row.status === "uploading" || row.status === "done"} className="flex-[2] min-w-0 h-9 px-2 rounded border border-outline-variant text-sm disabled:opacity-50" />
                  <select value={row.typeValue} onChange={event => updateRow(row.id, { typeValue: event.target.value })} disabled={row.status === "uploading" || row.status === "done"} className="flex-1 min-w-0 h-9 px-2 rounded border border-outline-variant text-sm bg-white disabled:opacity-50">
                    {types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
                  </select>
                  <select value={row.audience} onChange={event => updateRow(row.id, { audience: event.target.value })} disabled={row.status === "uploading" || row.status === "done"} className="flex-1 min-w-0 h-9 px-2 rounded border border-outline-variant text-sm bg-white disabled:opacity-50">
                    <option value="TEACHER_RESTRICTED">Chỉ giáo viên</option>
                    <option value="STUDENT_ALLOWED">Cho phép học sinh</option>
                  </select>
                  <div className="w-24 text-sm font-medium truncate">
                    {row.status === "pending" ? <span className="text-on-surface-variant">Chờ</span> : row.status === "uploading" ? <span className="text-primary">Đang tải…</span> : row.status === "done" ? <span className="text-[#3f6212]">✓ Xong</span> : <span className="text-error">✗ Lỗi</span>}
                  </div>
                  {row.status === "uploading" || row.status === "done" ? <div className="w-8" /> : (
                    <button type="button" title="Bỏ khỏi danh sách" aria-label={`Bỏ ${row.title}`} onClick={() => removeRow(row.id)} className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-error rounded hover:bg-error/10">
                      <X size={16} />
                    </button>
                  )}
                  {row.status === "error" && <div className="w-full text-xs text-error mt-1">{row.error}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminModal>'''

code = re.sub(r'<div className="docs-overlay" onMouseDown=\{event => \{ if \(event.target === event.currentTarget && !busy\) onClose\(\); \}\}>[\s\S]*?(?=</section>;)', bulk_new, code)


with open("c:/Users/Admin/Downloads/MATH9_AI_Web_Demo_V6_Vercel/src/admin/rewrite.py", "w", encoding="utf-8") as f:
    f.write(code)
