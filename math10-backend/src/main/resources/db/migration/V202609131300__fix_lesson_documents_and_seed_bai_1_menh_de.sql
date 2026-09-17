-- Chuyển ràng buộc unique sang partial index để không chặn các dòng đã xóa mềm
alter table lesson_documents drop constraint if exists uq_lesson_documents_order;
drop index if exists uq_lesson_documents_active_order;
create unique index if not exists uq_lesson_documents_active_order
on lesson_documents(lesson_id, display_order) where deleted_at is null;

-- Dọn dẹp liên kết tài liệu mồ côi (tài liệu gốc đã bị xóa mềm)
update lesson_documents
set deleted_at = now(),
    display_order = -id,
    updated_at = now()
where document_id in (select id from documents where deleted_at is not null)
  and deleted_at is null;

-- Sắp xếp lại tài liệu còn lại của bài 49 (nếu có)
update lesson_documents
set display_order = 4
where lesson_id = 49 and document_id = 8 and deleted_at is null;

-- Cập nhật tóm tắt và nội dung lý thuyết chuẩn SGK Toán 10 KNTT cho Bài 1. Mệnh đề (lesson_id = 49)
update lessons
set summary = 'Hiểu định nghĩa mệnh đề và mệnh đề chứa biến; biết lập mệnh đề phủ định, mệnh đề kéo theo (P => Q), mệnh đề đảo, mệnh đề tương đương (P <=> Q); hiểu rõ khái niệm điều kiện cần, điều kiện đủ; nắm vững cách sử dụng các kí hiệu với mọi (∀) và tồn tại (∃).',
    content_html = '<div class="lesson-theory space-y-6">
  <section class="theory-block">
    <h3 class="text-base font-bold text-emerald-800 border-b pb-1 mb-2">1. Mệnh đề, mệnh đề toán học</h3>
    <div class="p-3 bg-slate-50 rounded-lg border-l-4 border-emerald-600 mb-3 text-slate-800">
      <p class="font-medium"><strong>Định nghĩa:</strong> Mệnh đề logic (gọi tắt là mệnh đề) là một câu khẳng định có tính đúng hoặc sai rõ ràng.</p>
      <ul class="list-disc list-inside mt-1 text-sm space-y-1">
        <li>Một mệnh đề không thể vừa đúng vừa sai.</li>
        <li>Một mệnh đề đúng gọi là một <em>mệnh đề đúng</em>. Một mệnh đề sai gọi là một <em>mệnh đề sai</em>.</li>
        <li>Các câu hỏi, câu cảm thán, câu cầu khiến không phải là mệnh đề logic.</li>
      </ul>
    </div>
    <div class="bg-amber-50 p-3 rounded-lg border border-amber-200 text-sm text-amber-900">
      <strong>Ví dụ 1:</strong>
      <ul class="list-disc list-inside mt-1 space-y-1">
        <li>"Hà Nội là thủ đô của Việt Nam" &rarr; Là mệnh đề đúng.</li>
        <li>"$2 + 3 = 6$" &rarr; Là mệnh đề sai (mệnh đề toán học sai).</li>
        <li>"Hôm nay trời đẹp quá!" &rarr; Không phải mệnh đề (câu cảm thán).</li>
      </ul>
    </div>
  </section>

  <section class="theory-block">
    <h3 class="text-base font-bold text-emerald-800 border-b pb-1 mb-2">2. Mệnh đề chứa biến</h3>
    <p class="text-sm text-slate-700 leading-relaxed mb-2">
      <strong>Mệnh đề chứa biến</strong> là câu khẳng định mà tính đúng hoặc sai của nó phụ thuộc vào một hay nhiều biến số trong một tập hợp xác định.
    </p>
    <div class="bg-slate-50 p-3 rounded-lg border text-sm text-slate-700">
      <strong>Ví dụ 2:</strong> Cho khẳng định $P(n): "n \text{ chia hết cho } 3"$ với $n \in \mathbb{N}$.
      <ul class="list-disc list-inside mt-1 space-y-1">
        <li>Khi $n = 9$, ta có $P(9): "9 \text{ chia hết cho } 3"$ là một mệnh đề <strong>đúng</strong>.</li>
        <li>Khi $n = 7$, ta có $P(7): "7 \text{ chia hết cho } 3"$ là một mệnh đề <strong>sai</strong>.</li>
      </ul>
    </div>
  </section>

  <section class="theory-block">
    <h3 class="text-base font-bold text-emerald-800 border-b pb-1 mb-2">3. Mệnh đề phủ định</h3>
    <div class="p-3 bg-slate-50 rounded-lg border-l-4 border-emerald-600 mb-3 text-slate-800 text-sm">
      <p>Cho mệnh đề $P$. Mệnh đề "Không phải $P$" được gọi là <strong>mệnh đề phủ định</strong> của $P$, kí hiệu là $\overline{P}$.</p>
      <p class="mt-1">Tính đúng sai: Nếu $P$ đúng thì $\overline{P}$ sai; nếu $P$ sai thì $\overline{P}$ đúng.</p>
    </div>
    <div class="bg-amber-50 p-3 rounded-lg border border-amber-200 text-sm text-amber-900">
      <strong>Ví dụ 3:</strong>
      <ul class="list-disc list-inside mt-1 space-y-1">
        <li>Cho $P: "17 \text{ là số nguyên tố}"$ &rarr; Phủ định là $\overline{P}: "17 \text{ không phải là số nguyên tố}"$ (Mệnh đề $P$ đúng, $\overline{P}$ sai).</li>
        <li>Cho $Q: "\sqrt{2} \text{ là số hữu tỉ}"$ &rarr; Phủ định là $\overline{Q}: "\sqrt{2} \text{ là số vô tỉ}"$ (Mệnh đề $Q$ sai, $\overline{Q}$ đúng).</li>
      </ul>
    </div>
  </section>

  <section class="theory-block">
    <h3 class="text-base font-bold text-emerald-800 border-b pb-1 mb-2">4. Mệnh đề kéo theo và mệnh đề đảo</h3>
    <div class="space-y-3 text-sm text-slate-700">
      <div class="p-3 bg-slate-50 rounded-lg border-l-4 border-emerald-600">
        <p><strong>Mệnh đề kéo theo:</strong> Cho hai mệnh đề $P$ và $Q$. Mệnh đề "Nếu $P$ thì $Q$" được gọi là mệnh đề kéo theo, kí hiệu $P \Rightarrow Q$.</p>
        <p class="mt-1 font-semibold text-rose-700">&bull; Mệnh đề $P \Rightarrow Q$ chỉ SAI khi $P$ đúng và $Q$ sai; đúng trong tất cả các trường hợp còn lại.</p>
      </div>
      <div class="p-3 bg-blue-50 rounded-lg border border-blue-200 text-blue-900">
        <p class="font-semibold">Điều kiện cần và điều kiện đủ:</p>
        <p class="mt-1">Trong định lý toán học có dạng $P \Rightarrow Q$:</p>
        <ul class="list-disc list-inside mt-1 space-y-1">
          <li>$P$ là <strong>giả thiết</strong>, $Q$ là <strong>kết luận</strong>.</li>
          <li>$P$ là <strong>điều kiện đủ</strong> để có $Q$.</li>
          <li>$Q$ là <strong>điều kiện cần</strong> để có $P$.</li>
        </ul>
      </div>
      <p><strong>Mệnh đề đảo:</strong> Cho mệnh đề kéo theo $P \Rightarrow Q$. Mệnh đề $Q \Rightarrow P$ được gọi là mệnh đề đảo của $P \Rightarrow Q$. Mệnh đề đảo không nhất thiết đúng khi mệnh đề kéo theo đúng.</p>
    </div>
  </section>

  <section class="theory-block">
    <h3 class="text-base font-bold text-emerald-800 border-b pb-1 mb-2">5. Mệnh đề tương đương</h3>
    <div class="p-3 bg-slate-50 rounded-lg border-l-4 border-emerald-600 text-sm text-slate-800">
      <p>Cho hai mệnh đề $P$ và $Q$. Mệnh đề "$P$ khi và chỉ khi $Q$" (hoặc "$P$ tương đương $Q$") kí hiệu là $P \Leftrightarrow Q$.</p>
      <p class="mt-1">&bull; $P \Leftrightarrow Q$ đúng khi cả hai mệnh đề $P \Rightarrow Q$ và $Q \Rightarrow P$ cùng đúng (nghĩa là $P$ và $Q$ có cùng tính đúng sai).</p>
      <p class="mt-1">&bull; Khi $P \Leftrightarrow Q$ là định lý, ta nói $P$ là <strong>điều kiện cần và đủ</strong> để có $Q$.</p>
    </div>
  </section>

  <section class="theory-block">
    <h3 class="text-base font-bold text-emerald-800 border-b pb-1 mb-2">6. Kí hiệu với mọi (&forall;) và tồn tại (&exist;)</h3>
    <div class="grid md:grid-cols-2 gap-3 text-sm">
      <div class="p-3 bg-slate-50 rounded-lg border">
        <b class="text-emerald-700">Kí hiệu $\forall$ (Với mọi):</b>
        <p class="mt-1">$\forall x \in X, P(x)$ khẳng định tính chất $P(x)$ đúng với mọi phần tử $x$ thuộc $X$.</p>
        <p class="mt-1 text-xs text-slate-500">Ví dụ: $\forall x \in \mathbb{R}, x^2 \ge 0$ (Mệnh đề đúng).</p>
      </div>
      <div class="p-3 bg-slate-50 rounded-lg border">
        <b class="text-emerald-700">Kí hiệu $\exists$ (Tồn tại):</b>
        <p class="mt-1">$\exists x \in X, P(x)$ khẳng định có ít nhất một phần tử $x \in X$ thỏa mãn $P(x)$.</p>
        <p class="mt-1 text-xs text-slate-500">Ví dụ: $\exists n \in \mathbb{N}, n^2 = n$ (Mệnh đề đúng vì $n=0, 1$).</p>
      </div>
    </div>
    <div class="p-3 bg-amber-50 rounded-lg border border-amber-200 mt-3 text-sm text-amber-900">
      <strong>Quy tắc phủ định mệnh đề chứa lượng từ:</strong>
      <ul class="list-disc list-inside mt-1 space-y-1">
        <li>Phủ định của "$\forall x \in X, P(x)$" là "$\exists x \in X, \overline{P(x)}$".</li>
        <li>Phủ định của "$\exists x \in X, P(x)$" là "$\forall x \in X, \overline{P(x)}$".</li>
      </ul>
    </div>
  </section>
