---
name: ui-design
description: >-
  Skill thiết kế giao diện UI cho dự án MATH9/MATH10 Web App.
  Sử dụng khi cần tạo mới hoặc chỉnh sửa giao diện, layout, component UI.
  Bao gồm design system, patterns, responsive rules, Admin UI Kit,
  và tham chiếu giao diện mẫu WeLearning LMS.
---

# UI Design Skill — MATH9/MATH10 Web App

## Tech Stack

| Thành phần | Công nghệ |
|-----------|-----------|
| Framework | **React 19** + **TypeScript 5.9** |
| Styling | **TailwindCSS 4** (plugin Vite, `@theme` tokens) |
| UI Primitives | **shadcn/ui** (Radix UI + CVA + `cn()`) |
| Icons | **Lucide React** + **Material Symbols Outlined** |
| Data Fetching | **TanStack React Query v5** |
| Build | **Vite 7** |
| Font | **Be Vietnam Pro** (Google Fonts) |

---

## Design System (Design Tokens)

### Màu Sắc — `@theme` tokens trong `globals.css`

```css
/* Surfaces */
--color-surface: #f8f9ff;                 /* Nền trang */
--color-surface-container-lowest: #ffffff; /* Nền card */
--color-surface-container-low: #eff4ff;
--color-surface-container: #e5eeff;
--color-surface-container-high: #dce9ff;
--color-on-surface: #0b1c30;              /* Text chính */
--color-on-surface-variant: #434655;      /* Text phụ */

/* Primary (Xanh rừng — Brand color MATH10) */
--color-primary: #176b50;
--color-on-primary: #ffffff;
--color-primary-container: #dff3ea;
--color-on-primary-container: #11543e;

/* Secondary (Xanh lá) */
--color-secondary: #006e2d;
--color-secondary-container: #7cf994;

/* Tertiary (Cam) */
--color-tertiary: #973400;
--color-tertiary-container: #c04400;

/* Outline */
--color-outline: #737686;
--color-outline-variant: #c3c6d7;        /* Border chính */

/* Error / Warn */
--color-error: #ba1a1a;
--color-error-container: #ffdad6;
--color-warn: #ea580c;
```

> **Quy tắc**: Dùng token thay vì mã màu cứng. VD: `text-on-surface-variant` thay vì `text-gray-500`, `border-outline-variant` thay vì `border-gray-300`.

### Typography

```
Font: "Be Vietnam Pro", system-ui, sans-serif
h1: text-2xl font-semibold tracking-tight
h2: text-lg font-semibold
h3: text-base font-bold
Body: text-sm (14px)
Caption: text-xs (12px)
Eyebrow: text-xs font-bold uppercase tracking-widest text-on-surface-variant
```

### Spacing & Layout

```
Card padding:      p-4 đến p-6
Section gap:       gap-4 đến gap-6
Border radius:     rounded-lg (8px) → rounded-xl (12px) cho cards
Shadow:            shadow-sm (cards), shadow-2xl (modals/drawers)
Border:            border border-outline-variant
```

### Responsive Breakpoints

| Breakpoint | Prefix | Grid Columns | Ghi chú |
|-----------|--------|-------------|---------|
| < 640px | (default) | 1 col | Mobile-first |
| ≥ 640px | `sm:` | 2 cols | Tablet |
| ≥ 768px | `md:` | 2 cols | Tablet landscape |
| ≥ 1024px | `lg:` | 3 cols | Desktop |
| ≥ 1280px | `xl:` | 4 cols | Wide desktop |

---

## Admin UI Kit (Components dùng chung)

> Dự án đã có sẵn bộ Admin UI Kit tại `src/admin/components/`. **Bắt buộc sử dụng** khi xây trang admin.

### Danh sách components

| Component | File | Mô tả |
|-----------|------|-------|
| `AdminPage` | `AdminPageLayout.tsx` | Wrapper + Header + Filters + Content |
| `AdminTable` | `AdminTable.tsx` | Bảng data chuẩn: skeleton, zebra, sticky actions |
| `AdminPagination` | `AdminTable.tsx` | Phân trang: chevron + "Trang X/Y" |
| `AdminDrawer` | `AdminDrawer.tsx` | Panel trượt phải: sm/md/lg (480/560/640px) |
| `AdminModal` | `AdminModal.tsx` | Modal centered: sm/md/lg/xl (430/520/680/980px) |
| `AdminEmptyState` | `AdminEmptyState.tsx` | Empty state: icon + title + desc + CTA |
| `SkeletonTable` | `AdminSkeleton.tsx` | Skeleton loading cho bảng |
| `SearchInput` | `AdminFilterBar.tsx` | Ô tìm kiếm debounce 500ms |
| `FilterSelect` | `AdminFilterBar.tsx` | Dropdown lọc styled |

### Cách sử dụng (Admin Page pattern)

