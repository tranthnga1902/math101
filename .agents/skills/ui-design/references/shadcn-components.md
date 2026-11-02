# shadcn/ui Components — Quick Reference

Dự án sử dụng shadcn/ui (Radix UI primitives + TailwindCSS + CVA).

## Components Có Sẵn Trong Dự Án

| Component | File | Mô tả |
|-----------|------|-------|
| `Button` | `src/components/ui/button.tsx` | Nút bấm với các variants: default, destructive, outline, secondary, ghost, link |
| `Card` | `src/components/ui/card.tsx` | Card container đơn giản |
| `Input` | `src/components/ui/input.tsx` | Input field cơ bản |

## Components Cần Thêm (Khi Cần)

Cài đặt qua: `npx shadcn@latest add <component>`

### Danh sách thường dùng cho thiết kế theo mẫu WeLearning:

| Component | Lệnh cài | Tương đương WeLearning |
|-----------|----------|----------------------|
| `Dialog` | `npx shadcn@latest add dialog` | PrimeVue Dialog — modal xác nhận |
| `Badge` | `npx shadcn@latest add badge` | PrimeVue Tag — hiển thị status |
| `Select` | `npx shadcn@latest add select` | PrimeVue Select — dropdown sắp xếp |
| `Tabs` | `npx shadcn@latest add tabs` | PrimeVue SelectButton — filter tabs |
| `Pagination` | `npx shadcn@latest add pagination` | PrimeVue Paginator — phân trang |
| `Skeleton` | `npx shadcn@latest add skeleton` | Loading placeholder |
| `Tooltip` | `npx shadcn@latest add tooltip` | PrimeVue Tooltip directive |
| `DropdownMenu` | `npx shadcn@latest add dropdown-menu` | Context menu / actions |
| `Sheet` | `npx shadcn@latest add sheet` | Sidebar / mobile drawer |
| `Separator` | `npx shadcn@latest add separator` | Horizontal rule (hr) |
| `Avatar` | `npx shadcn@latest add avatar` | User avatar |
| `Toast` / `Sonner` | `npx shadcn@latest add sonner` | PrimeVue Toast — notifications |
| `Progress` | `npx shadcn@latest add progress` | Progress bar |

## Cách Sử Dụng

### Button Variants
```tsx
import { Button } from "@/components/ui/button";

<Button>Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button disabled>Disabled</Button>
```

### Card
```tsx
import { Card } from "@/components/ui/card";

<Card className="p-6">
  <h3>Title</h3>
  <p>Content</p>
</Card>
```

### Input
```tsx
import { Input } from "@/components/ui/input";

<Input placeholder="Nhập..." className="w-full" />
<Input type="password" />
```

## Mapping WeLearning PrimeVue → shadcn/ui

| WeLearning (PrimeVue) | Dự án (shadcn/ui) | Ghi chú |
|----------------------|-------------------|---------|
| `<Panel>` / `<Card>` | `<Card>` | Wrapper cho nội dung |
| `<Button>` | `<Button>` | Tương tự, dùng `variant` |
| `<InputText>` | `<Input>` | Tương tự |
| `<Dialog>` | `<Dialog>` | Cần cài thêm |
| `<DataView>` | Custom grid + map | Tự build với CSS grid |
| `<Paginator>` | `<Pagination>` | Cần cài thêm |
| `<SelectButton>` | `<Tabs>` | Filter tabs |
| `<Select>` | `<Select>` | Cần cài thêm |
| `<Tag>` / `<Badge>` | `<Badge>` | Cần cài thêm |
| `<Toast>` | `<Sonner>` | Cần cài thêm |
| `<InputGroup>` | `<div className="relative">` + icon | Tự compose |
| `v-tooltip` directive | `<Tooltip>` | Cần cài thêm |
| `RingProgress` (custom) | Custom SVG hoặc `<Progress>` | Tự build |