</div>',
    status = 'PUBLISHED',
    updated_at = now()
where id = 49;

-- Gắn các tài liệu học tập chính xác cho Bài 1. Mệnh đề (lesson_id = 49)
-- 1. Video bài giảng: document_id = 17
insert into lesson_documents (lesson_id, document_id, is_required, teacher_note, display_order, created_at, updated_at)
select 49, 17, true, 'Video bài giảng: Bài 1. Mệnh Đề, Mệnh Đề Chứa Biến (Thầy Nguyễn Phan Tiến)', 1, now(), now()
where exists (select 1 from lessons where id = 49)
  and exists (select 1 from documents where id = 17)
  and not exists (
    select 1 from lesson_documents where lesson_id = 49 and document_id = 17 and deleted_at is null
);

-- 2. SGK Toán 10 KNTT tập 1: document_id = 2, trang 5
insert into lesson_documents (lesson_id, document_id, is_required, teacher_note, start_page, display_order, created_at, updated_at)
select 49, 2, true, 'SGK Toán 10 KNTT Tập 1 - Bài 1. Mệnh đề (Trang 5-11)', 5, 2, now(), now()
where exists (select 1 from lessons where id = 49)
  and exists (select 1 from documents where id = 2)
  and not exists (
    select 1 from lesson_documents where lesson_id = 49 and document_id = 2 and deleted_at is null
);

-- 3. SBT Toán 10 KNTT tập 1: document_id = 5, trang 5
insert into lesson_documents (lesson_id, document_id, is_required, teacher_note, start_page, display_order, created_at, updated_at)
select 49, 5, false, 'SBT Toán 10 KNTT Tập 1 - Bài tập Mệnh đề (Trang 5-8)', 5, 3, now(), now()
where exists (select 1 from lessons where id = 49)
  and exists (select 1 from documents where id = 5)
  and not exists (
    select 1 from lesson_documents where lesson_id = 49 and document_id = 5 and deleted_at is null
);