```tsx
import { AdminPage } from "./components/AdminPageLayout";
import { AdminTable, AdminPagination } from "./components/AdminTable";
import { AdminDrawer } from "./components/AdminDrawer";
import { AdminEmptyState } from "./components/AdminEmptyState";
import { SearchInput, FilterSelect } from "./components/AdminFilterBar";
import { Button } from "../components/ui/button";

function AdminListPage({ session }) {
  return (
    <AdminPage>
      <AdminPage.Header
        eyebrow="QUẢN TRỊ HỆ THỐNG"
        title="Tiêu đề trang"
        description="Mô tả ngắn gọn."
      >
        <Button>+ Thêm mới</Button>
      </AdminPage.Header>

      <AdminPage.Filters>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm kiếm..." />
        <FilterSelect value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Tất cả</option>
        </FilterSelect>
      </AdminPage.Filters>

      <AdminPage.Content>
        <AdminTable
          columns={columns}
          data={items}
          loading={isLoading}
          keyExtractor={row => row.id}
          onRowClick={row => setSelected(row)}
          footer={<AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />}
        />
      </AdminPage.Content>

      <AdminDrawer open={!!selected} onClose={() => setSelected(null)} title="Chi tiết">
        {/* Drawer content */}
      </AdminDrawer>
    </AdminPage>
  );
}
```

---

## Student Page Patterns (Tham chiếu WeLearning)

### Pattern 1: List Page với Image Cards (Learning Path)

```
┌─────────────────────────────────────────┐
│  h1: "Tiêu đề"                         │
├─────────────────────────────────────────┤
│  [Filter buttons] [🔍 Search] [Sort ▼] │
│  bg-primary rounded-lg p-1             │
├─────────────────────────────────────────┤
│  grid 1→2→3 cols, gap-6               │
│  ┌──────┐ ┌──────┐ ┌──────┐           │
│  │Image │ │Image │ │Image │           │
│  │Title │ │Title │ │Title │           │
│  │Stats │ │Stats │ │Stats │           │
│  │Prog% │ │Prog% │ │Prog% │           │
│  └──────┘ └──────┘ └──────┘           │
└─────────────────────────────────────────┘
```

**Đặc điểm**: Image card h-48, hover zoom scale-110, play overlay, progress bar, tag badges absolute positioned.

### Pattern 2: List Page với Data Cards (My Exams)

```
┌─────────────────────────────────────────┐
│  h1: "Tiêu đề"            [🔍 Search]  │
├─────────────────────────────────────────┤
│  [Tab1(5)] [Tab2(3)] [Tab3(2)] [Sort ▼] │
├─────────────────────────────────────────┤
│  grid 1→2→3→4 cols, gap-6             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │Title │ │Title │ │Title │ │Title │  │
│  │Badges│ │Badges│ │Badges│ │Badges│  │
│  │Info  │ │Info  │ │Info  │ │Info  │  │
│  │[CTA] │ │[CTA] │ │[CTA] │ │[CTA] │  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
├─────────────────────────────────────────┤
│  Pagination: ← 1 2 3 ... →             │
└─────────────────────────────────────────┘
```

**Đặc điểm**: Status tabs với count badges, card info rows key:value, CTA button full-width.

### Pattern chung cả 2 trang

| Element | Thiết kế chuẩn |
|---------|---------------|
| **Title line-clamp** | `line-clamp-2 min-h-[32px]` |
| **Card hover** | `transition-all duration-300 hover:shadow-md` |
| **Empty state** | Icon centered + text gray-400 + py-12 |
| **Search debounce** | 500ms setTimeout |
| **Responsive grid** | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` |
| **Status badges** | PrimeVue Badge → dùng `<span>` + Tailwind rounded px-2 py-0.5 |
| **Dark mode** | CSS variables `--dark-rail`, `--dark-secondary` |

---

## UI Primitives (shadcn/ui)

### Có sẵn trong dự án

| Component | File | Variants |
|-----------|------|----------|
| `Button` | `ui/button.tsx` | default, outline, ghost, destructive / default, sm, icon |
| `Card` | `ui/card.tsx` | CardHeader, CardContent |
| `Input` | `ui/input.tsx` | Standard text input |

### Cần cài thêm khi cần

```bash
npx shadcn@latest add dialog badge select tabs pagination skeleton tooltip
```

Xem chi tiết mapping PrimeVue → shadcn/ui: [shadcn-components.md](./references/shadcn-components.md)

---

## Quy Tắc Thiết Kế Bắt Buộc

1. **Mobile-first**: Class mặc định cho mobile, `sm:` `md:` `lg:` `xl:` cho breakpoint lớn hơn
2. **Design tokens**: Dùng `text-on-surface`, `bg-primary`, `border-outline-variant` — KHÔNG dùng mã hex cứng
3. **Accessible**: Focus ring (`focus-visible:ring-2`), `aria-label` cho icon buttons, đủ contrast
4. **Smooth transitions**: `transition-all duration-200` cho hover/focus states
5. **Line clamping**: Title dài dùng `line-clamp-2`, description dùng `line-clamp-2 min-h-[32px]`
6. **Skeleton loading**: Khi loading data → SkeletonTable/SkeletonCard, KHÔNG dùng text "Đang tải..."
7. **Empty state**: Mọi danh sách phải có empty state với icon + message + CTA tùy chọn
8. **Error banner**: `p-3 rounded-lg bg-error-container text-on-error-container text-sm`
9. **Vietnamese UI**: Tất cả label, placeholder, message bằng tiếng Việt
10. **Admin pages**: BẮT BUỘC dùng Admin UI Kit (`AdminPage`, `AdminTable`, `AdminDrawer`, v.v.)

---

## Tài Liệu Tham Khảo

- [WeLearning My-Exams](./references/welearning-my-exams.md) — Phân tích chi tiết trang danh sách bài thi
- [WeLearning Learning-Path](./references/welearning-learning-path.md) — Phân tích chi tiết trang lộ trình học tập
- [shadcn/ui Components](./references/shadcn-components.md) — Mapping PrimeVue → shadcn/ui
